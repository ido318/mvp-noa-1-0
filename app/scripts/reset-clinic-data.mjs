/**
 * Clears operational clinic data so the pilot can start from a clean slate.
 *
 * Deliberately KEEPS voice_calls and everything hanging off them — the
 * transcripts, recordings and call_reviews are the corpus the prompt-learning
 * loop analyses, so wiping them would defeat the point of running the agent.
 * voice_calls' links to customers/pets/appointments/visits are ON DELETE SET
 * NULL, so the calls survive this with their content intact and their links
 * emptied.
 *
 * Also keeps audit_logs and ai_events: those are system records, not demo data.
 *
 * Every foreign key below is RESTRICT, so DELETE_ORDER is load-bearing — a
 * wrong order fails loudly rather than cascading silently, which is why it is
 * spelled out rather than looped over the table list.
 *
 * Usage:
 *   node scripts/reset-clinic-data.mjs                 # dry run — counts only
 *   node scripts/reset-clinic-data.mjs --confirm       # actually delete
 *
 * Env (required, no defaults — this points at production if you point it there):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const confirmed = process.argv.includes("--confirm");

if (!url || !serviceRoleKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

/** Children before parents. Do not reorder without re-checking the FK rules. */
const DELETE_ORDER = [
  "visit_shares",
  "medical_notes",
  "prescriptions",
  "vaccinations",
  "lab_orders",
  "visit_charges",
  "vitals",
  "follow_ups",
  "invoices",
  "tasks",
  "waitlist",
  "visits",
  "appointments",
  "medical_records",
  "pets",
  "customers",
  "escalations",
  "notifications_log",
  "calendar_blocks",
];

const KEPT = ["voice_calls", "call_reviews", "ai_events", "audit_logs", "tomer_prompt_suggestions"];

const admin = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function count(table) {
  const { count: n, error } = await admin.from(table).select("*", { count: "exact", head: true });
  return error ? null : n;
}

console.log(`Target: ${url}`);
console.log(confirmed ? "Mode:   DELETE\n" : "Mode:   dry run (pass --confirm to delete)\n");

console.log("Will delete:");
let total = 0;
for (const table of DELETE_ORDER) {
  const n = await count(table);
  if (n === null) {
    console.log(`  ${table.padEnd(20)} — no such table, skipping`);
    continue;
  }
  if (n > 0) console.log(`  ${table.padEnd(20)} ${n}`);
  total += n;
}
console.log(`  ${"".padEnd(20)} ${total} rows total\n`);

console.log("Will keep:");
for (const table of KEPT) {
  const n = await count(table);
  if (n !== null) console.log(`  ${table.padEnd(24)} ${n}`);
}

if (!confirmed) {
  console.log("\nDry run — nothing was deleted.");
  process.exit(0);
}

console.log("\nDeleting…");
for (const table of DELETE_ORDER) {
  // .delete() needs a filter; this one matches every row.
  const { error } = await admin.from(table).delete().not("id", "is", null);
  if (error) {
    if (/does not exist/i.test(error.message)) {
      console.log(`  ${table.padEnd(20)} skipped (${error.message})`);
      continue;
    }
    console.error(`  ${table.padEnd(20)} FAILED: ${error.message}`);
    console.error("\nStopped. Nothing after this table was touched.");
    process.exit(1);
  }
  console.log(`  ${table.padEnd(20)} cleared`);
}

console.log("\nAfter:");
for (const table of [...DELETE_ORDER, ...KEPT]) {
  const n = await count(table);
  if (n) console.log(`  ${table.padEnd(24)} ${n}`);
}
console.log("\nDone.");
