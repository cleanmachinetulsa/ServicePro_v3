import { db } from './db';
import { customerTags } from '@shared/schema';
import { eq } from 'drizzle-orm';

const predefinedTags = [
  { name: 'Hot Lead', color: 'red', icon: 'Flame', isPredefined: true },
  { name: 'VIP', color: 'purple', icon: 'Crown', isPredefined: true },
  { name: 'Reschedule', color: 'yellow', icon: 'Calendar', isPredefined: true },
  { name: 'Warranty', color: 'blue', icon: 'Shield', isPredefined: true },
  { name: 'Follow-up Needed', color: 'orange', icon: 'Bell', isPredefined: true },
  { name: 'Price Sensitive', color: 'green', icon: 'DollarSign', isPredefined: true },
  { name: 'Repeat Customer', color: 'indigo', icon: 'Repeat', isPredefined: true },
  { name: 'Complaint', color: 'red', icon: 'AlertCircle', isPredefined: true },
];

async function seedTags() {
  console.log('Seeding predefined tags...');
  
  for (const tag of predefinedTags) {
    try {
      // Check if tag already exists
      const existing = await db
        .select()
        .from(customerTags)
        .where(eq(customerTags.name, tag.name))
        .limit(1);
      
      if (existing.length === 0) {
        await db.insert(customerTags).values(tag);
        console.log(`✓ Created tag: ${tag.name}`);
      } else {
        console.log(`- Tag already exists: ${tag.name}`);
      }
    } catch (error) {
      console.error(`Error creating tag ${tag.name}:`, error);
    }
  }
  
  console.log('Tag seeding complete!');
  process.exit(0);
}

seedTags();
