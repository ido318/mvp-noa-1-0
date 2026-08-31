# שלב 2: לולאת הצעות מודעת-KB — תוכנית מימוש

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** להפוך את `analyzeConversations.ts` לקבץ בעיות מתועדות (`call_reviews.problems`) לפי `(category, target_file)` ולייצר הצעת-תיקון נפרדת לכל קבוצה שעוברת סף מינימלי; לגייט את `PromptSuggestionService.approve()` כך שרק הצעות `category='prompt'` עוברות regression+publish; לתקן את `publishPrompt()` לפני שהנתיב הזה נהיה בר-הפעלה.

**Architecture:** מיגרציה מוסיפה 4 עמודות ל-`prompt_suggestions` (`category`/`target_file`/`root_cause`/`proposed_change`) והופכת `suggested_prompt` ל-nullable. `analyzeConversations.ts` נכתב מחדש: שאילתה קוראת `problems` (jsonb) במקום `evaluation_criteria_results`/`flagged_reasons`, מקבצת, קוראת ל-Claude פעם אחת לכל קבוצה, כותבת שורה נפרדת לכל קבוצה. `approve()` מסתעף לפי `category`. `publishPrompt()` עובר לדפוס fetch-then-merge שכבר יושם בשלב 1.

**Tech Stack:** TypeScript, Vitest, Supabase Postgres (migration SQL), Anthropic API (דרך `callClaudeForJson` הקיים), ElevenLabs SDK (`elevenlabs` npm package).

**Spec:** `docs/superpowers/specs/2026-08-31-prompt-suggestions-kb-aware-design.md`

---

## מיפוי קבצים

| קובץ | פעולה |
|---|---|
| `supabase/migrations/20260831130000_prompt_suggestions_categories.sql` | חדש |
| `agent/src/lib/learning/analyzeConversations.ts` | שכתוב מלא |
| `agent/tests/unit/learning/analyzeConversations.test.ts` | שכתוב מלא |
| `app/types/domain/prompt-suggestion.ts` | שדות חדשים |
| `app/lib/repositories/prompt-suggestion.repository.ts` | מיפוי שדות חדשים + `markApproved()` |
| `app/tests/unit/prompt-suggestion.repository-race-guard.test.ts` | עדכון fixture + טסט חדש ל-`markApproved` |
| `app/lib/services/prompt-suggestion.service.ts` | גייטינג ב-`approve()` |
| `app/tests/unit/prompt-suggestion.service.test.ts` | עדכון fixture + טסטים חדשים |
| `app/lib/learning/elevenlabsTesting.ts` | תיקון `publishPrompt()` |
| `app/tests/unit/elevenlabs-testing.test.ts` | חדש |

---

### Task 1: מיגרציה — עמודות קטגוריה על `prompt_suggestions`

**Files:**
- Create: `supabase/migrations/20260831130000_prompt_suggestions_categories.sql`

- [ ] **Step 1: כתוב את קובץ המיגרציה**

```sql
-- Stage 2: category-aware prompt suggestions. Only category='prompt' rows
-- carry a full suggested_prompt and go through ElevenLabs regression+publish
-- in PromptSuggestionService.approve(); everything else is marked
-- 'approved' for manual follow-through (KB doc edit, tool change, etc).
alter table public.prompt_suggestions add column category text not null default 'prompt'
  check (category in ('prompt','knowledge_base','tool','backend_logic','conversation_flow'));
alter table public.prompt_suggestions add column target_file text;
alter table public.prompt_suggestions add column root_cause text;
alter table public.prompt_suggestions add column proposed_change text;
alter table public.prompt_suggestions alter column suggested_prompt drop not null;

comment on column public.prompt_suggestions.category is
  'What kind of fix this is — only "prompt" suggestions get auto-published via ElevenLabs regression+publish; everything else is marked approved for manual follow-through.';
```

- [ ] **Step 2: ודא שהמיגרציה תקפה syntactically (בדיקה מקומית, לא מחילה על שום דבר)**

```bash
cd /Users/idoamsalem/mvp-noa-1-0/.worktrees/tomer-prompt-suggestions-stage2
supabase db lint --schema public 2>&1 | tail -20
```
Expected: אין שגיאות syntax חדשות שמקורן בקובץ הזה (הפקודה עשויה להדפיס אזהרות כלליות קיימות — לא קשור).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260831130000_prompt_suggestions_categories.sql
git commit -m "feat(db): add category/target_file/root_cause/proposed_change to prompt_suggestions"
```

**החלה בפועל על הענן — לא בשלב הזה.** נעשית בסוף התוכנית (Task 7), אחרי אישור מפורש, כמו בשלבים 0-1.

---

### Task 2: שכתוב `analyzeConversations.ts` — קיבוץ לפי (category, target_file)

**Files:**
- Modify: `agent/src/lib/learning/analyzeConversations.ts` (שכתוב מלא)
- Test: `agent/tests/unit/learning/analyzeConversations.test.ts` (שכתוב מלא)

- [ ] **Step 1: כתוב את קובץ הטסט המלא (יכשל — עדיין אין implementation תואם)**

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ANTHROPIC_API_KEY default comes from tests/setup.ts (must be set before any
// module that calls getEnv() at import time — e.g. logger.ts — is evaluated).

const { mockFrom, callReviewsSelectResult, insertedIds, insertCalls, callReviewsEqClinicId, callReviewsEqIsException } =
  vi.hoisted(() => {
    const callReviewsSelectResult: { data: unknown[]; error: null } = { data: [], error: null };
    const insertedIds = ["suggestion-1", "suggestion-2", "suggestion-3"];
    const insertCalls: unknown[] = [];
    const callReviewsEqIsException = vi.fn(() => ({ gte: () => Promise.resolve(callReviewsSelectResult) }));
    const callReviewsEqClinicId = vi.fn(() => ({ eq: callReviewsEqIsException }));

    const mockFrom = vi.fn((table: string) => {
      if (table === "call_reviews") {
        return { select: () => ({ eq: callReviewsEqClinicId }) };
      }
      if (table === "prompt_suggestions") {
        return {
          insert: (row: unknown) => {
            insertCalls.push(row);
            const id = insertedIds[insertCalls.length - 1] ?? `suggestion-${insertCalls.length}`;
            return {
              select: () => ({
                single: () => Promise.resolve({ data: { id }, error: null }),
              }),
            };
          },
        };
      }
      throw new Error(`unexpected table: ${table}`);
    });

    return { mockFrom, callReviewsSelectResult, insertedIds, insertCalls, callReviewsEqClinicId, callReviewsEqIsException };
  });

vi.mock("../../../src/lib/supabase.js", () => ({
  getSupabase: vi.fn(() => ({ from: mockFrom })),
}));

import { analyzeConversations } from "../../../src/lib/learning/analyzeConversations.js";

function claudeResponse(pattern_summary: string, proposed_change: string, suggested_prompt: string | null = null) {
  return {
    ok: true,
    json: () =>
      Promise.resolve({
        content: [{ type: "text", text: JSON.stringify({ pattern_summary, proposed_change, suggested_prompt }) }],
      }),
  };
}

beforeEach(() => {
  mockFrom.mockClear();
  callReviewsSelectResult.data = [];
  insertCalls.length = 0;
  callReviewsEqClinicId.mockClear();
  callReviewsEqIsException.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("analyzeConversations", () => {
  it("no-ops when no group reaches the minimum of 2 occurrences", async () => {
    callReviewsSelectResult.data = [
      { id: "r1", problems: [{ problem: "x", category: "prompt", target_file: "a.md" }], transcript_summary: null },
    ];

    const result = await analyzeConversations("clinic-1");

    expect(result).toEqual({ ranAnalysis: false, flaggedCallCount: 1, groupsConsidered: 1, suggestionIds: [] });
    expect(mockFrom).not.toHaveBeenCalledWith("prompt_suggestions");
  });

  it("no-ops on zero flagged calls", async () => {
    const result = await analyzeConversations("clinic-1");
    expect(result).toEqual({ ranAnalysis: false, flaggedCallCount: 0, groupsConsidered: 0, suggestionIds: [] });
  });

  it("filters call_reviews by clinic_id and is_exception", async () => {
    await analyzeConversations("clinic-1");
    expect(callReviewsEqClinicId).toHaveBeenCalledWith("clinic_id", "clinic-1");
    expect(callReviewsEqIsException).toHaveBeenCalledWith("is_exception", true);
  });

  it("throws a clear error when ANTHROPIC_API_KEY is not configured", async () => {
    vi.resetModules();
    const original = process.env["ANTHROPIC_API_KEY"];
    delete process.env["ANTHROPIC_API_KEY"];

    const { analyzeConversations: analyzeWithoutKey } = await import(
      "../../../src/lib/learning/analyzeConversations.js"
    );

    await expect(analyzeWithoutKey("clinic-1")).rejects.toThrow("ANTHROPIC_API_KEY");

    process.env["ANTHROPIC_API_KEY"] = original;
    vi.resetModules();
  });

  it("excludes no_change and unrecognized categories from grouping", async () => {
    callReviewsSelectResult.data = [
      {
        id: "r1",
        problems: [
          { problem: "a", category: "no_change", target_file: "x.md" },
          { problem: "b", category: "not_a_real_category", target_file: "x.md" },
        ],
        transcript_summary: null,
      },
      { id: "r2", problems: [{ problem: "c", category: "no_change", target_file: "x.md" }], transcript_summary: null },
    ];

    const result = await analyzeConversations("clinic-1");

    expect(result).toEqual({ ranAnalysis: false, flaggedCallCount: 2, groupsConsidered: 0, suggestionIds: [] });
  });

  it("groups by (category, target_file) and creates one suggestion per qualifying group", async () => {
    callReviewsSelectResult.data = [
      {
        id: "r1",
        problems: [{ problem: "לא שאל שם", category: "conversation_flow", target_file: "prompt/booking_flow" }],
        transcript_summary: "s1",
      },
      {
        id: "r2",
        problems: [{ problem: "לא שאל שם שוב", category: "conversation_flow", target_file: "prompt/booking_flow" }],
        transcript_summary: "s2",
      },
      {
        id: "r3",
        problems: [{ problem: "מחיר שגוי", category: "knowledge_base", target_file: "kb/pricing_and_visits.md" }],
        transcript_summary: "s3",
      },
    ];

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(claudeResponse("דפוס איסוף פרטים", "להוסיף שלב איסוף שם")));

    const result = await analyzeConversations("clinic-1");

    expect(result.ranAnalysis).toBe(true);
    expect(result.flaggedCallCount).toBe(3);
    expect(result.groupsConsidered).toBe(2);
    expect(result.suggestionIds).toHaveLength(1);
    expect(insertCalls).toHaveLength(1);
    expect(insertCalls[0]).toMatchObject({
      category: "conversation_flow",
      target_file: "prompt/booking_flow",
      suggested_prompt: null,
      supporting_call_review_ids: ["r1", "r2"],
    });
  });

  it("sets suggested_prompt only for category 'prompt'", async () => {
    callReviewsSelectResult.data = [
      { id: "r1", problems: [{ problem: "חוזר על עצמו", category: "prompt" }], transcript_summary: "s1" },
      { id: "r2", problems: [{ problem: "חוזר על עצמו שוב", category: "prompt" }], transcript_summary: "s2" },
    ];

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(claudeResponse("חזרות מיותרות", "להוסיף כלל אנטי-חזרה", "פרומפט מתוקן מלא")),
    );

    await analyzeConversations("clinic-1");

    expect(insertCalls[0]).toMatchObject({
      category: "prompt",
      target_file: null,
      suggested_prompt: "פרומפט מתוקן מלא",
    });
  });

  it("continues to remaining groups when one group's Claude call fails", async () => {
    callReviewsSelectResult.data = [
      { id: "r1", problems: [{ problem: "a", category: "tool", target_file: "check-availability" }], transcript_summary: "s1" },
      { id: "r2", problems: [{ problem: "b", category: "tool", target_file: "check-availability" }], transcript_summary: "s2" },
      { id: "r3", problems: [{ problem: "c", category: "backend_logic", target_file: "scheduling" }], transcript_summary: "s3" },
      { id: "r4", problems: [{ problem: "d", category: "backend_logic", target_file: "scheduling" }], transcript_summary: "s4" },
    ];

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500, text: () => Promise.resolve("server error") })
      .mockResolvedValueOnce(claudeResponse("דפוס תזמון", "לתקן בדיקת זמינות"));
    vi.stubGlobal("fetch", fetchMock);

    const result = await analyzeConversations("clinic-1");

    expect(result.ranAnalysis).toBe(true);
    expect(result.groupsConsidered).toBe(2);
    expect(result.suggestionIds).toHaveLength(1);
    expect(insertCalls).toHaveLength(1);
  });
});
```

- [ ] **Step 2: הרץ את הטסטים וודא שהם נכשלים (עדיין הקוד הישן)**

```bash
cd /Users/idoamsalem/mvp-noa-1-0/.worktrees/tomer-prompt-suggestions-stage2/agent
npx vitest run tests/unit/learning/analyzeConversations.test.ts
```
Expected: FAIL — הקוד הישן מצפה ל-`evaluation_criteria_results`/`flagged_reasons`, מחזיר צורת תוצאה שונה (`suggestionId` יחיד במקום `suggestionIds`), ולא מסנן `no_change`.

- [ ] **Step 3: כתוב את המימוש המלא**

Replace the entire contents of `agent/src/lib/learning/analyzeConversations.ts`:

```typescript
import { getSupabase } from "../supabase.js";
import { getEnv } from "../env.js";
import { logger } from "../logger.js";
import { callClaudeForJson } from "./claudeJson.js";

const MIN_GROUP_SIZE = 2;
const LOOKBACK_DAYS = 7;

const ACTIONABLE_CATEGORIES = ["prompt", "knowledge_base", "tool", "backend_logic", "conversation_flow"] as const;
type ActionableCategory = (typeof ACTIONABLE_CATEGORIES)[number];

function isActionableCategory(value: string): value is ActionableCategory {
  return (ACTIONABLE_CATEGORIES as readonly string[]).includes(value);
}

type QaProblem = {
  moment?: string;
  problem: string;
  root_cause?: string;
  category?: string;
  priority?: string;
  target_file?: string;
  proposed_change?: string;
};

type FlaggedCallReview = {
  id: string;
  problems: QaProblem[] | null;
  transcript_summary: string | null;
};

type GroupedProblem = {
  problem: string;
  root_cause?: string;
  moment?: string;
  callSummary: string | null;
  reviewId: string;
};

type ProblemGroup = {
  category: ActionableCategory;
  targetFile: string | null;
  items: GroupedProblem[];
};

export type AnalyzeConversationsResult = {
  ranAnalysis: boolean;
  flaggedCallCount: number;
  groupsConsidered: number;
  suggestionIds: string[];
};

/**
 * Weekly job: pulls flagged call_reviews from the last 7 days, groups their
 * qaAnalyzer-tagged problems by (category, target_file), and asks Claude
 * once per qualifying group (>= MIN_GROUP_SIZE occurrences) to propose a fix
 * — a full suggested_prompt only when category === 'prompt', otherwise just
 * a pattern_summary + proposed_change for manual follow-through. Writes one
 * prompt_suggestions row per qualifying group.
 */
export async function analyzeConversations(clinicId: string): Promise<AnalyzeConversationsResult> {
  const env = getEnv();
  if (!env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: flaggedReviews, error: reviewsErr } = await getSupabase()
    .from("call_reviews")
    .select("id, problems, transcript_summary")
    .eq("clinic_id", clinicId)
    .eq("is_exception", true)
    .gte("created_at", since);

  if (reviewsErr) throw new Error(`analyzeConversations: call_reviews query failed: ${reviewsErr.message}`);

  const reviews = (flaggedReviews ?? []) as FlaggedCallReview[];
  const groups = groupProblems(reviews);
  const qualifyingGroups = groups.filter((g) => g.items.length >= MIN_GROUP_SIZE);

  if (qualifyingGroups.length === 0) {
    logger.info(
      { clinicId, flaggedCount: reviews.length, groupsConsidered: groups.length },
      "analyzeConversations: no group met the minimum threshold, no-op",
    );
    return { ranAnalysis: false, flaggedCallCount: reviews.length, groupsConsidered: groups.length, suggestionIds: [] };
  }

  const suggestionIds: string[] = [];

  for (const group of qualifyingGroups) {
    try {
      const suggestionId = await createSuggestionForGroup(env.ANTHROPIC_API_KEY, clinicId, group);
      suggestionIds.push(suggestionId);
    } catch (err) {
      logger.error(
        {
          clinicId,
          category: group.category,
          targetFile: group.targetFile,
          errMsg: err instanceof Error ? err.message : String(err),
        },
        "analyzeConversations: failed to create suggestion for group, continuing with remaining groups",
      );
    }
  }

  logger.info(
    { clinicId, flaggedCount: reviews.length, groupsConsidered: groups.length, suggestionsCreated: suggestionIds.length },
    "analyzeConversations: run complete",
  );

  return { ranAnalysis: true, flaggedCallCount: reviews.length, groupsConsidered: groups.length, suggestionIds };
}

function groupProblems(reviews: FlaggedCallReview[]): ProblemGroup[] {
  const groupsByKey = new Map<string, ProblemGroup>();

  for (const review of reviews) {
    for (const problem of review.problems ?? []) {
      const category = problem.category;
      if (!category || !isActionableCategory(category)) continue;

      const targetFile = problem.target_file?.trim() || null;
      const key = `${category}::${targetFile ?? ""}`;

      let group = groupsByKey.get(key);
      if (!group) {
        group = { category, targetFile, items: [] };
        groupsByKey.set(key, group);
      }

      group.items.push({
        problem: problem.problem,
        root_cause: problem.root_cause,
        moment: problem.moment,
        callSummary: review.transcript_summary,
        reviewId: review.id,
      });
    }
  }

  return Array.from(groupsByKey.values());
}

type SuggestionDraft = { pattern_summary: string; proposed_change: string; suggested_prompt: string | null };

async function createSuggestionForGroup(apiKey: string, clinicId: string, group: ProblemGroup): Promise<string> {
  const draft = await requestGroupSuggestion(apiKey, group);

  const rootCauses = Array.from(new Set(group.items.map((i) => i.root_cause).filter((v): v is string => Boolean(v))));

  const { data: inserted, error: insertErr } = await getSupabase()
    .from("prompt_suggestions")
    .insert({
      clinic_id: clinicId,
      status: "pending",
      category: group.category,
      target_file: group.targetFile,
      pattern_summary: draft.pattern_summary,
      proposed_change: draft.proposed_change,
      root_cause: rootCauses.length > 0 ? rootCauses.join(" | ") : null,
      suggested_prompt: draft.suggested_prompt,
      supporting_call_review_ids: group.items.map((i) => i.reviewId),
    })
    .select("id")
    .single();

  if (insertErr) throw new Error(`analyzeConversations: prompt_suggestions insert failed: ${insertErr.message}`);

  return inserted.id as string;
}

async function requestGroupSuggestion(apiKey: string, group: ProblemGroup): Promise<SuggestionDraft> {
  const systemPrompt =
    `אתה עוזר שמנתח דפוס חוזר של בעיות מסוג "${group.category}" בקוד/פרומפט/תוכן של תומר, סוכן קולי וטרינרי בעברית. ` +
    `קיבלת ${group.items.length} מקרים מתועדים עם אותו category ואותו target_file ("${group.targetFile ?? "(ריק)"}"). ` +
    "זהה את הדפוס המשותף והצע תיקון קונקרטי.\n\n" +
    'אם category=="prompt": הצע גם נוסח מלא ומתוקן לפרומפט המערכת (suggested_prompt). אחרת: השאר suggested_prompt כ-null — רק pattern_summary + proposed_change.\n\n' +
    'החזר אך ורק JSON: {"pattern_summary": "...", "proposed_change": "...", "suggested_prompt": "..." | null}';

  const cases = group.items.map((i) => ({
    problem: i.problem,
    root_cause: i.root_cause ?? null,
    moment: i.moment ?? null,
    call_summary: i.callSummary,
  }));

  const parsed = await callClaudeForJson(apiKey, systemPrompt, { cases });

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    typeof (parsed as Record<string, unknown>)["pattern_summary"] !== "string" ||
    typeof (parsed as Record<string, unknown>)["proposed_change"] !== "string"
  ) {
    throw new Error("Anthropic API JSON missing required fields");
  }

  const record = parsed as Record<string, unknown>;
  const suggestedPrompt = typeof record["suggested_prompt"] === "string" ? record["suggested_prompt"] : null;

  return {
    pattern_summary: record["pattern_summary"] as string,
    proposed_change: record["proposed_change"] as string,
    suggested_prompt: suggestedPrompt,
  };
}
```

- [ ] **Step 4: הרץ את הטסטים וודא שהם עוברים**

```bash
npx vitest run tests/unit/learning/analyzeConversations.test.ts
```
Expected: כל הטסטים (9) עוברים.

- [ ] **Step 5: הרץ את כל חבילת הטסטים של agent לוודא שלא נשבר כלום אחר**

```bash
npx vitest run
```
Expected: כל 29 קבצי הטסט עוברים.

- [ ] **Step 6: Commit**

```bash
cd /Users/idoamsalem/mvp-noa-1-0/.worktrees/tomer-prompt-suggestions-stage2
git add agent/src/lib/learning/analyzeConversations.ts agent/tests/unit/learning/analyzeConversations.test.ts
git commit -m "feat: group call_reviews.problems by (category, target_file) for weekly prompt-suggestion job"
```

---

### Task 3: עדכון `app/types/domain/prompt-suggestion.ts`

**Files:**
- Modify: `app/types/domain/prompt-suggestion.ts`

- [ ] **Step 1: החלף את תוכן הקובץ**

```typescript
export type PromptSuggestionStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "published"
  | "failed_regression";

export type PromptSuggestionCategory =
  | "prompt"
  | "knowledge_base"
  | "tool"
  | "backend_logic"
  | "conversation_flow";

export interface PromptSuggestion {
  id: string;
  clinicId: string;
  status: PromptSuggestionStatus;
  category: PromptSuggestionCategory;
  targetFile: string | null;
  patternSummary: string;
  proposedChange: string | null;
  rootCause: string | null;
  suggestedPrompt: string | null;
  supportingCallReviewIds: string[];
  regressionResult: Record<string, unknown> | null;
  previousPrompt: Record<string, unknown> | null;
  publishResult: Record<string, unknown> | null;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  publishedAt: string | null;
  createdAt: string;
}

export interface RegressionOutcome {
  /** null when the run-tests response shape couldn't be confidently parsed — never publish in that case. */
  allPassed: boolean | null;
  raw: Record<string, unknown>;
}
```

(`proposedChange`/`rootCause` are nullable — the migration adds them without `not null`, so rows created before this change still have `null`. New rows written by `analyzeConversations.ts` always populate `proposedChange`.)

- [ ] **Step 2: Commit**

```bash
git add app/types/domain/prompt-suggestion.ts
git commit -m "feat(types): add category/targetFile/rootCause/proposedChange to PromptSuggestion"
```

(Typecheck runs at the end of Task 5, after the repository/service consumers are updated — this file alone won't compile standalone since nothing has been updated to match yet.)

---

### Task 4: עדכון `PromptSuggestionRepository` — מיפוי שדות + `markApproved`

**Files:**
- Modify: `app/lib/repositories/prompt-suggestion.repository.ts`
- Modify: `app/tests/unit/prompt-suggestion.repository-race-guard.test.ts`

- [ ] **Step 1: עדכן את ה-fixture בטסט הקיים כדי לכלול את השדות החדשים**

In `app/tests/unit/prompt-suggestion.repository-race-guard.test.ts`, replace the `suggestionRow` object:

```typescript
const suggestionRow = {
  id: "sugg-1",
  clinic_id: "clinic-1",
  status: "rejected",
  category: "prompt",
  target_file: null,
  pattern_summary: "x",
  proposed_change: "y",
  root_cause: null,
  suggested_prompt: "y",
  supporting_call_review_ids: [],
  regression_result: null,
  previous_prompt: null,
  publish_result: null,
  reviewed_by_user_id: "user-1",
  reviewed_at: "2026-08-28T00:00:00.000Z",
  published_at: null,
  created_at: "2026-08-27T00:00:00.000Z",
};
```

- [ ] **Step 2: הוסף טסט חדש ל-`markApproved` באותו קובץ, בסוף ה-`describe` block**

```typescript
  it("markApproved scopes the update to status='pending' (compare-and-set)", async () => {
    const query = buildQuery({ data: { ...suggestionRow, status: "approved" }, error: null });
    const client = { from: vi.fn().mockReturnValue(query) };
    const repo = new PromptSuggestionRepository(client as never);

    const result = await repo.markApproved("sugg-1", "user-1");

    expect(result.ok).toBe(true);
    expect(query.eq).toHaveBeenNthCalledWith(1, "id", "sugg-1");
    expect(query.eq).toHaveBeenNthCalledWith(2, "status", "pending");
  });

  it("markApproved returns a 409 conflict when a concurrent review already claimed the row", async () => {
    const query = buildQuery({ data: null, error: { code: "PGRST116", message: "no rows" } });
    const client = { from: vi.fn().mockReturnValue(query) };
    const repo = new PromptSuggestionRepository(client as never);

    const result = await repo.markApproved("sugg-1", "user-1");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.status).toBe(409);
  });
```

- [ ] **Step 3: הרץ את הטסטים וודא שהם נכשלים (עדיין אין `markApproved`)**

```bash
cd /Users/idoamsalem/mvp-noa-1-0/.worktrees/tomer-prompt-suggestions-stage2/app
npx vitest run tests/unit/prompt-suggestion.repository-race-guard.test.ts
```
Expected: FAIL — `repo.markApproved is not a function`.

- [ ] **Step 4: עדכן את `mapPromptSuggestionRow` ב-`app/lib/repositories/prompt-suggestion.repository.ts`**

Replace the function:

```typescript
function mapPromptSuggestionRow(row: Record<string, unknown>): PromptSuggestion {
  return {
    id: row.id as string,
    clinicId: row.clinic_id as string,
    status: row.status as PromptSuggestionStatus,
    category: row.category as PromptSuggestionCategory,
    targetFile: (row.target_file as string | null) ?? null,
    patternSummary: row.pattern_summary as string,
    proposedChange: (row.proposed_change as string | null) ?? null,
    rootCause: (row.root_cause as string | null) ?? null,
    suggestedPrompt: (row.suggested_prompt as string | null) ?? null,
    supportingCallReviewIds: (row.supporting_call_review_ids as string[] | null) ?? [],
    regressionResult: (row.regression_result as Record<string, unknown> | null) ?? null,
    previousPrompt: (row.previous_prompt as Record<string, unknown> | null) ?? null,
    publishResult: (row.publish_result as Record<string, unknown> | null) ?? null,
    reviewedByUserId: (row.reviewed_by_user_id as string | null) ?? null,
    reviewedAt: (row.reviewed_at as string | null) ?? null,
    publishedAt: (row.published_at as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}
```

Update the import line at the top of the file:

```typescript
import type { PromptSuggestion, PromptSuggestionCategory, PromptSuggestionStatus } from "@/types/domain/prompt-suggestion";
```

- [ ] **Step 5: הוסף את `markApproved` ל-class, מיד אחרי `markRejected`**

```typescript
  /** Guarded by `.eq("status", "pending")` — a concurrent review already in flight loses this race cleanly. */
  async markApproved(id: string, reviewedByUserId: string): Promise<Result<PromptSuggestion>> {
    const { data, error } = await this.client
      .from("prompt_suggestions")
      .update({
        status: "approved",
        reviewed_by_user_id: reviewedByUserId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("status", "pending")
      .select("*")
      .single();
    if (error) {
      if (isNoRowsMatchedError(error)) {
        return err(AppError.conflict("Prompt suggestion was already reviewed by someone else"));
      }
      return err(AppError.externalProvider("Failed to approve prompt suggestion", error));
    }
    return ok(mapPromptSuggestionRow(data));
  }
```

- [ ] **Step 6: הרץ את הטסטים וודא שהם עוברים**

```bash
npx vitest run tests/unit/prompt-suggestion.repository-race-guard.test.ts
```
Expected: כל הטסטים עוברים (5 ישנים + 2 חדשים).

- [ ] **Step 7: Commit**

```bash
git add app/lib/repositories/prompt-suggestion.repository.ts app/tests/unit/prompt-suggestion.repository-race-guard.test.ts
git commit -m "feat: add PromptSuggestionRepository.markApproved and map new category columns"
```

---

### Task 5: גייטינג ב-`PromptSuggestionService.approve()`

**Files:**
- Modify: `app/lib/services/prompt-suggestion.service.ts`
- Modify: `app/tests/unit/prompt-suggestion.service.test.ts`

- [ ] **Step 1: עדכן את ה-`suggestion()` factory בטסט הקיים**

In `app/tests/unit/prompt-suggestion.service.test.ts`, replace the `suggestion()` function's returned object to include the new fields (default `category: "prompt"` so every existing test — which exercises the prompt/regression/publish path — keeps passing unchanged):

```typescript
function suggestion(overrides: Partial<PromptSuggestion> = {}): PromptSuggestion {
  return {
    id: "sugg-1",
    clinicId: TARGET_CLINIC,
    status: "pending",
    category: "prompt",
    targetFile: null,
    patternSummary: "תומר משתמש בביטוי אסור",
    proposedChange: "להסיר את הביטוי מהפרומפט",
    rootCause: null,
    suggestedPrompt: "פרומפט מתוקן",
    supportingCallReviewIds: ["r1", "r2"],
    regressionResult: null,
    previousPrompt: null,
    publishResult: null,
    reviewedByUserId: null,
    reviewedAt: null,
    publishedAt: null,
    createdAt: "2026-08-20T09:00:00.000Z",
    ...overrides,
  };
}
```

- [ ] **Step 2: הוסף `markApproved` ל-`baseRepo()`**

```typescript
function baseRepo() {
  return {
    listByStatus: vi.fn().mockResolvedValue(ok([suggestion()])),
    findById: vi.fn().mockResolvedValue(ok(suggestion())),
    markRejected: vi.fn().mockResolvedValue(ok(suggestion({ status: "rejected" }))),
    markApproved: vi.fn().mockResolvedValue(ok(suggestion({ status: "approved" }))),
    recordRegressionResult: vi.fn().mockImplementation((_id, input) =>
      Promise.resolve(ok(suggestion({ status: input.status, regressionResult: input.regressionResult }))),
    ),
    markPublished: vi.fn().mockImplementation((_id, input) =>
      Promise.resolve(
        ok(
          suggestion({
            status: "published",
            regressionResult: input.regressionResult,
            previousPrompt: input.previousPrompt,
            publishResult: input.publishResult,
          }),
        ),
      ),
    ),
  };
}
```

- [ ] **Step 3: הוסף טסטים חדשים בסוף ה-`describe("PromptSuggestionService.approve", ...)` block**

```typescript
  it("marks non-prompt categories approved without running regression or publish", async () => {
    const { service, repo } = buildService({
      findById: vi.fn().mockResolvedValue(ok(suggestion({ category: "knowledge_base", suggestedPrompt: null }))),
    });

    const result = await service.approve(adminActor, "sugg-1");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("approved");
    expect(repo.markApproved).toHaveBeenCalledWith("sugg-1", adminActor.userId);
    expect(mockRunRegressionTests).not.toHaveBeenCalled();
    expect(mockPublishPrompt).not.toHaveBeenCalled();
  });

  it.each(["tool", "backend_logic", "conversation_flow"] as const)(
    "marks category '%s' approved without publish, same as knowledge_base",
    async (category) => {
      const { service, repo } = buildService({
        findById: vi.fn().mockResolvedValue(ok(suggestion({ category, suggestedPrompt: null }))),
      });

      const result = await service.approve(adminActor, "sugg-1");

      expect(result.ok).toBe(true);
      expect(repo.markApproved).toHaveBeenCalledOnce();
      expect(mockRunRegressionTests).not.toHaveBeenCalled();
    },
  );
```

- [ ] **Step 4: הרץ את הטסטים וודא שהחדשים נכשלים (הגייטינג עדיין לא קיים ב-service)**

```bash
cd /Users/idoamsalem/mvp-noa-1-0/.worktrees/tomer-prompt-suggestions-stage2/app
npx vitest run tests/unit/prompt-suggestion.service.test.ts
```
Expected: FAIL — כרגע `approve()` תמיד מריץ regression גם ל-`category='knowledge_base'`, אז `mockRunRegressionTests` נקרא כשהטסט מצפה שלא.

- [ ] **Step 5: עדכן את `approve()` ב-`app/lib/services/prompt-suggestion.service.ts`**

Replace the method body:

```typescript
  /**
   * Regression-tests the candidate prompt before publishing. Only publishes
   * when every test passed AND the response could be confidently parsed —
   * an ambiguous response leaves the suggestion pending with the raw result
   * attached, never publishing on an unverified guess. Only category='prompt'
   * suggestions carry a suggested_prompt at all — everything else is marked
   * approved directly, for manual follow-through outside this pipeline.
   */
  async approve(actor: ServiceActor, id: string): Promise<Result<PromptSuggestion>> {
    const existing = await this.repo.findById(id);
    if (!existing.ok) return existing;
    if (!existing.value) return err(AppError.notFound("Prompt suggestion not found"));
    const suggestion = existing.value;

    if (!hasPrivilegedClinicRole(actor, suggestion.clinicId)) {
      return err(AppError.forbidden("Only owner or admin can approve prompt suggestions"));
    }
    if (suggestion.status !== "pending") {
      return err(AppError.conflict(`Prompt suggestion already ${suggestion.status}`));
    }

    if (suggestion.category !== "prompt") {
      return this.repo.markApproved(id, actor.userId);
    }

    if (!suggestion.suggestedPrompt) {
      return err(AppError.internal("prompt suggestion is missing suggested_prompt despite category='prompt'"));
    }

    const regression = await runRegressionTests(suggestion.suggestedPrompt).catch((error: unknown) => {
      throw AppError.externalProvider(
        "Failed to run ElevenLabs regression tests",
        error instanceof Error ? error.message : error,
      );
    });

    if (regression.allPassed !== true) {
      // Covers both a confirmed failure and an ambiguous/unparseable response —
      // either way we do not publish. Status distinguishes the two for the UI.
      return this.repo.recordRegressionResult(id, {
        status: regression.allPassed === false ? "failed_regression" : "pending",
        regressionResult: regression.raw,
        reviewedByUserId: actor.userId,
      });
    }

    let previousPrompt: Record<string, unknown>;
    let publishResult: Record<string, unknown>;
    try {
      previousPrompt = await getLiveAgentConfig();
      publishResult = await publishPrompt(suggestion.suggestedPrompt);
    } catch (error) {
      return err(
        AppError.externalProvider(
          "Regression passed but publish failed",
          error instanceof Error ? error.message : error,
        ),
      );
    }

    return this.repo.markPublished(id, {
      regressionResult: regression.raw,
      previousPrompt,
      publishResult,
      reviewedByUserId: actor.userId,
    });
  }
```

- [ ] **Step 6: הרץ את הטסטים וודא שהם עוברים**

```bash
npx vitest run tests/unit/prompt-suggestion.service.test.ts
```
Expected: כל הטסטים עוברים (הישנים + 4 החדשים, כולל 3 מ-`it.each`).

- [ ] **Step 7: הרץ typecheck לכל ה-app (הטיפוסים תלויים אחד בשני על פני 3 הקבצים שעודכנו עד כה)**

```bash
cd /Users/idoamsalem/mvp-noa-1-0/.worktrees/tomer-prompt-suggestions-stage2/app
npx tsc --noEmit
```
Expected: exit 0.

- [ ] **Step 8: Commit**

```bash
git add app/lib/services/prompt-suggestion.service.ts app/tests/unit/prompt-suggestion.service.test.ts
git commit -m "feat: gate PromptSuggestionService.approve() on category === 'prompt'"
```

---

### Task 6: תיקון `publishPrompt()` — fetch-then-merge

**Files:**
- Modify: `app/lib/learning/elevenlabsTesting.ts`
- Test: `app/tests/unit/elevenlabs-testing.test.ts` (חדש)

- [ ] **Step 1: כתוב את קובץ הטסט החדש**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetAgent = vi.fn();
const mockUpdateAgent = vi.fn();

vi.mock("elevenlabs", () => ({
  ElevenLabsClient: vi.fn().mockImplementation(() => ({
    conversationalAi: {
      getAgent: mockGetAgent,
      updateAgent: mockUpdateAgent,
    },
  })),
}));

process.env.ELEVENLABS_API_KEY = "test-key";
process.env.ELEVENLABS_AGENT_ID = "test-agent";
process.env.ELEVENLABS_TEST_IDS = "test-1,test-2";

import { publishPrompt } from "@/lib/learning/elevenlabsTesting";

beforeEach(() => {
  mockGetAgent.mockReset();
  mockUpdateAgent.mockReset();
});

describe("publishPrompt", () => {
  it("preserves the live agent's tools, knowledge_base, and rag when publishing a new prompt", async () => {
    mockGetAgent.mockResolvedValue({
      agent_id: "test-agent",
      name: "Tomer",
      conversation_config: {
        agent: {
          prompt: {
            prompt: "old prompt",
            tools: [{ type: "webhook", name: "lookup-customer" }],
            knowledge_base: [{ type: "text", name: "tomer-kb-clinic_info", id: "doc-1", usage_mode: "prompt" }],
            rag: { enabled: false },
          },
        },
      },
      metadata: {},
    });
    mockUpdateAgent.mockResolvedValue({ agent_id: "test-agent" });

    await publishPrompt("new prompt text");

    expect(mockUpdateAgent).toHaveBeenCalledWith("test-agent", {
      conversation_config: {
        agent: {
          prompt: {
            prompt: "new prompt text",
            tools: [{ type: "webhook", name: "lookup-customer" }],
            knowledge_base: [{ type: "text", name: "tomer-kb-clinic_info", id: "doc-1", usage_mode: "prompt" }],
            rag: { enabled: false },
          },
        },
      },
    });
  });

  it("still publishes with undefined tools/knowledge_base/rag when the live agent has none set", async () => {
    mockGetAgent.mockResolvedValue({
      agent_id: "test-agent",
      name: "Tomer",
      conversation_config: { agent: { prompt: { prompt: "old prompt" } } },
      metadata: {},
    });
    mockUpdateAgent.mockResolvedValue({ agent_id: "test-agent" });

    await publishPrompt("new prompt text");

    expect(mockUpdateAgent).toHaveBeenCalledWith("test-agent", {
      conversation_config: {
        agent: {
          prompt: {
            prompt: "new prompt text",
            tools: undefined,
            knowledge_base: undefined,
            rag: undefined,
          },
        },
      },
    });
  });
});
```

- [ ] **Step 2: הרץ את הטסטים וודא שהם נכשלים**

```bash
cd /Users/idoamsalem/mvp-noa-1-0/.worktrees/tomer-prompt-suggestions-stage2/app
npx vitest run tests/unit/elevenlabs-testing.test.ts
```
Expected: FAIL — `mockUpdateAgent` נקרא כרגע רק עם `{ prompt: { prompt: newPromptText } }`, בלי `tools`/`knowledge_base`/`rag`, ו-`mockGetAgent` בכלל לא נקרא.

- [ ] **Step 3: עדכן את `publishPrompt()` ב-`app/lib/learning/elevenlabsTesting.ts`**

Replace the function:

```typescript
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

  const current = await client.conversationalAi.getAgent(agentId);
  const currentPrompt = current.conversation_config.agent?.prompt;

  const updated = await client.conversationalAi.updateAgent(agentId, {
    conversation_config: {
      agent: {
        prompt: {
          prompt: newPromptText,
          tools: currentPrompt?.tools,
          knowledge_base: currentPrompt?.knowledge_base,
          rag: currentPrompt?.rag,
        },
      },
    },
  });
  return updated as unknown as Record<string, unknown>;
}
```

- [ ] **Step 4: הרץ את הטסטים וודא שהם עוברים**

```bash
npx vitest run tests/unit/elevenlabs-testing.test.ts
```
Expected: שני הטסטים עוברים.

- [ ] **Step 5: הרץ typecheck**

```bash
npx tsc --noEmit
```
Expected: exit 0.

- [ ] **Step 6: הרץ את כל חבילת הטסטים של app**

```bash
npx vitest run
```
Expected: כל הקבצים עוברים (כולל `prompt-suggestion.service.test.ts` שממשיך להזריק `getLiveAgentConfig`/`publishPrompt` ממוקים ולא מושפע מהשינוי הפנימי).

- [ ] **Step 7: Commit**

```bash
git add app/lib/learning/elevenlabsTesting.ts app/tests/unit/elevenlabs-testing.test.ts
git commit -m "fix: preserve tools/knowledge_base/rag when publishing a prompt suggestion"
```

---

### Task 7: אימות מלא + החלת המיגרציה

**Files:** none — verification + deployment only.

- [ ] **Step 1: הרץ את כל שתי חבילות הטסטים מה-root**

```bash
cd /Users/idoamsalem/mvp-noa-1-0/.worktrees/tomer-prompt-suggestions-stage2
npm run test:all
```
Expected: agent + app שניהם ירוקים במלואם.

- [ ] **Step 2: הרץ typecheck מלא**

```bash
npm run typecheck:all
```
Expected: exit 0.

- [ ] **Step 3: עצור לאישור מפורש לפני החלת המיגרציה על הענן**

זו נקודת עצירה חובה (עקבי עם שלבים 0-1) — `supabase db push --linked` משנה סכמה על ה-DB בפרודקשן. **אל תריץ בלי אישור.**

לאחר אישור:
```bash
supabase db push --linked
```
Expected: מחיל רק את `20260831130000_prompt_suggestions_categories.sql` (כל מה שלפניו כבר "already applied" משלבים קודמים).

- [ ] **Step 4: הרצה ידנית אחת מול נתונים אמיתיים בענן**

```bash
cd agent
node --env-file=.env --import tsx/esm -e "
import { analyzeConversations } from './src/lib/learning/analyzeConversations.js';
const result = await analyzeConversations(process.env.AGENT_CLINIC_ID);
console.log(JSON.stringify(result, null, 2));
"
```
Expected: אצל כל שיחות הבדיקה משלב 1 שכבר יש להן `is_exception=true` ו-`problems` אמיתיים ב-`call_reviews` — לוודא שנוצרות שורות `prompt_suggestions` הגיוניות (או no-op אם אין קבוצה שעוברת סף של 2, שזה תוצאה סבירה בהתחשב בכמות השיחות הקטנה שיש כרגע).

- [ ] **Step 5: קריאה ידנית של השורות שנוצרו (אם נוצרו) ב-`prompt_suggestions`**

```bash
```
(שאילתת SQL ידנית מול הענן — לא חלק מהקוד, רק אימות.)

---

## Self-Review

**כיסוי ה-spec:** מיגרציה (Task 1) ✓, קיבוץ+אגרגציה+כתיבה מרובת-שורות (Task 2) ✓, סוג-נתונים מעודכן (Task 3) ✓, repository+`markApproved` (Task 4) ✓, גייטינג ב-`approve()` (Task 5) ✓, תיקון `publishPrompt()` (Task 6) ✓, אימות+מיגרציה (Task 7) ✓. כל סעיפי ה"מפורש מחוץ לסקופ" בספק (UI, RAG ב-regression, clustering סמנטי, שינוי cron) — לא נגעו בהם, כנדרש.

**סריקת placeholders:** אין TBD/TODO — כל קוד ה-tasks מלא ומוכן להעתקה.

**עקביות טיפוסים:** `PromptSuggestion.category`/`targetFile`/`proposedChange`/`rootCause` (Task 3) תואמים בדיוק לשמות/טיפוסים שמשתמשים בהם Task 4 (`mapPromptSuggestionRow`) ו-Task 5 (`suggestion.category`, `suggestion.suggestedPrompt`). `AnalyzeConversationsResult.suggestionIds: string[]` (Task 2) — אין קוד צרכני קיים שמצפה לשם הישן `suggestionId` (בדוק: `jobs.ts`'s `/analyze-conversations` route רק עושה `logger.info(result, ...)` ו-`return c.json(result)` — לא ניגש לשדה ספציפי, אין breakage).
