/**
 * Test multi-tenant isolation - verify tenants don't overwrite each other's data
 */
import { bootstrapIndustryAiAndMessaging } from '../server/industryAiBootstrapService';
import { getBootstrapDataForIndustry } from '../server/industryBootstrapData';
import { db } from '../server/db';
import { aiBehaviorRules, faqEntries, tenantConfig } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

async function testMultiTenantIsolation() {
  const tenant1Id = 'test-tenant-1';
  const tenant2Id = 'test-tenant-2';
  const industryId = 'auto_detailing_mobile';

  console.log(`\n=== TESTING MULTI-TENANT ISOLATION ===`);
  console.log(`This test verifies that two tenants can have the same rule_key/FAQ`);
  console.log(`without overwriting each other's data.`);
  console.log('=========================================\n');

  // Note: We don't need to create full tenant records for this test
  // We're just testing that the bootstrap service correctly isolates tenant data
  console.log(`📝 Testing with tenants: ${tenant1Id}, ${tenant2Id}\n`);

  // Get bootstrap data
  const bootstrapData = getBootstrapDataForIndustry(industryId);
  
  if (!bootstrapData) {
    console.error(`❌ No bootstrap data found for industry: ${industryId}`);
    process.exit(1);
  }

  // Bootstrap tenant 1
  console.log(`🚀 Bootstrapping tenant 1: ${tenant1Id}...`);
  const result1 = await bootstrapIndustryAiAndMessaging(tenant1Id, industryId, bootstrapData);
  
  if (!result1.success) {
    console.error(`❌ Tenant 1 bootstrap failed:`, result1.error);
    process.exit(1);
  }

  console.log(`✅ Tenant 1 bootstrapped:`, JSON.stringify(result1.summary, null, 2));

  // Bootstrap tenant 2
  console.log(`\n🚀 Bootstrapping tenant 2: ${tenant2Id}...`);
  const result2 = await bootstrapIndustryAiAndMessaging(tenant2Id, industryId, bootstrapData);
  
  if (!result2.success) {
    console.error(`❌ Tenant 2 bootstrap failed:`, result2.error);
    process.exit(1);
  }

  console.log(`✅ Tenant 2 bootstrapped:`, JSON.stringify(result2.summary, null, 2));

  // Verify isolation
  console.log(`\n🔍 Verifying multi-tenant isolation...\n`);

  // Check tenant 1 data
  const tenant1Rules = await db.select().from(aiBehaviorRules).where(eq(aiBehaviorRules.tenantId, tenant1Id));
  const tenant1Faqs = await db.select().from(faqEntries).where(eq(faqEntries.tenantId, tenant1Id));

  console.log(`Tenant 1 (${tenant1Id}):`);
  console.log(`   - AI Rules: ${tenant1Rules.length} records`);
  console.log(`   - FAQ Entries: ${tenant1Faqs.length} records`);

  // Check tenant 2 data
  const tenant2Rules = await db.select().from(aiBehaviorRules).where(eq(aiBehaviorRules.tenantId, tenant2Id));
  const tenant2Faqs = await db.select().from(faqEntries).where(eq(faqEntries.tenantId, tenant2Id));

  console.log(`\nTenant 2 (${tenant2Id}):`);
  console.log(`   - AI Rules: ${tenant2Rules.length} records`);
  console.log(`   - FAQ Entries: ${tenant2Faqs.length} records`);

  // Verify counts match expected
  const expectedRules = bootstrapData.aiRules.length;
  const expectedFaqs = bootstrapData.faqEntries.length;

  if (tenant1Rules.length !== expectedRules || tenant2Rules.length !== expectedRules) {
    console.error(`\n❌ ISOLATION FAILURE: Expected ${expectedRules} AI rules per tenant`);
    console.error(`   Tenant 1: ${tenant1Rules.length}, Tenant 2: ${tenant2Rules.length}`);
    process.exit(1);
  }

  if (tenant1Faqs.length !== expectedFaqs || tenant2Faqs.length !== expectedFaqs) {
    console.error(`\n❌ ISOLATION FAILURE: Expected ${expectedFaqs} FAQs per tenant`);
    console.error(`   Tenant 1: ${tenant1Faqs.length}, Tenant 2: ${tenant2Faqs.length}`);
    process.exit(1);
  }

  // Verify no cross-contamination (check that rule_keys are the same but tenant_id is different)
  const sharedRuleKey = 'system_prompt';
  const tenant1Rule = await db.select().from(aiBehaviorRules).where(
    and(
      eq(aiBehaviorRules.tenantId, tenant1Id),
      eq(aiBehaviorRules.ruleKey, sharedRuleKey)
    )
  );

  const tenant2Rule = await db.select().from(aiBehaviorRules).where(
    and(
      eq(aiBehaviorRules.tenantId, tenant2Id),
      eq(aiBehaviorRules.ruleKey, sharedRuleKey)
    )
  );

  if (tenant1Rule.length === 0 || tenant2Rule.length === 0) {
    console.error(`\n❌ ISOLATION FAILURE: Both tenants should have rule_key='${sharedRuleKey}'`);
    console.error(`   Tenant 1: ${tenant1Rule.length}, Tenant 2: ${tenant2Rule.length}`);
    process.exit(1);
  }

  if (tenant1Rule[0].id === tenant2Rule[0].id) {
    console.error(`\n❌ ISOLATION FAILURE: Tenants sharing the same database record!`);
    console.error(`   Tenant 1 ID: ${tenant1Rule[0].id}, Tenant 2 ID: ${tenant2Rule[0].id}`);
    process.exit(1);
  }

  console.log(`\n✅ MULTI-TENANT ISOLATION VERIFIED!`);
  console.log(`   - Each tenant has ${expectedRules} AI rules and ${expectedFaqs} FAQs`);
  console.log(`   - Tenants share rule_key='${sharedRuleKey}' but have different database records`);
  console.log(`   - Tenant 1 rule ID: ${tenant1Rule[0].id}`);
  console.log(`   - Tenant 2 rule ID: ${tenant2Rule[0].id}`);

  // Cleanup test data
  console.log(`\n🧹 Cleaning up test data...\n`);
  
  await db.delete(aiBehaviorRules).where(eq(aiBehaviorRules.tenantId, tenant1Id));
  await db.delete(aiBehaviorRules).where(eq(aiBehaviorRules.tenantId, tenant2Id));
  await db.delete(faqEntries).where(eq(faqEntries.tenantId, tenant1Id));
  await db.delete(faqEntries).where(eq(faqEntries.tenantId, tenant2Id));

  console.log(`✅ Multi-tenant isolation test complete!\n`);
  process.exit(0);
}

testMultiTenantIsolation().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
