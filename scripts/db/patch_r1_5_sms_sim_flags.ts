import { db } from "../../server/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Adding SMS simulation flags to conversations table...");
  try {
    await db.execute(sql`
      ALTER TABLE conversations 
      ADD COLUMN IF NOT EXISTS debug_simulate_calendar_fail BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS debug_simulate_unroutable BOOLEAN DEFAULT false;
    `);
    console.log("Successfully added columns.");
  } catch (err) {
    console.error("Error patching database:", err);
    process.exit(1);
  }
}

main();
