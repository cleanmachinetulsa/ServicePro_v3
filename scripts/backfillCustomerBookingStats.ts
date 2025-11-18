#!/usr/bin/env tsx
/**
 * Backfill Customer Booking Stats
 * 
 * This script recalculates booking statistics for all customers in the database:
 * - totalAppointments: Count of all non-cancelled appointments
 * - isReturningCustomer: True if customer has at least one completed appointment
 * - firstAppointmentAt: Timestamp of first appointment
 * - lastAppointmentAt: Timestamp of most recent appointment
 * 
 * Usage:
 *   tsx scripts/backfillCustomerBookingStats.ts
 * 
 * Options:
 *   --batch-size <number>  Process customers in batches (default: 50)
 *   --dry-run              Show what would be updated without making changes
 */

import { db } from '../server/db';
import { customers } from '@shared/schema';
import { recalcCustomerAppointmentStats, batchRecalcCustomerStats } from '../server/customerBookingStats';

interface BackfillOptions {
  batchSize: number;
  dryRun: boolean;
}

interface BackfillStats {
  totalCustomers: number;
  processed: number;
  successful: number;
  failed: number;
  skipped: number;
  errors: Array<{ customerId: number; error: string }>;
  startTime: Date;
  endTime?: Date;
}

/**
 * Parse command line arguments
 */
function parseArgs(): BackfillOptions {
  const args = process.argv.slice(2);
  const options: BackfillOptions = {
    batchSize: 50,
    dryRun: false,
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--batch-size' && args[i + 1]) {
      options.batchSize = parseInt(args[i + 1]);
      i++;
    } else if (args[i] === '--dry-run') {
      options.dryRun = true;
    }
  }

  return options;
}

/**
 * Display progress bar
 */
function displayProgress(current: number, total: number, stats: BackfillStats): void {
  const percentage = Math.floor((current / total) * 100);
  const barLength = 40;
  const filledLength = Math.floor(barLength * (current / total));
  const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);
  
  const elapsed = Date.now() - stats.startTime.getTime();
  const rate = current / (elapsed / 1000);
  const eta = total > current ? Math.floor((total - current) / rate) : 0;
  
  process.stdout.write(`\r${bar} ${percentage}% | ${current}/${total} | ` +
    `✓ ${stats.successful} | ✗ ${stats.failed} | ` +
    `ETA: ${eta}s`);
}

/**
 * Main backfill function
 */
async function backfillCustomerBookingStats(options: BackfillOptions): Promise<void> {
  console.log('🔄 Customer Booking Stats Backfill Script');
  console.log('=========================================\n');
  
  if (options.dryRun) {
    console.log('⚠️  DRY RUN MODE - No changes will be made\n');
  }
  
  console.log(`Configuration:`);
  console.log(`  Batch Size: ${options.batchSize}`);
  console.log(`  Dry Run: ${options.dryRun}\n`);
  
  const stats: BackfillStats = {
    totalCustomers: 0,
    processed: 0,
    successful: 0,
    failed: 0,
    skipped: 0,
    errors: [],
    startTime: new Date(),
  };
  
  try {
    // Step 1: Fetch all customers
    console.log('📊 Fetching all customers from database...');
    const allCustomers = await db.select({
      id: customers.id,
      name: customers.name,
      totalAppointments: customers.totalAppointments,
      isReturningCustomer: customers.isReturningCustomer,
    }).from(customers);
    
    stats.totalCustomers = allCustomers.length;
    console.log(`✓ Found ${stats.totalCustomers} customers\n`);
    
    if (stats.totalCustomers === 0) {
      console.log('⚠️  No customers found. Nothing to backfill.');
      return;
    }
    
    // Step 2: Process customers in batches
    console.log(`🔄 Processing customers in batches of ${options.batchSize}...\n`);
    
    for (let i = 0; i < allCustomers.length; i += options.batchSize) {
      const batch = allCustomers.slice(i, i + options.batchSize);
      const customerIds = batch.map(c => c.id);
      
      if (options.dryRun) {
        // In dry run mode, just log what would be processed
        console.log(`[DRY RUN] Would process batch ${Math.floor(i / options.batchSize) + 1}:`, {
          customers: batch.length,
          ids: customerIds.slice(0, 5),
          more: customerIds.length > 5 ? `... and ${customerIds.length - 5} more` : '',
        });
        stats.processed += batch.length;
        stats.successful += batch.length;
      } else {
        // Process the batch
        const batchResults = await batchRecalcCustomerStats(customerIds);
        
        stats.processed += batch.length;
        stats.successful += batchResults.success;
        stats.failed += batchResults.failed;
        stats.errors.push(...batchResults.errors);
      }
      
      // Display progress
      displayProgress(stats.processed, stats.totalCustomers, stats);
      
      // Small delay to avoid overwhelming the database
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    stats.endTime = new Date();
    
    // Clear progress bar
    console.log('\n');
    
    // Step 3: Display summary
    console.log('\n✅ Backfill Complete!');
    console.log('====================\n');
    
    const duration = Math.floor((stats.endTime.getTime() - stats.startTime.getTime()) / 1000);
    
    console.log('Summary:');
    console.log(`  Total Customers: ${stats.totalCustomers}`);
    console.log(`  Processed: ${stats.processed}`);
    console.log(`  Successful: ${stats.successful} ✓`);
    console.log(`  Failed: ${stats.failed} ✗`);
    console.log(`  Skipped: ${stats.skipped}`);
    console.log(`  Duration: ${duration}s`);
    console.log(`  Rate: ${(stats.processed / duration).toFixed(2)} customers/sec\n`);
    
    // Step 4: Display errors if any
    if (stats.errors.length > 0) {
      console.log('❌ Errors:');
      console.log('--------');
      stats.errors.slice(0, 10).forEach(({ customerId, error }) => {
        console.log(`  Customer ${customerId}: ${error}`);
      });
      
      if (stats.errors.length > 10) {
        console.log(`  ... and ${stats.errors.length - 10} more errors\n`);
      }
    }
    
    // Step 5: Sample results
    if (!options.dryRun && stats.successful > 0) {
      console.log('📊 Sample Results (first 5 customers):');
      console.log('-------------------------------------');
      
      const sampleCustomers = await db.select({
        id: customers.id,
        name: customers.name,
        totalAppointments: customers.totalAppointments,
        isReturningCustomer: customers.isReturningCustomer,
        firstAppointmentAt: customers.firstAppointmentAt,
        lastAppointmentAt: customers.lastAppointmentAt,
      })
      .from(customers)
      .limit(5);
      
      sampleCustomers.forEach(customer => {
        console.log(`\n  Customer: ${customer.name} (ID: ${customer.id})`);
        console.log(`    Total Appointments: ${customer.totalAppointments}`);
        console.log(`    Returning Customer: ${customer.isReturningCustomer ? 'Yes' : 'No'}`);
        console.log(`    First Appointment: ${customer.firstAppointmentAt ? new Date(customer.firstAppointmentAt).toLocaleDateString() : 'N/A'}`);
        console.log(`    Last Appointment: ${customer.lastAppointmentAt ? new Date(customer.lastAppointmentAt).toLocaleDateString() : 'N/A'}`);
      });
      
      console.log('\n');
    }
    
    // Step 6: Recommendations
    if (stats.failed > 0) {
      console.log('💡 Recommendations:');
      console.log('  - Review error messages above to identify issues');
      console.log('  - Fix any data integrity issues in the database');
      console.log('  - Re-run the script to process failed customers\n');
    }
    
    if (options.dryRun) {
      console.log('💡 Next Steps:');
      console.log('  - Review the output above');
      console.log('  - Run without --dry-run flag to apply changes');
      console.log('  - Command: tsx scripts/backfillCustomerBookingStats.ts\n');
    } else {
      console.log('✅ All customer booking stats have been updated!');
      console.log('   The system will now automatically track stats for new bookings.\n');
    }
    
  } catch (error) {
    console.error('\n❌ Fatal error during backfill:', error);
    process.exit(1);
  }
}

/**
 * Main entry point
 */
async function main() {
  const options = parseArgs();
  
  try {
    await backfillCustomerBookingStats(options);
    process.exit(0);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Run the script
main();
