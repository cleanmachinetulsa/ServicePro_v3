import fs from "fs";
import twilio from "twilio";

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN  = process.env.TWILIO_AUTH_TOKEN;

if (!ACCOUNT_SID || !AUTH_TOKEN) {
  console.error("❌ Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN in env.");
  process.exit(1);
}

const client = twilio(ACCOUNT_SID, AUTH_TOKEN);

/** ====== CONFIG (expand these if unsure) ====== **/
const START = new Date("2025-12-13T00:00:00-06:00"); // CST
const END   = new Date("2025-12-14T00:00:00-06:00"); // CST
const WINDOW_MINUTES = 5; // safer on blast days
const SKIP_STOP_ONLY = true;
/** ============================================ **/

function isInbound(msg) {
  return (msg.direction || "").startsWith("inbound");
}
function isStopOnly(body) {
  return (body || "").trim().toUpperCase() === "STOP";
}
function escCsv(s = "") {
  const t = String(s).replace(/\r?\n/g, " ").trim();
  if (t.includes('"') || t.includes(",")) return `"${t.replace(/"/g, '""')}"`;
  return t;
}

async function fetchAllPagesForWindow(start, end) {
  // Pull ALL pages for this window (no truncation).
  let all = [];
  let page = await client.messages.page({
    dateSentAfter: start,
    dateSentBefore: end,
    pageSize: 1000
  });

  all.push(...page.instances);

  while (page.nextPageUrl) {
    page = await page.nextPage();
    all.push(...page.instances);
  }

  return all;
}

async function run() {
  console.log("📥 Export inbound (paged + guaranteed) …");
  console.log(`⏱  Range: ${START.toISOString()}  →  ${END.toISOString()}`);
  console.log(`🪟  Window: ${WINDOW_MINUTES} minutes`);

  const bySid = new Map();
  let cursor = new Date(START);
  let windows = 0;

  while (cursor < END) {
    const next = new Date(cursor.getTime() + WINDOW_MINUTES * 60_000);
    const windowEnd = next < END ? next : END;

    windows++;
    process.stdout.write(`\r🔎 Window ${windows}: ${cursor.toISOString()} → ${windowEnd.toISOString()}   `);

    const msgs = await fetchAllPagesForWindow(cursor, windowEnd);

    for (const m of msgs) {
      if (!m?.sid) continue;
      if (!isInbound(m)) continue;
      if (SKIP_STOP_ONLY && isStopOnly(m.body)) continue;

      bySid.set(m.sid, {
        sid: m.sid,
        date: m.dateSent ? new Date(m.dateSent) : null,
        from: m.from || "",
        to: m.to || "",
        body: (m.body || "").trim(),
        direction: m.direction || ""
      });
    }

    cursor = windowEnd;
  }

  console.log("\n✅ Pulled inbound messages:", bySid.size);

  const rows = Array.from(bySid.values()).sort((a,b) => {
    const da = a.date ? a.date.getTime() : 0;
    const db = b.date ? b.date.getTime() : 0;
    return da - db;
  });

  // inbound.messages.csv
  const msgCsvHeader = "date,sid,from,to,direction,body\n";
  const msgCsv = rows.map(r =>
    [escCsv(r.date ? r.date.toISOString() : ""), escCsv(r.sid), escCsv(r.from), escCsv(r.to), escCsv(r.direction), escCsv(r.body)].join(",")
  );
  fs.writeFileSync("inbound.messages.csv", msgCsvHeader + msgCsv.join("\n"));

  // grouped + customers list
  const grouped = {};
  for (const r of rows) {
    grouped[r.from] ||= [];
    grouped[r.from].push(r);
  }

  let txt = "";
  for (const customer of Object.keys(grouped)) {
    txt += `\nCustomer: ${customer}\n`;
    txt += "--------------------------------\n";
    for (const r of grouped[customer]) {
      const when = r.date ? r.date.toLocaleString() : "";
      txt += `[${when}] THEM: ${r.body}\n`;
    }
  }
  fs.writeFileSync("inbound.grouped.txt", txt);

  const customers = Object.entries(grouped).map(([phone, msgs]) => {
    const last = msgs[msgs.length - 1];
    return { phone, lastDate: last.date ? last.date.toISOString() : "", lastBody: last.body };
  }).sort((a,b) => (b.lastDate || "").localeCompare(a.lastDate || ""));

  const custHeader = "phone,lastDate,lastMessage\n";
  const custCsv = customers.map(c => [escCsv(c.phone), escCsv(c.lastDate), escCsv(c.lastBody)].join(","));
  fs.writeFileSync("inbound.customers.csv", custHeader + custCsv.join("\n"));

  console.log("📄 Wrote:");
  console.log("  - inbound.customers.csv");
  console.log("  - inbound.messages.csv");
  console.log("  - inbound.grouped.txt");
}

run().catch(err => {
  console.error("\n❌ Export failed:", err?.message || err);
  process.exit(1);
});
