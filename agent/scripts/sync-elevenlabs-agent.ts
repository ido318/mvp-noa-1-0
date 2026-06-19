/**
 * sync-elevenlabs-agent.ts
 *
 * Syncs the Tomer agent config to ElevenLabs Conversational AI.
 *   --dry-run   Show what would be sent; do NOT call the API.
 *
 * Usage:
 *   cd agent
 *   node --env-file=.env --import tsx/esm scripts/sync-elevenlabs-agent.ts [--dry-run]
 */

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { join, dirname } from "path";

const isDryRun = process.argv.includes("--dry-run");

// ── Env ───────────────────────────────────────────────────────────────────────

const ELEVENLABS_API_KEY  = process.env["ELEVENLABS_API_KEY"]  ?? "";
const ELEVENLABS_AGENT_ID = process.env["ELEVENLABS_AGENT_ID"] ?? "";
// Accept either AGENT_PUBLIC_URL (production) or PUBLIC_BASE_URL (existing .env convention)
const AGENT_PUBLIC_URL =
  process.env["AGENT_PUBLIC_URL"] ?? process.env["PUBLIC_BASE_URL"] ?? "";
const JOBS_BEARER_TOKEN = process.env["JOBS_BEARER_TOKEN"] ?? "";

const missing: string[] = [];
if (!ELEVENLABS_API_KEY)  missing.push("ELEVENLABS_API_KEY");
if (!ELEVENLABS_AGENT_ID) missing.push("ELEVENLABS_AGENT_ID");
if (!AGENT_PUBLIC_URL)    missing.push("AGENT_PUBLIC_URL or PUBLIC_BASE_URL");
if (!JOBS_BEARER_TOKEN)   missing.push("JOBS_BEARER_TOKEN");

if (missing.length > 0) {
  console.error(`[sync] Missing required env vars: ${missing.join(", ")}`);
  process.exit(1);
}

// ── Load knowledge files ──────────────────────────────────────────────────────

const __dir = dirname(fileURLToPath(import.meta.url));

const systemPrompt = readFileSync(
  join(__dir, "../src/knowledge/tomer-system-prompt.md"),
  "utf-8",
).trim();

const toolsTemplate = readFileSync(
  join(__dir, "../src/knowledge/tomer-tools.json"),
  "utf-8",
);

// Substitute placeholders
const toolsJson = toolsTemplate
  .replaceAll("{{AGENT_PUBLIC_URL}}", AGENT_PUBLIC_URL)
  .replaceAll("{{AGENT_JOBS_BEARER_TOKEN}}", JOBS_BEARER_TOKEN);

type ElevenLabsTool = {
  name: string;
  description: string;
  type: string;
  api: { url: string; method: string; headers: unknown[] };
  parameters: Record<string, unknown>;
};

const tools: ElevenLabsTool[] = JSON.parse(toolsJson) as ElevenLabsTool[];

// ── Payload ───────────────────────────────────────────────────────────────────

const patchPayload = {
  conversation_config: {
    agent: {
      first_message: "שלום, הגעתם למרפאת גט אה וֵט, מדבר תומר. איך אפשר לעזור?",
      language: "he",
      prompt: {
        prompt: systemPrompt,
        tools,
      },
    },
    turn: {
      turn_timeout: 3,
      turn_eagerness: "eager",
      soft_timeout_config: {
        timeout_seconds: 2.5,
        message: "אני איתך.",
        use_llm_generated_message: false,
        randomize_fillers: false,
        max_soft_timeouts_per_generation: 1,
      },
    },
    tts: {
      model_id: "eleven_v3_conversational",
      voice_id: "6u58Zr4cXPCkxTgRpkKk",
      speed: 1.08,
      stability: 0.4,
      optimize_streaming_latency: 3,
      text_normalisation_type: "system_prompt",
    },
  },
};

// ── Dry-run ───────────────────────────────────────────────────────────────────

if (isDryRun) {
  console.log("=== DRY RUN — no changes will be sent to ElevenLabs ===\n");

  // Fetch current config for comparison
  let currentPrompt = "(failed to fetch)";
  let currentToolNames: string[] = [];
  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/convai/agents/${ELEVENLABS_AGENT_ID}`,
      { headers: { "xi-api-key": ELEVENLABS_API_KEY } },
    );
    if (res.ok) {
      const data = await res.json() as {
        conversation_config?: {
          agent?: {
            first_message?: string;
            prompt?: { prompt?: string; tools?: Array<{ name?: string }> };
          };
          turn?: {
            turn_timeout?: number;
            turn_eagerness?: string;
            soft_timeout_config?: { timeout_seconds?: number };
          };
          tts?: { speed?: number; stability?: number; optimize_streaming_latency?: number };
        };
      };
      currentPrompt =
        data.conversation_config?.agent?.prompt?.prompt ?? "(empty)";
      currentToolNames = (data.conversation_config?.agent?.prompt?.tools ?? [])
        .map((t) => t.name ?? "?");
    } else {
      currentPrompt = `(ElevenLabs returned ${res.status})`;
    }
  } catch (err) {
    currentPrompt = `(fetch error: ${err instanceof Error ? err.message : String(err)})`;
  }

  console.log(`Agent ID : ${ELEVENLABS_AGENT_ID}`);
  console.log(`Base URL : ${AGENT_PUBLIC_URL}\n`);

  console.log("── SYSTEM PROMPT ─────────────────────────────────────────────");
  console.log(`Current : ${currentPrompt.length} chars`);
  console.log(`Proposed: ${systemPrompt.length} chars`);
  if (currentPrompt !== systemPrompt) {
    console.log("\n[CHANGED] First 400 chars of proposed prompt:");
    console.log(systemPrompt.slice(0, 400) + (systemPrompt.length > 400 ? "…" : ""));
  } else {
    console.log("[UNCHANGED]");
  }

  console.log("\n── TOOLS ─────────────────────────────────────────────────────");
  console.log(`Current  (${currentToolNames.length}): ${currentToolNames.join(", ") || "(none)"}`);
  console.log(`Proposed (${tools.length}):`);
  for (const t of tools) {
    const apiUrl = (t.api as { url?: string } | undefined)?.url
      ?? (t as unknown as { api_schema?: { url?: string } }).api_schema?.url
      ?? "(unknown)";
    const reqBody = (t as unknown as { api_schema?: { request_body_schema?: { required?: string[] } } }).api_schema?.request_body_schema;
    console.log(`  • ${t.name}`);
    console.log(`    URL: ${apiUrl}`);
    console.log(`    Required: ${JSON.stringify(reqBody?.required ?? [])}`);
  }

  console.log("\n── VOICE TURN SETTINGS ────────────────────────────────────────");
  console.log(`First message: ${patchPayload.conversation_config.agent.first_message}`);
  console.log(`Turn timeout : ${patchPayload.conversation_config.turn.turn_timeout}s`);
  console.log(`Turn eagerness: ${patchPayload.conversation_config.turn.turn_eagerness}`);
  console.log(`Soft timeout : ${patchPayload.conversation_config.turn.soft_timeout_config.timeout_seconds}s`);
  console.log(`TTS speed    : ${patchPayload.conversation_config.tts.speed}`);

  console.log("\n=== Run without --dry-run to apply ===");
  process.exit(0);
}

// ── Live push ─────────────────────────────────────────────────────────────────

console.log(`[sync] Updating agent ${ELEVENLABS_AGENT_ID} …`);

const res = await fetch(
  `https://api.elevenlabs.io/v1/convai/agents/${ELEVENLABS_AGENT_ID}`,
  {
    method: "PATCH",
    headers: {
      "xi-api-key": ELEVENLABS_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(patchPayload),
  },
);

if (!res.ok) {
  const body = await res.text();
  console.error(`[sync] ElevenLabs API error ${res.status}: ${body}`);
  process.exit(1);
}

console.log(`[sync] Agent updated successfully.`);
console.log(`[sync] System prompt: ${systemPrompt.length} chars`);
console.log(`[sync] Tools synced: ${tools.map((t) => t.name).join(", ")}`);
