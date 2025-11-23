/**
 * Quick test script to verify industry AI & messaging bootstrap works
 */
import { bootstrapIndustryAiAndMessaging } from '../server/industryAiBootstrapService';
import { getBootstrapDataForIndustry } from '../server/industryBootstrapData';
import { db } from '../server/db';
import { aiBehaviorRules, smsTemplates, faqEntries } from '@shared/schema';
import { eq } from 'drizzle-orm';

async function testBootstrap() {
  const tenantId = 'root'; // Test with root tenant
  const industryId = 'auto_detailing_mobile';

  console.log(`\n=== TESTING INDUSTRY BOOTSTRAP ===`);
  console.log(`Tenant: ${tenantId}`);
  console.log(`Industry: ${industryId}`);
  console.log('==================================\n');

  // Get bootstrap data
  const bootstrapData = getBootstrapDataForIndustry(industryId);
  
  if (!bootstrapData) {
    console.error(`❌ No bootstrap data found for industry: ${industryId}`);
    process.exit(1);
  }

  console.log(`📦 Bootstrap data found:`);
  console.log(`   - AI Rules: ${bootstrapData.aiRules.length}`);
  console.log(`   - SMS Templates: ${bootstrapData.smsTemplates.length}`);
  console.log(`   - FAQ Entries: ${bootstrapData.faqEntries.length}\n`);

  // Run bootstrap
  console.log(`🚀 Running bootstrap...\n`);
  const result = await bootstrapIndustryAiAndMessaging(tenantId, industryId, bootstrapData);

  if (!result.success) {
    console.error(`❌ Bootstrap failed:`, result.error);
    process.exit(1);
  }

  console.log(`✅ Bootstrap successful!\n`);
  console.log(`Summary:`, JSON.stringify(result.summary, null, 2));

  // Verify data in database
  console.log(`\n🔍 Verifying data in database...\n`);

  const rules = await db.select().from(aiBehaviorRules).where(eq(aiBehaviorRules.tenantId, tenantId));
  console.log(`   AI Behavior Rules: ${rules.length} records`);
  rules.forEach(rule => console.log(`      - ${rule.name} (${rule.category})`));

  const templates = await db.select().from(smsTemplates).where(eq(smsTemplates.tenantId, tenantId));
  console.log(`\n   SMS Templates: ${templates.length} records`);
  templates.forEach(template => console.log(`      - ${template.name} (${template.category})`));

  const faqs = await db.select().from(faqEntries).where(eq(faqEntries.tenantId, tenantId));
  console.log(`\n   FAQ Entries: ${faqs.length} records`);
  faqs.forEach(faq => console.log(`      - ${faq.question.substring(0, 50)}... (${faq.category})`));

  console.log(`\n✅ Test complete!\n`);
  process.exit(0);
}

testBootstrap().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
