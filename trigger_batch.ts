import { db } from './server/db';
import { wrapTenantDb } from './server/tenantDb';
import { runPortRecoveryBatch } from './server/services/portRecoveryService';

async function triggerBatches() {
  console.log('Starting batch sends for campaign 36...');
  
  const tenantDb = wrapTenantDb(db, '1');
  
  // Send batches of 100 until done
  let batchNum = 0;
  let remaining = 1532;
  
  while (remaining > 0 && batchNum < 20) {
    batchNum++;
    console.log(`\n--- Batch ${batchNum} ---`);
    try {
      const result = await runPortRecoveryBatch(tenantDb, 36, 100);
      console.log('SMS sent:', result.smsSent, 'Points:', result.pointsGranted, 'Remaining:', remaining - result.processed);
      remaining = remaining - result.processed;
      if (result.isComplete) {
        console.log('All targets sent!');
        break;
      }
    } catch (e: any) {
      console.error('Batch error:', e.message);
      break;
    }
  }
}

triggerBatches().then(() => {
  console.log('\nDone');
  process.exit(0);
}).catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
