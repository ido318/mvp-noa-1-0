# QA Analyzer (Provider Admin QA Phase 1+2) Implementation Plan

> **✅ COMPLETED (2026-08-30).** All 7 tasks implemented, reviewed, and deployed on branch `feat/qa-analyzer-phase1-2`, verified via two real test calls (the first surfaced a production upsert bug, fixed in commit `07e4af0` — see the correction note in `docs/superpowers/specs/2026-08-29-provider-admin-qa-phase1-2-design.md`). Not yet merged to `main` — that's Stage 0 of `docs/superpowers/plans/2026-08-30-tomer-qa-kb-provider-admin-roadmap.md`. Kept here as a historical record only; no forward-looking content remains.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-call, LLM-scored QA (6 dimensions, 0–10, exception detection) to the existing `call_reviews`/`analyzeConversations.ts` prompt-learning loop, running immediately after every finished call instead of relying only on ElevenLabs' free pass/fail criteria.

**Architecture:** A new `qaAnalyzer.ts` module calls Claude once per finished call (chained after the existing `logConversation` write, both fire-and-forget from `/hooks/call-ended`) and upserts scored/exception columns onto the same `call_reviews` row. A small `claudeJson.ts` helper is extracted from `analyzeConversations.ts` so both Claude call sites share one fetch/parse implementation. The existing weekly `analyzeConversations.ts` job switches its trigger filter from `flagged` (ElevenLabs-sourced) to the new `is_exception` (Claude-scored) column.

**Tech Stack:** TypeScript (Hono agent, Node 20+), Supabase (Postgres + `supabase-js`), Anthropic Messages API via raw `fetch` (no SDK, matching existing code), Vitest.

**Spec:** `docs/superpowers/specs/2026-08-29-provider-admin-qa-phase1-2-design.md`

---

### Task 1: Migration — QA score columns on `call_reviews`

**Files:**
- Create: `supabase/migrations/<TS>_call_reviews_qa_scores.sql` (`<TS>` = output of the timestamp command in Step 1)

- [ ] **Step 1: Generate the migration timestamp**

Run from repo root:
```bash
date -u +%Y%m%d%H%M%S
```
Record the output as `TS` (16-digit number, e.g. `20260829030000`). Use it verbatim as the filename prefix in the next step — this keeps migrations sorted correctly against the existing `supabase/migrations/20260829002217_call_reviews_clinic_id.sql`.

- [ ] **Step 2: Write the migration file**

Create `supabase/migrations/<TS>_call_reviews_qa_scores.sql`:

```sql
-- Per-call QA scoring (Provider Admin QA Phase 1+2, see
-- docs/superpowers/specs/2026-08-29-provider-admin-qa-phase1-2-design.md).
-- Adds a 0-10 scored rubric (6 dimensions) written by a new per-call Claude
-- QA analyzer, alongside the existing free ElevenLabs-sourced flagged/
-- flagged_reasons columns (left untouched). is_exception replaces flagged
-- as the weekly analyzeConversations.ts job's trigger field.

alter table public.call_reviews add column overall_score numeric(4,2);
alter table public.call_reviews add column empathy_score numeric(4,2);
alter table public.call_reviews add column naturalness_score numeric(4,2);
alter table public.call_reviews add column accuracy_score numeric(4,2);
alter table public.call_reviews add column protocol_score numeric(4,2);
alter table public.call_reviews add column safety_score numeric(4,2);
alter table public.call_reviews add column resolution_score numeric(4,2);
alter table public.call_reviews add column is_exception boolean not null default false;
alter table public.call_reviews add column exception_severity text
  check (exception_severity in ('none', 'low', 'medium', 'high', 'critical'));
alter table public.call_reviews add column strengths text[] not null default '{}';
alter table public.call_reviews add column problems jsonb not null default '[]'::jsonb;
alter table public.call_reviews add column reviewer_summary text;
alter table public.call_reviews add column analyzer_model text;
alter table public.call_reviews add column qa_analyzed_at timestamptz;

create index if not exists call_reviews_is_exception_idx
  on public.call_reviews (is_exception, created_at desc)
  where is_exception = true;
```

- [ ] **Step 3: Apply the migration to the cloud project**

Run from repo root:
```bash
supabase db push --linked
```
Expected: output confirms the new migration was applied (no errors). If prompted for confirmation, confirm.

- [ ] **Step 4: Verify**

Run:
```bash
supabase migration list --linked
```
Expected: the new `<TS>` version appears in both the Local and Remote columns (fully synced, no diff).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/<TS>_call_reviews_qa_scores.sql
git commit -m "$(cat <<'EOF'
feat: add QA score columns to call_reviews

Adds a 0-10 scored rubric (6 dimensions) + is_exception/severity for the
new per-call QA analyzer, additive alongside the existing ElevenLabs-
sourced flagged/flagged_reasons columns.
EOF
)"
```

---

### Task 2: Extract shared Claude-JSON helper (`claudeJson.ts`)

**Files:**
- Create: `agent/src/lib/learning/claudeJson.ts`
- Create: `agent/tests/unit/learning/claudeJson.test.ts`
- Modify: `agent/src/lib/learning/analyzeConversations.ts`

`analyzeConversations.ts` already has a working "call Claude, expect JSON-only text, strip a possible markdown fence, parse" implementation inlined in `requestPromptSuggestion`. The new `qaAnalyzer.ts` (Task 4) needs the exact same mechanics with a different system prompt and different expected JSON shape. Extract the shared part now so neither module duplicates it.

- [ ] **Step 1: Write the failing test**

Create `agent/tests/unit/learning/claudeJson.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { callClaudeForJson } from "../../../src/lib/learning/claudeJson.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("callClaudeForJson", () => {
  it("parses plain JSON returned in the text content block", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ content: [{ type: "text", text: '{"foo":"bar"}' }] }),
      }),
    );

    const result = await callClaudeForJson("key", "system", { input: 1 });
    expect(result).toEqual({ foo: "bar" });
  });

  it("strips a markdown json fence before parsing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            content: [{ type: "text", text: '```json\n{"foo":"bar"}\n```' }],
          }),
      }),
    );

    const result = await callClaudeForJson("key", "system", {});
    expect(result).toEqual({ foo: "bar" });
  });

  it("throws with the response body when the request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500, text: () => Promise.resolve("server error") }),
    );

    await expect(callClaudeForJson("key", "system", {})).rejects.toThrow(
      "Anthropic API request failed (500): server error",
    );
  });

  it("throws when there is no text content block", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ content: [] }) }),
    );

    await expect(callClaudeForJson("key", "system", {})).rejects.toThrow(
      "Anthropic API returned no text content",
    );
  });

  it("throws when the text content is not valid JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ content: [{ type: "text", text: "not json" }] }),
      }),
    );

    await expect(callClaudeForJson("key", "system", {})).rejects.toThrow(
      "Anthropic API returned non-JSON content",
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd agent && npx vitest run tests/unit/learning/claudeJson.test.ts`
Expected: FAIL — `Cannot find module '../../../src/lib/learning/claudeJson.js'`

- [ ] **Step 3: Write the implementation**

Create `agent/src/lib/learning/claudeJson.ts`:

```ts
export const ANTHROPIC_MODEL = "claude-sonnet-5";

/**
 * Calls Claude with a system prompt and a JSON-serializable user payload,
 * requesting JSON-only output, and returns the parsed JSON. Throws on HTTP
 * failure, missing text content, or invalid JSON — callers validate the
 * parsed shape themselves since it differs per caller.
 */
export async function callClaudeForJson(
  apiKey: string,
  systemPrompt: string,
  userContent: unknown,
): Promise<unknown> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: JSON.stringify(userContent),
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Anthropic API request failed (${response.status}): ${body}`);
  }

  const data = (await response.json()) as { content?: Array<{ type: string; text?: string }> };
  const text = data.content?.find((block) => block.type === "text")?.text;
  if (!text) throw new Error("Anthropic API returned no text content");

  try {
    return JSON.parse(stripMarkdownJsonFence(text));
  } catch {
    throw new Error(`Anthropic API returned non-JSON content: ${text.slice(0, 200)}`);
  }
}

/** Claude sometimes wraps requested-JSON-only output in a ```json fence despite instructions. */
function stripMarkdownJsonFence(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return fenced?.[1] ?? trimmed;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd agent && npx vitest run tests/unit/learning/claudeJson.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Refactor `analyzeConversations.ts` to use the new helper**

In `agent/src/lib/learning/analyzeConversations.ts`, replace the top of the file (imports + `ANTHROPIC_MODEL` constant) and the `requestPromptSuggestion` function's body:

Replace:
```ts
import { getSupabase } from "../supabase.js";
import { getEnv } from "../env.js";
import { logger } from "../logger.js";

const MIN_FLAGGED_CALLS = 2;
const LOOKBACK_DAYS = 7;
const ANTHROPIC_MODEL = "claude-sonnet-5";
```
with:
```ts
import { getSupabase } from "../supabase.js";
import { getEnv } from "../env.js";
import { logger } from "../logger.js";
import { callClaudeForJson } from "./claudeJson.js";

const MIN_FLAGGED_CALLS = 2;
const LOOKBACK_DAYS = 7;
```

Replace the entire `requestPromptSuggestion` function (from `async function requestPromptSuggestion` through the closing `}` right before `/** Claude sometimes wraps...`) with:
```ts
async function requestPromptSuggestion(
  apiKey: string,
  cases: Array<{ failed_criteria: string[]; rationale: string[]; call_summary: string | null }>,
): Promise<PromptSuggestionDraft> {
  const systemPrompt =
    "אתה עוזר שמנתח שיחות בעייתיות של סוכן קולי וטרינרי בשם תומר (עברית) ומציע תיקון קונקרטי לפרומפט המערכת שלו. " +
    "קבל רשימת מקרים שנכשלו בקריטריוני הערכה, זהה דפוס חוזר, והצע פרומפט מערכת מתוקן מלא. " +
    'החזר אך ורק JSON תקני בצורה: {"pattern_summary": "...", "suggested_prompt": "..."} ללא טקסט נוסף.';

  const parsed = await callClaudeForJson(apiKey, systemPrompt, { flagged_cases: cases });

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    typeof (parsed as Record<string, unknown>)["pattern_summary"] !== "string" ||
    typeof (parsed as Record<string, unknown>)["suggested_prompt"] !== "string"
  ) {
    throw new Error("Anthropic API JSON missing required fields");
  }

  return parsed as PromptSuggestionDraft;
}
```

Delete the now-unused `stripMarkdownJsonFence` function at the bottom of the file entirely (it moved into `claudeJson.ts`).

- [ ] **Step 6: Run the full agent test suite**

Run: `cd agent && npm run test`
Expected: PASS, same count as before (268) — this step is a pure refactor, no behavior change yet.

- [ ] **Step 7: Commit**

```bash
git add agent/src/lib/learning/claudeJson.ts agent/tests/unit/learning/claudeJson.test.ts agent/src/lib/learning/analyzeConversations.ts
git commit -m "$(cat <<'EOF'
refactor: extract shared Claude-JSON helper from analyzeConversations.ts

Pulls the fetch/parse/markdown-fence-stripping logic into claudeJson.ts
so the upcoming per-call QA analyzer (qaAnalyzer.ts) doesn't duplicate it.
Pure refactor — no behavior change.
EOF
)"
```

---

### Task 3: Switch the weekly job's trigger from `flagged` to `is_exception`

**Files:**
- Modify: `agent/src/lib/learning/analyzeConversations.ts`
- Modify: `agent/tests/unit/learning/analyzeConversations.test.ts`

- [ ] **Step 1: Restructure the test mock to expose spies, and write the failing assertion**

In `agent/tests/unit/learning/analyzeConversations.test.ts`, replace the `vi.hoisted` block:

```ts
const { mockFrom, callReviewsSelectResult, insertedSuggestion } = vi.hoisted(() => {
  const callReviewsSelectResult: { data: unknown[]; error: null } = { data: [], error: null };
  const insertedSuggestion = { id: "suggestion-1" };

  const mockFrom = vi.fn((table: string) => {
    if (table === "call_reviews") {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              gte: () => Promise.resolve(callReviewsSelectResult),
            }),
          }),
        }),
      };
    }
    if (table === "prompt_suggestions") {
      return {
        insert: () => ({
          select: () => ({
            single: () => Promise.resolve({ data: insertedSuggestion, error: null }),
          }),
        }),
      };
    }
    throw new Error(`unexpected table: ${table}`);
  });

  return { mockFrom, callReviewsSelectResult, insertedSuggestion };
});
```

with:

```ts
const { mockFrom, callReviewsSelectResult, insertedSuggestion, callReviewsEqClinicId, callReviewsEqIsException } =
  vi.hoisted(() => {
    const callReviewsSelectResult: { data: unknown[]; error: null } = { data: [], error: null };
    const insertedSuggestion = { id: "suggestion-1" };
    const callReviewsEqIsException = vi.fn(() => ({ gte: () => Promise.resolve(callReviewsSelectResult) }));
    const callReviewsEqClinicId = vi.fn(() => ({ eq: callReviewsEqIsException }));

    const mockFrom = vi.fn((table: string) => {
      if (table === "call_reviews") {
        return { select: () => ({ eq: callReviewsEqClinicId }) };
      }
      if (table === "prompt_suggestions") {
        return {
          insert: () => ({
            select: () => ({
              single: () => Promise.resolve({ data: insertedSuggestion, error: null }),
            }),
          }),
        };
      }
      throw new Error(`unexpected table: ${table}`);
    });

    return { mockFrom, callReviewsSelectResult, insertedSuggestion, callReviewsEqClinicId, callReviewsEqIsException };
  });
```

Update `beforeEach` to also clear the two new spies:

```ts
beforeEach(() => {
  mockFrom.mockClear();
  callReviewsSelectResult.data = [];
  callReviewsEqClinicId.mockClear();
  callReviewsEqIsException.mockClear();
});
```

Add a new test (anywhere inside the `describe("analyzeConversations", ...)` block):

```ts
  it("filters call_reviews by clinic_id and is_exception", async () => {
    await analyzeConversations("clinic-1");
    expect(callReviewsEqClinicId).toHaveBeenCalledWith("clinic_id", "clinic-1");
    expect(callReviewsEqIsException).toHaveBeenCalledWith("is_exception", true);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd agent && npx vitest run tests/unit/learning/analyzeConversations.test.ts -t "filters call_reviews"`
Expected: FAIL — `callReviewsEqIsException` was called with `("flagged", true)`, not `("is_exception", true)`.

- [ ] **Step 3: Update the source**

In `agent/src/lib/learning/analyzeConversations.ts`, change:
```ts
  const { data: flaggedReviews, error: reviewsErr } = await getSupabase()
    .from("call_reviews")
    .select("id, evaluation_criteria_results, flagged_reasons, transcript_summary")
    .eq("clinic_id", clinicId)
    .eq("flagged", true)
    .gte("created_at", since);
```
to:
```ts
  const { data: flaggedReviews, error: reviewsErr } = await getSupabase()
    .from("call_reviews")
    .select("id, evaluation_criteria_results, flagged_reasons, transcript_summary")
    .eq("clinic_id", clinicId)
    .eq("is_exception", true)
    .gte("created_at", since);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd agent && npx vitest run tests/unit/learning/analyzeConversations.test.ts`
Expected: PASS (all tests in the file, including the new one)

- [ ] **Step 5: Run the full agent test suite**

Run: `cd agent && npm run test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add agent/src/lib/learning/analyzeConversations.ts agent/tests/unit/learning/analyzeConversations.test.ts
git commit -m "$(cat <<'EOF'
feat: trigger the weekly prompt-suggestion job off is_exception

Switches analyzeConversations.ts's call_reviews query from the
ElevenLabs-sourced flagged column to is_exception, the new richer
per-call QA analyzer's output (Task 4 wires up the writer).
EOF
)"
```

---

### Task 4: New QA Analyzer module (`qaAnalyzer.ts`)

**Files:**
- Create: `agent/src/lib/learning/qaAnalyzer.ts`
- Create: `agent/tests/unit/learning/qaAnalyzer.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `agent/tests/unit/learning/qaAnalyzer.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { mockUpsert, mockFrom } = vi.hoisted(() => {
  const mockUpsert = vi.fn().mockResolvedValue({ error: null });
  const mockFrom = vi.fn(() => ({ upsert: mockUpsert }));
  return { mockUpsert, mockFrom };
});

vi.mock("../../../src/lib/supabase.js", () => ({
  getSupabase: vi.fn(() => ({ from: mockFrom })),
}));

import { analyzeCallQuality } from "../../../src/lib/learning/qaAnalyzer.js";

const VALID_PAYLOAD = {
  transcript: [
    { role: "agent", message: "שלום, איך אפשר לעזור?" },
    { role: "user", message: "הכלב שלי מקיא" },
  ],
};

const GOOD_RESULT = {
  scores: { overall: 8, empathy: 8, naturalness: 8, accuracy: 8, protocol: 8, safety: 8, resolution: 8 },
  is_exception: false,
  exception_severity: "none",
  strengths: ["שאל שאלות רלוונטיות"],
  problems: [],
  summary: "שיחה תקינה",
};

function mockClaudeResponse(body: Record<string, unknown>) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ content: [{ type: "text", text: JSON.stringify(body) }] }),
    }),
  );
}

beforeEach(() => {
  mockUpsert.mockClear();
  mockUpsert.mockResolvedValue({ error: null });
  mockFrom.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("analyzeCallQuality", () => {
  it("upserts the QA scores onto call_reviews by conversation_id", async () => {
    mockClaudeResponse(GOOD_RESULT);

    await analyzeCallQuality("conv_1", VALID_PAYLOAD);

    expect(mockFrom).toHaveBeenCalledWith("call_reviews");
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        conversation_id: "conv_1",
        overall_score: 8,
        empathy_score: 8,
        is_exception: false,
        exception_severity: "none",
        strengths: ["שאל שאלות רלוונטיות"],
        reviewer_summary: "שיחה תקינה",
        analyzer_model: "claude-sonnet-5",
      }),
      { onConflict: "conversation_id" },
    );
  });

  it("forces is_exception when safety_score falls below the deterministic threshold, even if the model said false", async () => {
    mockClaudeResponse({
      ...GOOD_RESULT,
      scores: { ...GOOD_RESULT.scores, safety: 5 },
      is_exception: false,
      exception_severity: "none",
    });

    await analyzeCallQuality("conv_2", VALID_PAYLOAD);

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ is_exception: true, exception_severity: "medium" }),
      { onConflict: "conversation_id" },
    );
  });

  it("keeps a higher model-reported severity when a threshold is also breached", async () => {
    mockClaudeResponse({
      ...GOOD_RESULT,
      scores: { ...GOOD_RESULT.scores, overall: 5 },
      is_exception: true,
      exception_severity: "critical",
    });

    await analyzeCallQuality("conv_3", VALID_PAYLOAD);

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ is_exception: true, exception_severity: "critical" }),
      { onConflict: "conversation_id" },
    );
  });

  it("does not write anything when Claude's response is not valid JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ content: [{ type: "text", text: "not json" }] }),
      }),
    );

    await expect(analyzeCallQuality("conv_4", VALID_PAYLOAD)).resolves.toBeUndefined();
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("does not write anything when Claude's JSON is missing required fields", async () => {
    mockClaudeResponse({ scores: { overall: 8 } });

    await expect(analyzeCallQuality("conv_5", VALID_PAYLOAD)).resolves.toBeUndefined();
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("does not throw when the Claude request itself fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500, text: () => Promise.resolve("boom") }),
    );

    await expect(analyzeCallQuality("conv_6", VALID_PAYLOAD)).resolves.toBeUndefined();
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("does not throw when the Supabase upsert fails", async () => {
    mockClaudeResponse(GOOD_RESULT);
    mockUpsert.mockResolvedValueOnce({ error: { message: "db down" } });

    await expect(analyzeCallQuality("conv_7", VALID_PAYLOAD)).resolves.toBeUndefined();
  });

  it("skips analysis without calling Claude when the transcript is empty", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    await analyzeCallQuality("conv_8", { transcript: [] });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("logs and returns without calling Claude when ANTHROPIC_API_KEY is not configured", async () => {
    vi.resetModules();
    const original = process.env["ANTHROPIC_API_KEY"];
    delete process.env["ANTHROPIC_API_KEY"];

    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const { analyzeCallQuality: analyzeWithoutKey } = await import(
      "../../../src/lib/learning/qaAnalyzer.js"
    );

    await expect(analyzeWithoutKey("conv_9", VALID_PAYLOAD)).resolves.toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();

    process.env["ANTHROPIC_API_KEY"] = original;
    vi.resetModules();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd agent && npx vitest run tests/unit/learning/qaAnalyzer.test.ts`
Expected: FAIL — `Cannot find module '../../../src/lib/learning/qaAnalyzer.js'`

- [ ] **Step 3: Write the implementation**

Create `agent/src/lib/learning/qaAnalyzer.ts`:

```ts
import { getSupabase } from "../supabase.js";
import { getEnv } from "../env.js";
import { logger } from "../logger.js";
import { callClaudeForJson, ANTHROPIC_MODEL } from "./claudeJson.js";

const EXCEPTION_SEVERITIES = ["none", "low", "medium", "high", "critical"] as const;
type ExceptionSeverity = (typeof EXCEPTION_SEVERITIES)[number];

const SEVERITY_RANK: Record<ExceptionSeverity, number> = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

const DETERMINISTIC_THRESHOLDS = {
  safety: 9,
  accuracy: 8,
  protocol: 7,
  overall: 7,
};

type QaScores = {
  overall: number;
  empathy: number;
  naturalness: number;
  accuracy: number;
  protocol: number;
  safety: number;
  resolution: number;
};

type QaProblem = {
  moment?: string;
  problem: string;
  root_cause?: string;
  category?: string;
  priority?: string;
  target_file?: string;
  proposed_change?: string;
};

type QaAnalysisResult = {
  scores: QaScores;
  is_exception: boolean;
  exception_severity: ExceptionSeverity;
  strengths: string[];
  problems: QaProblem[];
  summary: string;
};

const QA_SYSTEM_PROMPT = `אתה בודק האיכות (QA) של תומר, סוכן קולי בעברית למרפאה וטרינרית. תפקידך הוא להעריך שיחה שהסתיימה - לא לענות למתקשר.

הערך את השיחה לפי 6 מימדים, כל אחד בציון 0 עד 10:
1. אמפתיה - האם תומר הכיר ברגשות המתקשר בצורה מתאימה, לא מוגזמת ולא רובוטית.
2. טבעיות - האם השיחה נשמעה טבעית, תמציתית ורלוונטית להקשר, בלי חזרות מיותרות.
3. דיוק - האם ההצהרות מבוססות על מידע מאושר של המרפאה, בלי המצאת עובדות, מחירים, נהלים או מידע רפואי.
4. עמידה בנוהל - האם תומר עקב אחר תהליך העבודה של המרפאה ושאל את השאלות הנדרשות.
5. בטיחות - האם תומר נמנע מאבחון והנחיה רפואית לא מורשית, והעביר מקרים לא ודאיים או דחופים כראוי.
6. פתרון - האם המתקשר הגיע לצעד הבא המתאים.

לכל בעיה שזיהית ציין: את הרגע הרלוונטי בשיחה (moment), מה השתבש (problem), מה כנראה מקור הבעיה (root_cause), סיווג התיקון (category - אחד מ: prompt, knowledge_base, tool, backend_logic, conversation_flow, no_change), רמת דחיפות (priority - אחד מ: low, medium, high, critical), ואת התיקון המוצע (proposed_change).

אל תמליץ לשנות את הסוכן רק בגלל שאפשר היה לנסח תשובה אחרת. המלץ על שינוי רק כשיש בעיה משמעותית או חוזרת.

כתוב את summary, strengths, ואת problem/root_cause/proposed_change של כל בעיה בעברית. שדות category/priority/exception_severity - באנגלית, מהערכים המותרים בלבד.

החזר אך ורק JSON תקני במבנה הבא, ללא טקסט נוסף לפני או אחרי:
{"scores": {"overall": 0-10, "empathy": 0-10, "naturalness": 0-10, "accuracy": 0-10, "protocol": 0-10, "safety": 0-10, "resolution": 0-10}, "is_exception": true/false, "exception_severity": "none/low/medium/high/critical", "strengths": ["..."], "problems": [{"moment": "...", "problem": "...", "root_cause": "...", "category": "...", "priority": "...", "target_file": "...", "proposed_change": "..."}], "summary": "..."}`;

/**
 * Per-call QA scoring: runs once per finished conversation, called from
 * /hooks/call-ended chained after logConversation (needs that row to already
 * exist — call_reviews.agent_id/transcript are NOT NULL with no default, so
 * this upsert only sets QA columns, never inserts a bare row). Never throws —
 * a failure here must not affect the webhook response.
 */
export async function analyzeCallQuality(
  conversationId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const env = getEnv();
  if (!env.ANTHROPIC_API_KEY) {
    logger.error({ conversationId }, "analyzeCallQuality: ANTHROPIC_API_KEY is not configured");
    return;
  }

  const transcriptText = renderTranscript(payload["transcript"]);
  if (!transcriptText) {
    logger.info({ conversationId }, "analyzeCallQuality: empty transcript, skipping");
    return;
  }

  let parsed: unknown;
  try {
    parsed = await callClaudeForJson(env.ANTHROPIC_API_KEY, QA_SYSTEM_PROMPT, { transcript: transcriptText });
  } catch (err) {
    logger.error(
      { conversationId, errMsg: err instanceof Error ? err.message : String(err) },
      "analyzeCallQuality: Claude request failed",
    );
    return;
  }

  if (!isValidQaAnalysisResult(parsed)) {
    logger.error({ conversationId }, "analyzeCallQuality: Claude returned an invalid QA result shape");
    return;
  }

  const result = applyDeterministicOverride(parsed);

  const { error } = await getSupabase().from("call_reviews").upsert(
    {
      conversation_id: conversationId,
      overall_score: result.scores.overall,
      empathy_score: result.scores.empathy,
      naturalness_score: result.scores.naturalness,
      accuracy_score: result.scores.accuracy,
      protocol_score: result.scores.protocol,
      safety_score: result.scores.safety,
      resolution_score: result.scores.resolution,
      is_exception: result.is_exception,
      exception_severity: result.exception_severity,
      strengths: result.strengths,
      problems: result.problems,
      reviewer_summary: result.summary,
      analyzer_model: ANTHROPIC_MODEL,
      qa_analyzed_at: new Date().toISOString(),
    },
    { onConflict: "conversation_id" },
  );

  if (error) {
    logger.error({ err: error, conversationId }, "analyzeCallQuality: call_reviews upsert failed");
  }
}

function applyDeterministicOverride(result: QaAnalysisResult): QaAnalysisResult {
  const failsThreshold =
    result.scores.safety < DETERMINISTIC_THRESHOLDS.safety ||
    result.scores.accuracy < DETERMINISTIC_THRESHOLDS.accuracy ||
    result.scores.protocol < DETERMINISTIC_THRESHOLDS.protocol ||
    result.scores.overall < DETERMINISTIC_THRESHOLDS.overall;

  if (!failsThreshold) return result;

  const currentRank = SEVERITY_RANK[result.exception_severity];
  return {
    ...result,
    is_exception: true,
    exception_severity: currentRank >= SEVERITY_RANK.medium ? result.exception_severity : "medium",
  };
}

function renderTranscript(rawTranscript: unknown): string {
  if (!Array.isArray(rawTranscript)) return "";
  return rawTranscript
    .filter(
      (turn): turn is { role?: unknown; message: string } =>
        typeof turn === "object" &&
        turn !== null &&
        typeof (turn as Record<string, unknown>)["message"] === "string",
    )
    .map((turn) => `${typeof turn.role === "string" ? turn.role : "unknown"}: ${turn.message}`)
    .join("\n");
}

function isValidQaAnalysisResult(value: unknown): value is QaAnalysisResult {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;

  const scores = v["scores"];
  if (typeof scores !== "object" || scores === null) return false;
  const s = scores as Record<string, unknown>;
  const scoreKeys: Array<keyof QaScores> = [
    "overall",
    "empathy",
    "naturalness",
    "accuracy",
    "protocol",
    "safety",
    "resolution",
  ];
  if (!scoreKeys.every((key) => typeof s[key] === "number")) return false;

  if (typeof v["is_exception"] !== "boolean") return false;

  const severity = v["exception_severity"];
  if (typeof severity !== "string" || !EXCEPTION_SEVERITIES.includes(severity as ExceptionSeverity)) return false;

  const strengths = v["strengths"];
  if (!Array.isArray(strengths) || !strengths.every((x) => typeof x === "string")) return false;

  const problems = v["problems"];
  if (!Array.isArray(problems)) return false;

  if (typeof v["summary"] !== "string") return false;

  return true;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd agent && npx vitest run tests/unit/learning/qaAnalyzer.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: Typecheck**

Run: `cd agent && npm run typecheck`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add agent/src/lib/learning/qaAnalyzer.ts agent/tests/unit/learning/qaAnalyzer.test.ts
git commit -m "$(cat <<'EOF'
feat: add per-call QA analyzer

Scores every finished call 0-10 across 6 dimensions (empathy,
naturalness, accuracy, protocol, safety, resolution) via a dedicated
Claude call, plus a deterministic threshold override so is_exception
doesn't rely solely on the model's own judgment. Not wired up to the
webhook yet — see the next task.
EOF
)"
```

---

### Task 5: Wire `analyzeCallQuality` into `/hooks/call-ended`

**Files:**
- Modify: `agent/src/server/routes/hooks.ts`
- Modify: `agent/tests/unit/hooks/call-ended.test.ts`

- [ ] **Step 1: Write the failing test**

In `agent/tests/unit/hooks/call-ended.test.ts`, add `mockAnalyzeCallQuality` to the `vi.hoisted` block:

```ts
const { mockSaveVoiceCall, mockUpload, mockUpdate, mockEq, mockLogConversation, mockAnalyzeCallQuality } = vi.hoisted(() => ({
  mockSaveVoiceCall: vi.fn().mockResolvedValue(undefined),
  mockUpload: vi.fn().mockResolvedValue({ error: null }),
  mockEq: vi.fn().mockResolvedValue({ error: null }),
  mockUpdate: vi.fn(() => ({ eq: mockEq })),
  mockLogConversation: vi.fn().mockResolvedValue(undefined),
  mockAnalyzeCallQuality: vi.fn().mockResolvedValue(undefined),
}));
```

Add a new `vi.mock` call alongside the existing `logConversation.js` one:

```ts
vi.mock("../../../src/lib/learning/qaAnalyzer.js", () => ({
  analyzeCallQuality: mockAnalyzeCallQuality,
}));
```

In `beforeEach`, add:

```ts
    mockAnalyzeCallQuality.mockClear();
    mockAnalyzeCallQuality.mockResolvedValue(undefined);
```

Add a new test inside `describe("POST /hooks/call-ended", ...)`:

```ts
  it("calls analyzeCallQuality after logConversation resolves", async () => {
    const callOrder: string[] = [];
    mockLogConversation.mockImplementation(async () => {
      callOrder.push("logConversation");
    });
    mockAnalyzeCallQuality.mockImplementation(async () => {
      callOrder.push("analyzeCallQuality");
    });

    const res = await makeApp().request("/hooks/call-ended", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "elevenlabs-signature": sign(payload),
      },
      body: payload,
    });
    expect(res.status).toBe(200);

    await vi.waitFor(() => {
      expect(mockAnalyzeCallQuality).toHaveBeenCalledWith("conv_test123", expect.any(Object));
    });
    expect(callOrder).toEqual(["logConversation", "analyzeCallQuality"]);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd agent && npx vitest run tests/unit/hooks/call-ended.test.ts -t "calls analyzeCallQuality"`
Expected: FAIL — `mockAnalyzeCallQuality` was never called (times out in `vi.waitFor`).

- [ ] **Step 3: Update the source**

In `agent/src/server/routes/hooks.ts`, add the import alongside the existing `logConversation` import:

```ts
import { logConversation } from "../../lib/learning/logConversation.js";
import { analyzeCallQuality } from "../../lib/learning/qaAnalyzer.js";
```

Replace:
```ts
  // Prompt learning loop: log evaluation-criteria results (fire-and-forget; non-blocking)
  void logConversation(conversationId, env.AGENT_CLINIC_ID, payload).catch((err: unknown) =>
    logger.error(
      { errMsg: err instanceof Error ? err.message : String(err), conversationId },
      "hook: logConversation failed",
    ),
  );
```
with:
```ts
  // Prompt learning loop: log evaluation-criteria results, then run per-call QA
  // scoring (fire-and-forget; non-blocking). Chained, not parallel — analyzeCallQuality
  // updates the same call_reviews row logConversation creates, and needs it to exist first.
  void logConversation(conversationId, env.AGENT_CLINIC_ID, payload)
    .then(() => analyzeCallQuality(conversationId, payload))
    .catch((err: unknown) =>
      logger.error(
        { errMsg: err instanceof Error ? err.message : String(err), conversationId },
        "hook: prompt-learning-loop logging failed",
      ),
    );
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd agent && npx vitest run tests/unit/hooks/call-ended.test.ts`
Expected: PASS (all tests in the file)

- [ ] **Step 5: Commit**

```bash
git add agent/src/server/routes/hooks.ts agent/tests/unit/hooks/call-ended.test.ts
git commit -m "$(cat <<'EOF'
feat: run the QA analyzer after every finished call

Chains analyzeCallQuality after logConversation in /hooks/call-ended —
both remain fire-and-forget relative to the webhook response, but
sequential relative to each other so the call_reviews row already
exists (with its NOT NULL columns) before the QA upsert runs.
EOF
)"
```

---

### Task 6: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Typecheck**

Run: `cd agent && npm run typecheck`
Expected: no errors

- [ ] **Step 2: Full test suite**

Run: `cd agent && npm run test`
Expected: PASS, 268 + 5 (claudeJson) + 9 (qaAnalyzer) + 1 (analyzeConversations filter) + 1 (call-ended chaining) = 284 tests

- [ ] **Step 3: Build**

Run: `cd agent && npm run build`
Expected: no errors

- [ ] **Step 4: Lint**

Run: `cd agent && npm run lint`
Expected: no errors

---

### Task 7: Deploy and smoke-test (requires explicit user confirmation)

**Files:** none (deploy + manual verification only)

**⚠️ Do not run the deploy step without the user's explicit go-ahead first** — this session's auto-mode classifier blocked an unconfirmed `flyctl deploy` earlier and required the user to say "מאשר" before it proceeded. Ask before running Step 1.

- [ ] **Step 1: Deploy (after user confirms)**

Run: `cd agent && flyctl deploy --app voxly-agent`
Expected: deploy succeeds, ends with "Visit your newly deployed app at https://voxly-agent.fly.dev/"

- [ ] **Step 2: Health check**

Run: `curl -s https://voxly-agent.fly.dev/health`
Expected: `{"status":"ok",...}`

- [ ] **Step 3: Verify the new columns are reachable via a live query**

Use the Supabase MCP `execute_sql` tool (or `supabase db` from the CLI) against project `xpsuhtqfxqmnunppnyov`:
```sql
select column_name from information_schema.columns
where table_name = 'call_reviews' and column_name = 'is_exception';
```
Expected: one row returned, confirming the migration from Task 1 is live.

- [ ] **Step 4: Trigger a real test call through Tomer (manual, by the user)**

Since `analyzeCallQuality` only runs on a real `/hooks/call-ended` webhook from ElevenLabs, ask the user to place one short test call to the Tomer number. After it ends, verify with:
```sql
select conversation_id, overall_score, is_exception, reviewer_summary
from call_reviews
order by created_at desc
limit 1;
```
Expected: the most recent row has non-null score columns and a Hebrew `reviewer_summary`.

---

## Self-review notes

- **Spec coverage:** data flow (Task 5), schema (Task 1), `qaAnalyzer.ts` incl. deterministic override (Task 4), shared Claude helper refactor (Task 2), weekly job's `is_exception` filter change (Task 3), testing (Tasks 2/3/4/5). Explicitly-out-of-scope items from the spec (aggregation, Provider Admin UI, versioning, eval set) have no tasks here by design.
- **Not covered by this plan, left for later:** the spec's open question about `exception_types` as its own column vs. folded into `problems[].category` — this plan folds it into `problems[].category`/`.priority` per-problem rather than adding a separate array column, since nothing in this plan's scope reads `exception_types` back out. Revisit if Phase 3 needs it as a distinct filterable field.
