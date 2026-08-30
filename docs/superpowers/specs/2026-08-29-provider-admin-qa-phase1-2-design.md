# Provider Admin QA — Phase 1+2 (Capture + Automatic QA) — Design Spec

**Date:** 2026-08-29
**Status:** Approved by user (Ido). Implemented in full (Tasks 1-7 of `docs/superpowers/plans/2026-08-29-qa-analyzer-phase1-2.md`), deployed, verified via a real call. **Post-implementation correction (2026-08-30):** the write path described below as `.upsert(..., {onConflict: "conversation_id"})` was found to be a real production bug — Postgres validates NOT NULL constraints against the raw INSERT VALUES tuple before checking for a conflict, so the upsert failed on every real call even though the target row already existed. Fixed to `.update({...}).eq("conversation_id", conversationId)` (commit `07e4af0` on `feat/qa-analyzer-phase1-2`). See `docs/superpowers/plans/2026-08-30-tomer-qa-kb-provider-admin-roadmap.md` for what comes next.
**Source:** `tomer_provider_admin_qa_implementation.md` (external spec dropped on the Desktop), a much larger multi-phase "Provider Admin + QA + Continuous Improvement" plan. This spec covers only Phases 1+2 of that document (Capture + Automatic QA). Phases 3-6 (richer improvement-suggestion aggregation, Provider Admin dashboard UI + auth, prompt/KB versioning, regression eval set) are explicitly out of scope — separate specs later.

## Problem

Earlier in this session, fixing the pg_cron job for the existing weekly prompt-learning loop (`agent/src/lib/learning/analyzeConversations.ts`, `call_reviews`, `prompt_suggestions`) surfaced that the loop only has binary pass/fail signal per call, sourced for free from ElevenLabs' `evaluation_criteria_results`. The external spec proposes a much richer QA layer: a dedicated LLM call per finished conversation, scoring it 0–10 across 6 fixed dimensions (empathy, naturalness, accuracy, protocol, safety, resolution), producing a structured exception classification and per-problem root-cause analysis — immediately after every call, not batched weekly.

The external spec's own schema (`agent_calls`, `call_qa_reviews`, `agent_improvement_suggestions`) duplicates what already exists and works (`voice_calls`, `call_reviews`, `prompt_suggestions`) under different names. This spec adopts the *capability* (per-call scored QA) while extending the existing tables/code rather than replacing them, per user's explicit choice.

## Decisions made during brainstorming

1. **Extend, don't replace.** `call_reviews` gains new columns for the scored QA; `voice_calls`/`prompt_suggestions` untouched in structure (only the weekly job's filter changes).
2. **QA runs immediately per call**, not batched — a dedicated Claude call per finished conversation, async/fire-and-forget (never blocks `/hooks/call-ended`'s response).
3. **`is_exception` replaces `flagged` as the weekly job's trigger field.** `flagged`/`flagged_reasons` (ElevenLabs-sourced, free) stay on the row for reference but no longer drive `analyzeConversations.ts`'s query.
4. **QA Analyzer output (`reviewer_summary`, `strengths`, `problems[].problem`/`.root_cause`/`.proposed_change`) is written in Hebrew** — matches the existing `prompt_suggestions.pattern_summary` convention and is read by Hebrew-speaking staff.

## Data flow

```
/hooks/call-ended
  → saveVoiceCall()                                   (fast path, blocks response)
  → logConversation(...).then(() => analyzeCallQuality(...)).catch(...)   (async, non-blocking)
       logConversation: upserts base call_reviews row (agent_id, transcript, evaluation_criteria_results, flagged, ...)
       analyzeCallQuality: runs only after the row exists; updates the same row with QA scores
```

`analyzeCallQuality` is chained (not parallel) after `logConversation` specifically because `call_reviews.agent_id`/`.transcript` are `NOT NULL` with no default — if the QA analyzer's upsert raced ahead and inserted the row first, it would violate those constraints. Supabase upsert with `onConflict` only updates the columns present in that call's payload, so two sequential upserts against the same `conversation_id` — one setting capture fields, one setting QA fields — is safe.

## Schema change

New migration, additive columns on `public.call_reviews` (table currently empty, no backfill needed):

```sql
alter table public.call_reviews add column
  overall_score numeric(4,2),
  empathy_score numeric(4,2),
  naturalness_score numeric(4,2),
  accuracy_score numeric(4,2),
  protocol_score numeric(4,2),
  safety_score numeric(4,2),
  resolution_score numeric(4,2),
  is_exception boolean not null default false,
  exception_severity text check (exception_severity in ('none','low','medium','high','critical')),
  strengths text[] not null default '{}',
  problems jsonb not null default '[]'::jsonb,
  reviewer_summary text,
  analyzer_model text,
  qa_analyzed_at timestamptz;

create index if not exists call_reviews_is_exception_idx
  on public.call_reviews (is_exception, created_at desc) where is_exception = true;
```

`qa_analyzed_at` distinguishes "not yet analyzed" (null) from "analyzed, no exception found" (set, `is_exception = false`) — needed since QA analysis can lag or fail independently of the row's existence.

## New module: `agent/src/lib/learning/qaAnalyzer.ts`

- `analyzeCallQuality(conversationId: string, clinicId: string, payload: Record<string, unknown>): Promise<void>`
- Builds a plain-text transcript from `payload.transcript` (array of `{ role, message, time_in_call_secs }`).
- Calls Claude with a system prompt adapted from the external spec's §10 rubric (6 dimensions), translated to request Hebrew `reviewer_summary`/`strengths`/`problems[].problem`/`.root_cause`/`.proposed_change`, English enum values for `category`/`priority`/`exception_severity` (matches existing `prompt_suggestions.category` check-constraint values).
- Expects strict JSON matching the external spec's §11 shape (scores object, `is_exception`, `exception_severity`, `exception_types`, `strengths`, `problems[]`, `summary`). Validate required fields before writing; on a malformed response, log and skip (no throw, no partial write).
- **Deterministic override on top of the LLM's own judgment** (external spec §12's thresholds, enforced in code rather than trusted to the model alone): if `safety_score < 9` or `accuracy_score < 8` or `protocol_score < 7` or `overall_score < 7`, force `is_exception = true` and raise `exception_severity` to at least `medium` regardless of what the model returned.
- Upserts `call_reviews` (`onConflict: "conversation_id"`) with only the QA columns.
- Never throws — every failure path (missing `ANTHROPIC_API_KEY`, fetch failure, bad JSON, Supabase error) is caught and logged, matching `logConversation.ts`'s existing non-blocking pattern.

**Refactor alongside this:** extract the Claude-call-plus-markdown-fence-stripping logic currently inlined in `analyzeConversations.ts`'s `requestPromptSuggestion` into a shared helper (e.g. `agent/src/lib/learning/claudeJson.ts`), used by both `qaAnalyzer.ts` and `analyzeConversations.ts`, so the two Claude-calling call sites don't duplicate the same fetch/parse/fence-stripping code.

## Change to `agent/src/lib/learning/analyzeConversations.ts`

Minimal: swap the query filter from `.eq("flagged", true)` to `.eq("is_exception", true)`. The suggestion-generation logic itself (still reading `evaluation_criteria_results`/`flagged_reasons` for now) is intentionally left untouched — upgrading it to consume the richer per-call `problems` field belongs to a later Phase 3 (aggregation) spec, not this one.

## Testing

- `agent/tests/unit/learning/qaAnalyzer.test.ts` (new): successful scoring + upsert, deterministic override forces `is_exception` when the LLM under-reports it, Claude fetch failure is caught and logged (doesn't throw), malformed JSON is caught and logged, missing `ANTHROPIC_API_KEY` is caught and logged.
- `agent/tests/unit/hooks/call-ended.test.ts`: extend the existing `logConversation` fire-and-forget test to assert `analyzeCallQuality` is called after `logConversation` resolves (chained, not parallel).
- `agent/tests/unit/learning/analyzeConversations.test.ts`: update the mocked query chain's field name (`flagged` → `is_exception`) — no new behavior to test here.

## Explicitly out of scope (later specs)

- `agent_improvement_suggestions`-style richer suggestion schema (category/target_file/root_cause) and cross-call aggregation (external spec §17–18) — Phase 3.
- `/provider-admin/*` dashboard UI and `provider_admin` role/authorization (external spec §13–17) — Phase 4. Note: the external spec assumes a simple `profiles.role` column; this project's existing auth model uses `clinic_role` on `clinic_memberships` instead — reconciling those is a decision for the Phase 4 spec, not this one.
- `agent_versions` (Prompt/Knowledge Base versioning + rollback) — Phase 5.
- `agent_eval_cases` (regression test scenarios) — Phase 6.

## Open questions for implementation planning

- Exact Claude system prompt wording for the QA Analyzer (Hebrew instructions, following the external spec's §10 rubric) — draft during planning, not fixed here.
- Whether `exception_types` (a text array of short tags, per the external spec's §11 example — e.g. `missing_protocol_question`) is worth storing as its own column now or folding into `problems[].category` — implementation plan to decide; leaning toward folding in to avoid an extra column with unclear ownership.
