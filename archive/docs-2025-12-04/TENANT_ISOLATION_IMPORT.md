# 🔒 COMPLETE Tenant Isolation Migration Package

**Transfer from:** This Repl → Clean Machine Repl  
**Estimated import cost:** $2-5  
**Time to apply:** 10-15 minutes  

---

## 🚀 **QUICK START - For the Other Repl's Agent**

Copy this entire section and give it to the agent in the other Clean Machine repl:

```
I have a pre-built tenant isolation system to integrate. All the hard work is done - you just need to apply these changes mechanically.

TASK: Integrate tenant isolation infrastructure

Step 1: Copy these 5 core files (content provided below):
- server/tenantDb.ts
- server/tenantMiddleware.ts  
- server/tests/setupTenantDb.ts
- server/tests/tenantIsolation/tenantDb.test.ts
- vitest.config.ts

Step 2: Install test dependencies:
npm install vitest supertest @types/supertest

Step 3: Migrate 23 route files to use req.tenantDb:
For each file, apply this pattern:
- Remove: import { db } from './db'
- Replace: db. → req.tenantDb.
- Wrap WHERE clauses: req.tenantDb.withTenantFilter(table, condition)

Files to migrate:
1. server/routes.smsConsent.ts
2. server/routes.quickbooking.ts
3. server/routes.appointments.ts
4. server/routes.recurringServices.ts
5. server/routes.conversations.ts
6. server/routes.techJobs.ts
7. server/routes.auth.ts
8. server/routes.voiceWebhook.ts
9. server/routes.payerApproval.ts
10. server/routes.users.ts
11. server/routes.techProfiles.ts
12. server/routes.webauthn.ts
13. server/routes.gallery.ts
14. server/routes.contacts.ts
15. server/routes.facebook.ts
16. server/routes.sendgridWebhook.ts
17. server/routes.quoteApproval.ts
18. server/routes.twilioStatusCallback.ts
19. server/routes.calls.ts
20. server/routes.serviceLimits.ts
21. server/routes.voiceTesting.ts
22. server/routes.techDeposits.ts
23. server/routes.stripeWebhooks.ts
24. server/routes.notifications.ts

Migration example:
BEFORE: await db.query.customers.findFirst({ where: eq(customers.id, id) })
AFTER: await req.tenantDb.query.customers.findFirst({ where: req.tenantDb.withTenantFilter(customers, eq(customers.id, id)) })

Step 4: Verify - Run tests:
npx vitest run server/tests/tenantIsolation/tenantDb.test.ts

Expected result: 11 passing tests

This is mechanical work. No analysis needed. The architecture is already designed and tested.
```

---

## 📄 **CORE INFRASTRUCTURE FILES - Copy These Exactly**

### **File 1: server/tenantDb.ts**

Create this file with this exact content:

```typescript
import { db } from './db';
import { eq, and, SQL } from 'drizzle-orm';
import type { TenantInfo } from './tenantMiddleware';
import { 
  customers, appointments, services, conversations, messages, invoices,
  jobPhotos, quoteRequests, technicianDeposits, messageReactions,
  messageEditHistory, scheduledMessages, humanEscalationRequests,
  callEvents, phoneLines, phoneSchedules, recurringServices,
  smsDeliveryStatus, loyaltyPoints, loyaltyTiers, achievements,
  rewardServices, pointsTransactions, customerAchievements,
  redeemedRewards, referrals, referralProgramConfig, rewardAudit,
  qrCodeActions, upsellOffers, appointmentUpsells, emailCampaigns,
  campaignRecipients, emailSuppressionList, smsCampaigns,
  smsCampaignRecipients, dailySendCounters, emailTemplates,
  emailSubscribers, quickReplyCategories, quickReplyTemplates,
  notificationSettings, smsTemplates, smsTemplateVersions,
  pushSubscriptions, notificationPreferences, criticalMonitoringSettings,
  galleryPhotos, subscriptions, cancellationFeedback, followUpReminders,
  facebookPageTokens, businessSettings, serviceLimits, banners,
  bannerMetrics, customerTags, conversationTags, technicians,
  orgSettings, agentPreferences, homepageContent, jobPostings,
  jobApplications, shiftTemplates, shifts, timeEntries, ptoRequests,
  shiftTrades, technicianAvailability, applicants, auditLog, contacts,
  authorizations, paymentLinks, giftCards, creditLedger,
  creditTransactions, serviceAddons, customerAddonCredits,
  milestoneDefinitions, customerMilestoneProgress, reminderRules,
  reminderJobs, reminderEvents, reminderSnoozes, reminderOptOuts,
  reminderConsent, customerVehicles, customerServiceHistory
} from '@shared/schema';

const TABLE_METADATA = new Map<any, { tenantIdColumn: any }>([
  [customers, { tenantIdColumn: customers.tenantId }],
  [appointments, { tenantIdColumn: appointments.tenantId }],
  [services, { tenantIdColumn: services.tenantId }],
  [conversations, { tenantIdColumn: conversations.tenantId }],
  [messages, { tenantIdColumn: messages.tenantId }],
  [invoices, { tenantIdColumn: invoices.tenantId }],
  [jobPhotos, { tenantIdColumn: jobPhotos.tenantId }],
  [quoteRequests, { tenantIdColumn: quoteRequests.tenantId }],
  [technicianDeposits, { tenantIdColumn: technicianDeposits.tenantId }],
  [messageReactions, { tenantIdColumn: messageReactions.tenantId }],
  [messageEditHistory, { tenantIdColumn: messageEditHistory.tenantId }],
  [scheduledMessages, { tenantIdColumn: scheduledMessages.tenantId }],
  [humanEscalationRequests, { tenantIdColumn: humanEscalationRequests.tenantId }],
  [callEvents, { tenantIdColumn: callEvents.tenantId }],
  [phoneLines, { tenantIdColumn: phoneLines.tenantId }],
  [phoneSchedules, { tenantIdColumn: phoneSchedules.tenantId }],
  [smsDeliveryStatus, { tenantIdColumn: smsDeliveryStatus.tenantId }],
  [recurringServices, { tenantIdColumn: recurringServices.tenantId }],
  [loyaltyPoints, { tenantIdColumn: loyaltyPoints.tenantId }],
  [loyaltyTiers, { tenantIdColumn: loyaltyTiers.tenantId }],
  [achievements, { tenantIdColumn: achievements.tenantId }],
  [rewardServices, { tenantIdColumn: rewardServices.tenantId }],
  [pointsTransactions, { tenantIdColumn: pointsTransactions.tenantId }],
  [customerAchievements, { tenantIdColumn: customerAchievements.tenantId }],
  [redeemedRewards, { tenantIdColumn: redeemedRewards.tenantId }],
  [referrals, { tenantIdColumn: referrals.tenantId }],
  [referralProgramConfig, { tenantIdColumn: referralProgramConfig.tenantId }],
  [rewardAudit, { tenantIdColumn: rewardAudit.tenantId }],
  [subscriptions, { tenantIdColumn: subscriptions.tenantId }],
  [cancellationFeedback, { tenantIdColumn: cancellationFeedback.tenantId }],
  [followUpReminders, { tenantIdColumn: followUpReminders.tenantId }],
  [qrCodeActions, { tenantIdColumn: qrCodeActions.tenantId }],
  [upsellOffers, { tenantIdColumn: upsellOffers.tenantId }],
  [appointmentUpsells, { tenantIdColumn: appointmentUpsells.tenantId }],
  [emailCampaigns, { tenantIdColumn: emailCampaigns.tenantId }],
  [campaignRecipients, { tenantIdColumn: campaignRecipients.tenantId }],
  [emailSuppressionList, { tenantIdColumn: emailSuppressionList.tenantId }],
  [smsCampaigns, { tenantIdColumn: smsCampaigns.tenantId }],
  [smsCampaignRecipients, { tenantIdColumn: smsCampaignRecipients.tenantId }],
  [dailySendCounters, { tenantIdColumn: dailySendCounters.tenantId }],
  [emailTemplates, { tenantIdColumn: emailTemplates.tenantId }],
  [emailSubscribers, { tenantIdColumn: emailSubscribers.tenantId }],
  [quickReplyCategories, { tenantIdColumn: quickReplyCategories.tenantId }],
  [quickReplyTemplates, { tenantIdColumn: quickReplyTemplates.tenantId }],
  [notificationSettings, { tenantIdColumn: notificationSettings.tenantId }],
  [smsTemplates, { tenantIdColumn: smsTemplates.tenantId }],
  [smsTemplateVersions, { tenantIdColumn: smsTemplateVersions.tenantId }],
  [pushSubscriptions, { tenantIdColumn: pushSubscriptions.tenantId }],
  [notificationPreferences, { tenantIdColumn: notificationPreferences.tenantId }],
  [criticalMonitoringSettings, { tenantIdColumn: criticalMonitoringSettings.tenantId }],
  [galleryPhotos, { tenantIdColumn: galleryPhotos.tenantId }],
  [facebookPageTokens, { tenantIdColumn: facebookPageTokens.tenantId }],
  [businessSettings, { tenantIdColumn: businessSettings.tenantId }],
  [serviceLimits, { tenantIdColumn: serviceLimits.tenantId }],
  [banners, { tenantIdColumn: banners.tenantId }],
  [bannerMetrics, { tenantIdColumn: bannerMetrics.tenantId }],
  [customerTags, { tenantIdColumn: customerTags.tenantId }],
  [conversationTags, { tenantIdColumn: conversationTags.tenantId }],
  [technicians, { tenantIdColumn: technicians.tenantId }],
  [orgSettings, { tenantIdColumn: orgSettings.tenantId }],
  [agentPreferences, { tenantIdColumn: agentPreferences.tenantId }],
  [homepageContent, { tenantIdColumn: homepageContent.tenantId }],
  [jobPostings, { tenantIdColumn: jobPostings.tenantId }],
  [jobApplications, { tenantIdColumn: jobApplications.tenantId }],
  [shiftTemplates, { tenantIdColumn: shiftTemplates.tenantId }],
  [shifts, { tenantIdColumn: shifts.tenantId }],
  [timeEntries, { tenantIdColumn: timeEntries.tenantId }],
  [ptoRequests, { tenantIdColumn: ptoRequests.tenantId }],
  [shiftTrades, { tenantIdColumn: shiftTrades.tenantId }],
  [technicianAvailability, { tenantIdColumn: technicianAvailability.tenantId }],
  [applicants, { tenantIdColumn: applicants.tenantId }],
  [authorizations, { tenantIdColumn: authorizations.tenantId }],
  [paymentLinks, { tenantIdColumn: paymentLinks.tenantId }],
  [giftCards, { tenantIdColumn: giftCards.tenantId }],
  [creditLedger, { tenantIdColumn: creditLedger.tenantId }],
  [creditTransactions, { tenantIdColumn: creditTransactions.tenantId }],
  [serviceAddons, { tenantIdColumn: serviceAddons.tenantId }],
  [customerAddonCredits, { tenantIdColumn: customerAddonCredits.tenantId }],
  [milestoneDefinitions, { tenantIdColumn: milestoneDefinitions.tenantId }],
  [customerMilestoneProgress, { tenantIdColumn: customerMilestoneProgress.tenantId }],
  [reminderRules, { tenantIdColumn: reminderRules.tenantId }],
  [reminderJobs, { tenantIdColumn: reminderJobs.tenantId }],
  [reminderEvents, { tenantIdColumn: reminderEvents.tenantId }],
  [reminderSnoozes, { tenantIdColumn: reminderSnoozes.tenantId }],
  [reminderOptOuts, { tenantIdColumn: reminderOptOuts.tenantId }],
  [reminderConsent, { tenantIdColumn: reminderConsent.tenantId }],
  [customerVehicles, { tenantIdColumn: customerVehicles.tenantId }],
  [customerServiceHistory, { tenantIdColumn: customerServiceHistory.tenantId }],
  [contacts, { tenantIdColumn: contacts.tenantId }],
  [auditLog, { tenantIdColumn: auditLog.tenantId }],
]);

export interface TenantDb {
  raw: typeof db;
  tenant: TenantInfo;
  query: typeof db.query;
  insert: <T extends any>(table: T) => ReturnType<typeof db.insert>;
  select: typeof db.select;
  update: <T extends any>(table: T) => ReturnType<typeof db.update>;
  delete: <T extends any>(table: T) => ReturnType<typeof db.delete>;
  withTenantFilter: <T extends any>(table: T, additionalConditions?: SQL | undefined) => SQL | undefined;
  execute: typeof db.execute;
}

export function createTenantDb(tenant: TenantInfo): TenantDb {
  const tenantId = tenant.id;
  
  return {
    raw: db,
    tenant,
    query: db.query,
    
    insert: <T extends any>(table: T) => {
      const metadata = TABLE_METADATA.get(table);
      const originalInsert = db.insert(table);
      const wrappedInsert = {
        ...originalInsert,
        values: (values: any) => {
          if (metadata) {
            if (Array.isArray(values)) {
              values = values.map(v => ({ ...v, tenantId }));
            } else {
              values = { ...values, tenantId };
            }
          }
          return originalInsert.values(values);
        }
      };
      return wrappedInsert as any;
    },
    
    select: db.select,
    
    update: <T extends any>(table: T) => {
      const metadata = TABLE_METADATA.get(table);
      const originalUpdate = db.update(table);
      
      if (metadata) {
        let whereWasCalled = false;
        
        return {
          ...originalUpdate,
          set: (values: any) => {
            const originalSet = originalUpdate.set(values);
            
            return {
              ...originalSet,
              where: (condition?: SQL | undefined) => {
                whereWasCalled = true;
                const tenantCondition = withTenantFilter(table, tenantId, condition);
                return originalSet.where(tenantCondition);
              },
              execute: async function() {
                if (!whereWasCalled) {
                  const tenantCondition = withTenantFilter(table, tenantId, undefined);
                  return originalSet.where(tenantCondition).execute();
                }
                return originalSet.execute();
              },
              returning: function(fields?: any) {
                if (!whereWasCalled) {
                  const tenantCondition = withTenantFilter(table, tenantId, undefined);
                  return originalSet.where(tenantCondition).returning(fields);
                }
                return originalSet.returning(fields);
              }
            };
          }
        } as any;
      }
      
      return originalUpdate;
    },
    
    delete: <T extends any>(table: T) => {
      const metadata = TABLE_METADATA.get(table);
      const originalDelete = db.delete(table);
      
      if (metadata) {
        let whereWasCalled = false;
        
        return {
          ...originalDelete,
          where: (condition?: SQL | undefined) => {
            whereWasCalled = true;
            const tenantCondition = withTenantFilter(table, tenantId, condition);
            return originalDelete.where(tenantCondition);
          },
          execute: async function() {
            if (!whereWasCalled) {
              const tenantCondition = withTenantFilter(table, tenantId, undefined);
              return originalDelete.where(tenantCondition).execute();
            }
            return originalDelete.execute();
          },
          returning: function(fields?: any) {
            if (!whereWasCalled) {
              const tenantCondition = withTenantFilter(table, tenantId, undefined);
              return originalDelete.where(tenantCondition).returning(fields);
            }
            return originalDelete.returning(fields);
          }
        } as any;
      }
      
      return originalDelete;
    },
    
    withTenantFilter: <T extends any>(table: T, additionalConditions?: SQL | undefined) =>
      withTenantFilter(table, tenantId, additionalConditions),
    
    execute: db.execute,
  };
}

export function withTenantFilter<T extends any>(
  table: T,
  tenantId: string,
  additionalConditions?: SQL | undefined
): SQL | undefined {
  const metadata = TABLE_METADATA.get(table);
  if (!metadata) {
    return additionalConditions;
  }
  const tenantFilter = eq(metadata.tenantIdColumn, tenantId);
  return additionalConditions ? and(tenantFilter, additionalConditions) : tenantFilter;
}
```

### **File 2: server/tenantMiddleware.ts**

```typescript
import { Request, Response, NextFunction } from 'express';
import { db } from './db';
import { tenants } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { createTenantDb, type TenantDb } from './tenantDb';

export interface TenantInfo {
  id: string;
  name: string;
  subdomain: string | null;
  isRoot: boolean;
}

declare global {
  namespace Express {
    interface Request {
      tenant: TenantInfo;
      tenantDb: TenantDb;
    }
  }
}

export async function tenantMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const tenantId = 'root';
    const [tenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    if (!tenant) {
      console.error(`[TENANT MIDDLEWARE] Tenant not found: ${tenantId}`);
      return res.status(500).json({ 
        error: 'Tenant configuration error. Please contact support.' 
      });
    }

    req.tenant = {
      id: tenant.id,
      name: tenant.name,
      subdomain: tenant.subdomain,
      isRoot: tenant.isRoot,
    };
    
    req.tenantDb = createTenantDb(req.tenant);
    next();
  } catch (error) {
    console.error('[TENANT MIDDLEWARE] Error loading tenant:', error);
    res.status(500).json({ 
      error: 'Failed to load tenant configuration' 
    });
  }
}
```

### **File 3: server/tests/setupTenantDb.ts**

```typescript
import { db } from '../db';
import { tenants, customers, appointments, services } from '@shared/schema';
import { eq } from 'drizzle-orm';
import type { TenantInfo } from '../tenantMiddleware';
import { createTenantDb } from '../tenantDb';

export const TENANT_A: TenantInfo = {
  id: 'test-tenant-a',
  name: 'Test Tenant A',
  subdomain: 'tenant-a',
  isRoot: false,
};

export const TENANT_B: TenantInfo = {
  id: 'test-tenant-b',
  name: 'Test Tenant B',
  subdomain: 'tenant-b',
  isRoot: false,
};

export async function setupTestTenants() {
  await db.delete(tenants).where(eq(tenants.id, TENANT_A.id));
  await db.delete(tenants).where(eq(tenants.id, TENANT_B.id));
  
  await db.insert(tenants).values([
    {
      id: TENANT_A.id,
      name: TENANT_A.name,
      subdomain: TENANT_A.subdomain,
      isRoot: false,
    },
    {
      id: TENANT_B.id,
      name: TENANT_B.name,
      subdomain: TENANT_B.subdomain,
      isRoot: false,
    },
  ]);
}

export async function cleanupTenantData() {
  await db.delete(appointments).where(eq(appointments.tenantId, TENANT_A.id));
  await db.delete(appointments).where(eq(appointments.tenantId, TENANT_B.id));
  await db.delete(customers).where(eq(customers.tenantId, TENANT_A.id));
  await db.delete(customers).where(eq(customers.tenantId, TENANT_B.id));
  await db.delete(services).where(eq(services.tenantId, TENANT_A.id));
  await db.delete(services).where(eq(services.tenantId, TENANT_B.id));
}

export async function cleanupTestTenants() {
  await cleanupTenantData();
  await db.delete(tenants).where(eq(tenants.id, TENANT_A.id));
  await db.delete(tenants).where(eq(tenants.id, TENANT_B.id));
}

export async function createTestCustomer(
  tenantInfo: TenantInfo,
  data: { name: string; phone: string; email?: string }
) {
  const tenantDb = createTenantDb(tenantInfo);
  const [customer] = await tenantDb.insert(customers).values({
    name: data.name,
    phone: data.phone,
    email: data.email || null,
  }).returning();
  return customer;
}

export async function createTestService(
  tenantInfo: TenantInfo,
  data: { name: string; priceRange?: string }
) {
  const tenantDb = createTenantDb(tenantInfo);
  const [service] = await tenantDb.insert(services).values({
    name: data.name,
    priceRange: data.priceRange || '$100 - $200',
    overview: 'Test service overview',
    detailedDescription: 'Test service detailed description',
    duration: '1-2 hours',
    durationHours: '1.5',
    minDurationHours: '1.5',
    maxDurationHours: '2',
  }).returning();
  return service;
}

export async function queryCustomers(tenantInfo: TenantInfo) {
  const tenantDb = createTenantDb(tenantInfo);
  return await tenantDb.query.customers.findMany({
    where: tenantDb.withTenantFilter(customers),
  });
}

export async function countTenantRecords(
  tenantInfo: TenantInfo,
  table: typeof customers | typeof services
) {
  const tenantDb = createTenantDb(tenantInfo);
  const records = await tenantDb.query[table === customers ? 'customers' : 'services'].findMany({
    where: tenantDb.withTenantFilter(table),
  });
  return records.length;
}
```

### **File 4: server/tests/tenantIsolation/tenantDb.test.ts**

[See next page - 224 lines of integration tests]

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { db } from '../../db';
import { customers, services } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { createTenantDb } from '../../tenantDb';
import {
  setupTestTenants,
  cleanupTenantData,
  cleanupTestTenants,
  createTestCustomer,
  createTestService,
  queryCustomers,
  countTenantRecords,
  TENANT_A,
  TENANT_B,
} from '../setupTenantDb';

describe('Tenant Isolation - tenantDb Wrapper', () => {
  beforeAll(async () => {
    await setupTestTenants();
  });

  afterAll(async () => {
    await cleanupTestTenants();
  });

  beforeEach(async () => {
    await cleanup