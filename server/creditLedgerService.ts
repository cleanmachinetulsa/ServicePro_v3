import { db } from "./db";
import { 
  creditLedger, 
  creditTransactions,
  type InsertCreditLedger,
  type InsertCreditTransaction,
  type CreditLedger
} from "@shared/schema";
import { eq, and, or, lte, sql, desc, isNull } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

// Type for database executor - REQUIRED, no default (enforces transaction usage)
type DbExecutor = NodePgDatabase<any> | Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Award credit to a customer (service_credit or gift_card referral reward)
 * 
 * @param customerId - Customer receiving the credit
 * @param creditType - 'service_credit' or 'gift_card'
 * @param amount - Credit amount in dollars
 * @param source - Source of credit (e.g., 'referral_reward', 'admin_grant')
 * @param sourceId - ID of source entity (e.g., referral code ID)
 * @param description - Human-readable description for audit trail
 * @param expiryDays - Days until credit expires (null = never)
 * @param executor - Database transaction executor (REQUIRED)
 */
export async function awardCredit(
  customerId: number,
  creditType: 'service_credit' | 'gift_card',
  amount: number,
  source: string,
  sourceId: number | null,
  description: string,
  expiryDays: number | null,
  executor: DbExecutor
): Promise<{ success: boolean; creditId: number; balance: number }> {
  try {
    // Validate amount
    if (amount <= 0) {
      throw new Error(`Invalid credit amount: ${amount}. Must be greater than 0.`);
    }

    // Calculate expiry date if applicable
    let expiresAt: Date | null = null;
    if (expiryDays && expiryDays > 0) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiryDays);
    }

    // Create credit ledger entry
    const [credit] = await executor
      .insert(creditLedger)
      .values({
        customerId,
        creditType,
        initialAmount: amount.toString(),
        currentBalance: amount.toString(),
        source,
        sourceId,
        description,
        status: 'active',
        expiresAt,
      })
      .returning();

    // Record 'issued' transaction
    await executor.insert(creditTransactions).values({
      creditLedgerId: credit.id,
      amount: amount.toString(),
      description: `Issued: ${description}`,
      transactionType: 'issued',
      balanceBefore: '0',
      balanceAfter: amount.toString(),
    });

    console.log(`[CREDIT LEDGER] Awarded ${creditType} of $${amount} to customer ${customerId} (source: ${source})`);

    return {
      success: true,
      creditId: credit.id,
      balance: amount,
    };
  } catch (error) {
    console.error('[CREDIT LEDGER] Error awarding credit:', error);
    throw error;
  }
}

/**
 * Apply customer credits to an invoice
 * Uses FIFO ordering: earliest expiring credits first, then oldest issued
 * 
 * @param customerId - Customer whose credits to apply
 * @param invoiceId - Invoice to apply credits to
 * @param requestedAmount - Maximum amount to apply (usually invoice total)
 * @param executor - Database transaction executor (REQUIRED)
 */
export async function applyCredit(
  customerId: number,
  invoiceId: number,
  requestedAmount: number,
  executor: DbExecutor
): Promise<{ success: boolean; amountApplied: number; remainingBalance: number }> {
  try {
    if (requestedAmount <= 0) {
      throw new Error(`Invalid application amount: ${requestedAmount}`);
    }

    // Get active credits in FIFO order (expiring soonest first, then oldest)
    // Use FOR UPDATE to lock rows and prevent race conditions
    const activeCredits = await executor
      .select()
      .from(creditLedger)
      .where(
        and(
          eq(creditLedger.customerId, customerId),
          eq(creditLedger.status, 'active'),
          or(
            isNull(creditLedger.expiresAt),
            sql`${creditLedger.expiresAt} > NOW()`
          )
        )
      )
      .orderBy(
        sql`${creditLedger.expiresAt} NULLS LAST`,
        creditLedger.issuedAt
      )
      .for('update');

    if (activeCredits.length === 0) {
      return {
        success: true,
        amountApplied: 0,
        remainingBalance: 0,
      };
    }

    let amountRemaining = requestedAmount;
    let totalApplied = 0;

    // Apply credits in FIFO order until requested amount is met
    for (const credit of activeCredits) {
      if (amountRemaining <= 0) break;

      const currentBalance = parseFloat(credit.currentBalance);
      const amountToApply = Math.min(amountRemaining, currentBalance);
      const newBalance = currentBalance - amountToApply;

      // Update credit balance
      await executor
        .update(creditLedger)
        .set({
          currentBalance: newBalance.toString(),
          lastUsedAt: new Date(),
          usedAt: newBalance === 0 ? new Date() : credit.usedAt,
          status: newBalance === 0 ? 'used' : 'active',
        })
        .where(eq(creditLedger.id, credit.id));

      // Record transaction
      await executor.insert(creditTransactions).values({
        creditLedgerId: credit.id,
        amount: (-amountToApply).toString(), // Negative for usage
        invoiceId,
        description: `Applied to invoice #${invoiceId}`,
        transactionType: 'applied',
        balanceBefore: currentBalance.toString(),
        balanceAfter: newBalance.toString(),
      });

      totalApplied += amountToApply;
      amountRemaining -= amountToApply;

      console.log(`[CREDIT LEDGER] Applied $${amountToApply} from credit ${credit.id} to invoice ${invoiceId} (new balance: $${newBalance})`);
    }

    // Calculate remaining balance across all credits (within same transaction)
    const remainingBalance = await getCreditBalance(customerId, executor);

    return {
      success: true,
      amountApplied: totalApplied,
      remainingBalance,
    };
  } catch (error) {
    console.error('[CREDIT LEDGER] Error applying credit:', error);
    throw error;
  }
}

/**
 * Get all active credits for a customer (with lazy expiration)
 * Filters out expired credits and optionally updates their status
 */
export async function getActiveCredits(
  customerId: number,
  updateExpired: boolean = false,
  executor: DbExecutor = db
): Promise<CreditLedger[]> {
  try {
    // Fetch all credits
    const credits = await executor
      .select()
      .from(creditLedger)
      .where(
        and(
          eq(creditLedger.customerId, customerId),
          eq(creditLedger.status, 'active')
        )
      )
      .orderBy(
        sql`${creditLedger.expiresAt} NULLS LAST`,
        creditLedger.issuedAt
      );

    // Filter out expired credits (lazy expiration)
    const now = new Date();
    const activeCredits: CreditLedger[] = [];
    const expiredCreditIds: number[] = [];

    for (const credit of credits) {
      if (credit.expiresAt && credit.expiresAt < now) {
        expiredCreditIds.push(credit.id);
      } else {
        activeCredits.push(credit);
      }
    }

    // Optionally update expired credits in database
    if (updateExpired && expiredCreditIds.length > 0) {
      await executor
        .update(creditLedger)
        .set({ 
          status: 'expired', 
          currentBalance: '0',  // CRITICAL: Zero out balance to prevent re-application
          usedAt: new Date() 
        })
        .where(sql`${creditLedger.id} = ANY(${expiredCreditIds})`);

      // Log expiration transactions
      for (const creditId of expiredCreditIds) {
        const credit = credits.find(c => c.id === creditId);
        if (credit) {
          await executor.insert(creditTransactions).values({
            creditLedgerId: creditId,
            amount: `-${credit.currentBalance}`,  // Negative amount to reflect zeroing
            description: 'Credit expired',
            transactionType: 'expired',
            balanceBefore: credit.currentBalance,
            balanceAfter: '0',
          });
        }
      }

      console.log(`[CREDIT LEDGER] Expired ${expiredCreditIds.length} credits for customer ${customerId}`);
    }

    return activeCredits;
  } catch (error) {
    console.error('[CREDIT LEDGER] Error getting active credits:', error);
    return [];
  }
}

/**
 * Get total credit balance for a customer (active credits only)
 */
export async function getCreditBalance(customerId: number, executor: DbExecutor = db): Promise<number> {
  try {
    const activeCredits = await getActiveCredits(customerId, false, executor);
    
    return activeCredits.reduce((total, credit) => {
      return total + parseFloat(credit.currentBalance);
    }, 0);
  } catch (error) {
    console.error('[CREDIT LEDGER] Error getting credit balance:', error);
    return 0;
  }
}

/**
 * Expire old credits (for cron job)
 * Returns number of credits expired
 */
export async function expireCredits(): Promise<number> {
  try {
    // Find all active credits that have expired
    const expiredCredits = await db
      .select()
      .from(creditLedger)
      .where(
        and(
          eq(creditLedger.status, 'active'),
          sql`${creditLedger.expiresAt} IS NOT NULL`,
          sql`${creditLedger.expiresAt} < NOW()`
        )
      );

    if (expiredCredits.length === 0) {
      return 0;
    }

    // Update status to expired and zero out balance
    const expiredIds = expiredCredits.map(c => c.id);
    await db
      .update(creditLedger)
      .set({ 
        status: 'expired', 
        currentBalance: '0',  // CRITICAL: Zero out balance to prevent re-application
        usedAt: new Date() 
      })
      .where(sql`${creditLedger.id} = ANY(${expiredIds})`);

    // Log expiration transactions
    for (const credit of expiredCredits) {
      await db.insert(creditTransactions).values({
        creditLedgerId: credit.id,
        amount: `-${credit.currentBalance}`,  // Negative amount to reflect zeroing
        description: 'Credit expired (scheduled job)',
        transactionType: 'expired',
        balanceBefore: credit.currentBalance,
        balanceAfter: '0',
      });
    }

    console.log(`[CREDIT LEDGER] Expired ${expiredCredits.length} credits`);
    return expiredCredits.length;
  } catch (error) {
    console.error('[CREDIT LEDGER] Error expiring credits:', error);
    return 0;
  }
}
