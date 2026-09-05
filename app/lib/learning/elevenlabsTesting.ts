import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import type { RegressionOutcome } from "@/types/domain/prompt-suggestion";

function getConfig() {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  const agentId = process.env.ELEVENLABS_AGENT_ID?.trim();
  const testIds =
    process.env.ELEVENLABS_TEST_IDS?.split(",")
      .map((id) => id.trim())
      .filter(Boolean) ?? [];

  if (!apiKey) throw new Error("ELEVENLABS_API_KEY is not configured");
  if (!agentId) throw new Error("ELEVENLABS_AGENT_ID is not configured");
  if (testIds.length === 0) throw new Error("ELEVENLABS_TEST_IDS is not configured");

  return { apiKey, agentId, testIds };
}

let _client: ElevenLabsClient | null = null;
function getClient(apiKey: string): ElevenLabsClient {
  if (!_client) _client = new ElevenLabsClient({ apiKey });
  return _client;
}

/**
 * Runs the configured regression tests against a CANDIDATE prompt (via
 * agent_config_override) without publishing it. `allPassed` is explicitly
 * `null` — never `false` — when the response shape can't be confidently
 * parsed, so the caller knows not to trust a false negative/positive.
 *
 * See docs: elevenlabs.io/docs/eleven-agents/api-reference/tests/run-tests
 */
export async function runRegressionTests(candidatePrompt: string): Promise<RegressionOutcome> {
  const { apiKey, agentId, testIds } = getConfig();

  const response = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agentId}/run-tests`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      tests: testIds.map((test_id) => ({ test_id })),
      agent_config_override: {
        conversation_config: {
          agent: {
            prompt: {
              prompt: candidatePrompt,
            },
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`ElevenLabs run-tests request failed (${response.status}): ${body}`);
  }

  const raw = (await response.json()) as Record<string, unknown>;
  return { allPassed: detectAllPassed(raw), raw };
}

/**
 * Deliberately conservative: only returns true/false when every test result
 * carries a field we recognize with certainty. Anything ambiguous -> null,
 * which the approve route treats as "do not publish".
 */
function detectAllPassed(raw: Record<string, unknown>): boolean | null {
  const results = raw["test_results"] ?? raw["results"];
  if (!Array.isArray(results) || results.length === 0) return null;

  const outcomes = results.map((entry): boolean | null => {
    if (typeof entry !== "object" || entry === null) return null;
    const record = entry as Record<string, unknown>;
    const candidate = record["test_result"] ?? record["result"] ?? record["success"] ?? record["status"];
    if (typeof candidate === "boolean") return candidate;
    if (typeof candidate === "string") {
      const normalized = candidate.toLowerCase();
      if (normalized === "success" || normalized === "passed" || normalized === "pass") return true;
      if (normalized === "failure" || normalized === "failed" || normalized === "fail") return false;
    }
    return null;
  });

  if (outcomes.some((o) => o === null)) return null;
  return outcomes.every((o) => o === true);
}

/** Fetches the agent's current live conversation_config, for `previous_prompt` snapshotting. */
export async function getLiveAgentConfig(): Promise<Record<string, unknown>> {
  const { apiKey, agentId } = getConfig();
  const agent = await getClient(apiKey).conversationalAi.agents.get(agentId);
  return agent.conversationConfig as unknown as Record<string, unknown>;
}

/**
 * Publishes a new system prompt to the live agent. Fetches the current
 * config first and carries tools/knowledge_base/rag forward unchanged —
 * ElevenLabs' merge semantics for nested conversation_config.agent.prompt
 * are undocumented, so a bare `{ prompt: newPromptText }` PATCH risks
 * silently wiping the agent's tools and knowledge base (same class of bug
 * fixed in agent/scripts/sync-elevenlabs-agent.ts during the KB rollout).
 */
export async function publishPrompt(newPromptText: string): Promise<Record<string, unknown>> {
  const { apiKey, agentId } = getConfig();
  const client = getClient(apiKey);

  const current = await client.conversationalAi.agents.get(agentId);
  const currentPrompt = current.conversationConfig.agent?.prompt;

  const updated = await client.conversationalAi.agents.update(agentId, {
    conversationConfig: {
      agent: {
        prompt: {
          prompt: newPromptText,
          tools: currentPrompt?.tools,
          knowledgeBase: currentPrompt?.knowledgeBase,
          rag: currentPrompt?.rag,
        },
      },
    },
  });
  return updated as unknown as Record<string, unknown>;
}
