import fs from "fs";
import twilio from "twilio";
import { createObjectCsvWriter } from "csv-writer";

/* ===================== CONFIG ===================== */

const START_DATE = "2025-12-09"; // YYYY-MM-DD
const END_DATE   = "2025-12-13"; // YYYY-MM-DD

const EXCLUDE_KEYWORDS = [
  "STOP",
  "START",
  "HELP",
  "UNSUBSCRIBE"
];

const MIN_MESSAGE_LENGTH = 2;

/* ================================================ */

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

function isJunk(body = "") {
  const text = body.trim().toUpperCase();
  if (text.length < MIN_MESSAGE_LENGTH) return true;
  return EXCLUDE_KEYWORDS.some(k => text === k);
}

function getCustomerNumber(msg) {
  return msg.direction?.startsWith("inbound")
    ? msg.from
    : msg.to;
}

async function run() {
  console.log("📡 Fetching messages from Twilio…");

  const messages = await client.messages.list({
    dateSentAfter: new Date(START_DATE),
    dateSentBefore: new Date(END_DATE),
    limit: 1000
  });

  const conversations = {};

  for (const msg of messages) {
    if (!msg.body) continue;
    if (isJunk(msg.body)) continue;

    const customer = getCustomerNumber(msg);
    if (!customer) continue;

    conversations[customer] ||= [];
    conversations[customer].push({
      sid: msg.sid,
      customer,
      direction: msg.direction,
      from: msg.from,
      to: msg.to,
      body: msg.body.trim(),
      date: msg.dateSent
    });
  }

  for (const customer in conversations) {
    conversations[customer].sort(
      (a, b) => new Date(a.date) - new Date(b.date)
    );
  }

  // TXT output
  let txt = "";
  for (const customer in conversations) {
    txt += `\nCustomer: ${customer}\n`;
    txt += "--------------------------------\n";
    conversations[customer].forEach(m => {
      const who = m.direction?.startsWith("inbound") ? "THEM" : "YOU";
      txt += `[${new Date(m.date).toLocaleString()}] ${who}: ${m.body}\n`;
    });
  }

  fs.writeFileSync("conversations.txt", txt);

  // JSON output
  fs.writeFileSync(
    "conversations.json",
    JSON.stringify(conversations, null, 2)
  );

  // CSV output
  const rows = Object.values(conversations).flat();

  const csvWriter = createObjectCsvWriter({
    path: "conversations.csv",
    header: [
      { id: "sid", title: "SID" },
      { id: "customer", title: "Customer" },
      { id: "direction", title: "Direction" },
      { id: "from", title: "From" },
      { id: "to", title: "To" },
      { id: "date", title: "Date" },
      { id: "body", title: "Message" }
    ]
  });

  await csvWriter.writeRecords(rows);

  console.log("✅ Done.");
  console.log("📄 conversations.txt");
  console.log("📄 conversations.csv");
  console.log("📄 conversations.json");
}

run().catch(err => {
  console.error("❌ Error:", err);
});
