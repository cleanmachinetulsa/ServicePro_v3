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
    
    select: db.select.bind(db),
    
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
    
    execute: db.execute.bind(db),
  };
}

export function wrapTenantDb(database: typeof db, tenantId: string): TenantDb {
  const tenantInfo: TenantInfo = { id: tenantId, name: tenantId };
  const tenantDb = createTenantDb(tenantInfo);
  
  return {
    ...tenantDb,
    execute: (...args: any[]) => (database as any).execute(...args),
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
