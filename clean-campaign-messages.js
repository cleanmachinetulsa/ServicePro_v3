import fs from "fs";

/* ===================== CONFIG ===================== */

const INPUT_FILE = "conversations.json";
const OUTPUT_JSON = "conversations.cleaned.json";
const OUTPUT_TXT = "conversations.cleaned.txt";

// Phrase that DEFINES a campaign blast
const CAMPAIGN_PHRASE = "reply stop to unsubscribe";

/* ================================================ */

const raw = JSON.parse(fs.readFileSync(INPUT_FILE, "utf-8"));

let removedCount = 0;
let keptCount = 0;

const cleaned = {};

for (const customer in raw) {
  const messages = raw[customer];

  const filtered = messages.filter(msg => {
    const body = (msg.body || "").toLowerCase();

    const isOutbound =
      msg.direction && !msg.direction.startsWith("inbound");

    const isCampaign =
      isOutbound && body.includes(CAMPAIGN_PHRASE);

    if (isCampaign) {
      removedCount++;
      return false;
    }

    keptCount++;
    return true;
  });

  if (filtered.length > 0) {
    cleaned[customer] = filtered;
  }
}

/* ---------- WRITE JSON ---------- */
fs.writeFileSync(
  OUTPUT_JSON,
  JSON.stringify(cleaned, null, 2)
);

/* ---------- WRITE TXT ---------- */
let txt = "";
for (const customer in cleaned) {
  txt += `\nCustomer: ${customer}\n`;
  txt += "--------------------------------\n";

  cleaned[customer].forEach(m => {
    const who = m.direction?.startsWith("inbound") ? "THEM" : "YOU";
    txt += `[${new Date(m.date).toLocaleString()}] ${who}: ${m.body}\n`;
  });
}

fs.writeFileSync(OUTPUT_TXT, txt);

/* ---------- SUMMARY ---------- */
console.log("🧹 Campaign cleanup complete");
console.log(`❌ Removed campaign messages: ${removedCount}`);
console.log(`✅ Kept conversational messages: ${keptCount}`);
console.log(`📄 ${OUTPUT_JSON}`);
console.log(`📄 ${OUTPUT_TXT}`);
