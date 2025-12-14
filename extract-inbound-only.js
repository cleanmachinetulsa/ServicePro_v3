import fs from "fs";

/* ===================== CONFIG ===================== */

const INPUT_FILE = "conversations.json";
const OUTPUT_JSON = "conversations.inbound-only.json";
const OUTPUT_TXT = "conversations.inbound-only.txt";

/* ================================================ */

const raw = JSON.parse(fs.readFileSync(INPUT_FILE, "utf-8"));

let keptCount = 0;
let skippedStopCount = 0;

const inboundOnly = {};

for (const customer in raw) {
  const messages = raw[customer];

  const filtered = messages.filter(msg => {
    if (!msg.direction || !msg.direction.startsWith("inbound")) {
      return false;
    }

    const body = (msg.body || "").trim();

    // Skip messages that are ONLY "STOP" (case-insensitive)
    if (body.toUpperCase() === "STOP") {
      skippedStopCount++;
      return false;
    }

    keptCount++;
    return true;
  });

  if (filtered.length > 0) {
    inboundOnly[customer] = filtered;
  }
}

/* ---------- WRITE JSON ---------- */
fs.writeFileSync(
  OUTPUT_JSON,
  JSON.stringify(inboundOnly, null, 2)
);

/* ---------- WRITE TXT ---------- */
let txt = "";
for (const customer in inboundOnly) {
  txt += `\nCustomer: ${customer}\n`;
  txt += "--------------------------------\n";

  inboundOnly[customer].forEach(m => {
    txt += `[${new Date(m.date).toLocaleString()}] THEM: ${m.body}\n`;
  });
}

fs.writeFileSync(OUTPUT_TXT, txt);

/* ---------- SUMMARY ---------- */
console.log("📥 Inbound-only extraction complete");
console.log(`🚫 Skipped STOP-only messages: ${skippedStopCount}`);
console.log(`✅ Kept inbound messages: ${keptCount}`);
console.log(`📄 ${OUTPUT_JSON}`);
console.log(`📄 ${OUTPUT_TXT}`);
