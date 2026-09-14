# דשבורד Provider Admin — תוכנית מימוש

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** לבנות דשבורד Provider Admin עצמאי (`/provider-admin/*`) המציג שיחות עם ציוני QA וחריגות, ותיבת אישור/דחייה להצעות תיקון (`tomer_prompt_suggestions`), מוגן ע"י role חדש (`profiles.role='provider_admin'`), עם UI ב-Graphite Pro.

**Architecture:** Migration מוסיפה `profiles.role`. `requireProviderAdmin()` guard חדש (session + role, לא clinic-scoped) מגן על routes ו-API. `CallReviewRepository/Service` חדשים קוראים מ-`call_reviews` בלי סינון clinic. `PromptSuggestionService` הקיים עובר רפקטור — מסיר גייטינג clinic-role, הגייטינג עובר ל-guard ברמת ה-route. 3 מסכי UI (`calls`, `calls/[id]`, `improvements`) ברכיבי Graphite Pro הקיימים.

**Tech Stack:** Next.js (App Router), TypeScript, Supabase, Vitest, Graphite Pro design system (`app/components/dashboard/ui/`).

**Spec:** `docs/superpowers/specs/2026-09-01-provider-admin-dashboard-design.md`

---

## מיפוי קבצים

| קובץ | פעולה |
|---|---|
| `supabase/migrations/<ts>_profiles_role.sql` | חדש |
| `app/types/domain/profile.ts` | עדכון |
| `app/lib/repositories/mappers.ts` | עדכון (`mapProfileRow`) |
| `app/lib/services/auth.service.ts` | עדכון (`getProfile`) |
| `app/tests/unit/auth.service.test.ts` | עדכון/חדש |
| `app/lib/api/provider-admin.ts` | חדש |
| `app/tests/unit/provider-admin-guard.test.ts` | חדש |
| `app/types/domain/call-review.ts` | חדש |
| `app/lib/repositories/call-review.repository.ts` | חדש |
| `app/tests/unit/call-review.repository.test.ts` | חדש |
| `app/lib/repositories/prompt-suggestion.repository.ts` | עדכון (`findBySupportingCallReviewId`) |
| `app/tests/unit/prompt-suggestion.repository-race-guard.test.ts` | עדכון |
| `app/lib/services/call-review.service.ts` | חדש |
| `app/tests/unit/call-review.service.test.ts` | חדש |
| `app/lib/services/prompt-suggestion.service.ts` | רפקטור |
| `app/tests/unit/prompt-suggestion.service.test.ts` | שכתוב מלא |
| `app/lib/services/factory.ts` | עדכון (`callReview` service) |
| `app/app/api/prompt-suggestions/route.ts` | עדכון (guard) |
| `app/app/api/prompt-suggestions/[id]/approve/route.ts` | עדכון (guard) |
| `app/app/api/prompt-suggestions/[id]/reject/route.ts` | עדכון (guard) |
| `app/tests/unit/prompt-suggestions-routes.test.ts` | שכתוב מלא |
| `app/app/api/provider-admin/calls/route.ts` | חדש |
| `app/app/api/provider-admin/calls/[id]/route.ts` | חדש |
| `app/tests/unit/provider-admin-calls-routes.test.ts` | חדש |
| `app/proxy.ts` | עדכון |
| `app/components/provider-admin/sidebar.tsx` | חדש |
| `app/app/provider-admin/layout.tsx` | חדש |
| `app/app/provider-admin/page.tsx` | חדש (redirect) |
| `app/app/provider-admin/calls/page.tsx` | חדש |
| `app/app/provider-admin/calls/[id]/page.tsx` | חדש |
| `app/app/provider-admin/improvements/page.tsx` | חדש |

---

### Task 1: Migration — `profiles.role`

**Files:**
- Create: `supabase/migrations/20260901120000_profiles_role.sql`

- [ ] **Step 1: כתוב את המיגרציה**

```sql
-- Site-wide role (not clinic_memberships.role, which is per-clinic). Only
-- provider_admin unlocks /provider-admin/* — a separate, non-clinic-scoped
-- ops surface for QA review and prompt-suggestion approval.
alter table public.profiles add column role text not null default 'clinic_user'
  check (role in ('clinic_user', 'provider_admin'));

comment on column public.profiles.role is
  'Site-wide role. clinic_user (default) sees only /dashboard; provider_admin also sees /provider-admin, unscoped by clinic.';
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260901120000_profiles_role.sql
git commit -m "feat(db): add profiles.role for provider-admin gating"
```

**לא להחיל על הענן בשלב הזה** — קורה ב-Task 13, אחרי אישור מפורש.

---

### Task 2: `Profile` type + `AuthService.getProfile()`

**Files:**
- Modify: `app/types/domain/profile.ts`
- Modify: `app/lib/repositories/mappers.ts`
- Modify: `app/lib/services/auth.service.ts`
- Test: `app/tests/unit/auth-service-get-profile.test.ts` (חדש)

- [ ] **Step 1: כתוב טסט כושל**

```typescript
import { describe, expect, it, vi } from "vitest";
import { AuthService } from "@/lib/services/auth.service";
import { ok } from "@/lib/errors/app-error";

describe("AuthService.getProfile", () => {
  it("delegates to profileRepository.findByUserId", async () => {
    const profile = {
      id: "user-1",
      fullName: "Test User",
      phone: null,
      defaultClinicId: null,
      role: "provider_admin" as const,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      deletedAt: null,
    };
    const findByUserId = vi.fn().mockResolvedValue(ok(profile));
    const service = new AuthService(
      {} as never,
      { findByUserId } as never,
      {} as never,
    );

    const result = await service.getProfile("user-1");

    expect(result).toEqual(ok(profile));
    expect(findByUserId).toHaveBeenCalledWith("user-1");
  });
});
```

- [ ] **Step 2: הרץ, ודא כישלון**

```bash
cd /Users/idoamsalem/mvp-noa-1-0/.worktrees/provider-admin-dashboard/app
npx vitest run tests/unit/auth-service-get-profile.test.ts
```
Expected: FAIL — `service.getProfile is not a function`.

- [ ] **Step 3: עדכן את `app/types/domain/profile.ts`**

```typescript
export type Profile = {
  id: string;
  fullName: string | null;
  phone: string | null;
  defaultClinicId: string | null;
  role: "clinic_user" | "provider_admin";
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};
```

- [ ] **Step 4: עדכן את `mapProfileRow` ב-`app/lib/repositories/mappers.ts`**

Replace the function (currently at line 42):

```typescript
export function mapProfileRow(row: {
  id: string;
  full_name: string | null;
  phone: string | null;
  default_clinic_id: string | null;
  role: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}): Profile {
  return {
    id: row.id,
    fullName: row.full_name,
    phone: row.phone,
    defaultClinicId: row.default_clinic_id,
    role: row.role === "provider_admin" ? "provider_admin" : "clinic_user",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}
```

(שים לב: `row.role === "provider_admin" ? "provider_admin" : "clinic_user"` ולא `as Profile["role"]` — אותה הגנה שכבר קיימת ב-`mapPromptSuggestionRow` על `category`: ברירת מחדל בטוחה במקום cast עיוור, למקרה שהאפליקציה תיפרס לפני שהמיגרציה מוחלת.)

- [ ] **Step 5: הוסף `getProfile` ל-`AuthService` ב-`app/lib/services/auth.service.ts`**

Add this method to the class, e.g. right after `getSessionUser`:

```typescript
  async getProfile(userId: string): Promise<Result<Profile | null>> {
    return this.profileRepository.findByUserId(userId);
  }
```

Add the import at the top: `import type { Profile } from "@/types/domain/profile";`

- [ ] **Step 6: הרץ את הטסט וודא שהוא עובר**

```bash
npx vitest run tests/unit/auth-service-get-profile.test.ts
```
Expected: PASS.

- [ ] **Step 7: הרץ typecheck (הצורה של `Profile` השתנתה — יש מקומות אחרים שמבנים אובייקט `Profile` ידנית בטסטים, למשל)**

```bash
npx tsc --noEmit
```
Expected: כל שגיאה שתופיע היא fixture בטסט קיים שחסר לו `role` — הוסף `role: "clinic_user"` (ברירת מחדל) לכל fixture כזה שמתגלה.

- [ ] **Step 8: Commit**

```bash
git add app/types/domain/profile.ts app/lib/repositories/mappers.ts app/lib/services/auth.service.ts app/tests/unit/auth-service-get-profile.test.ts
git commit -m "feat: add profiles.role to Profile type, AuthService.getProfile()"
```

---

### Task 3: `requireProviderAdmin()` guard

**Files:**
- Create: `app/lib/api/provider-admin.ts`
- Test: `app/tests/unit/provider-admin-guard.test.ts`

- [ ] **Step 1: כתוב את הטסט**

```typescript
import { describe, expect, it, vi } from "vitest";
import { requireProviderAdmin } from "@/lib/api/provider-admin";
import { ok, err, AppError } from "@/lib/errors/app-error";
import type { Profile } from "@/types/domain/profile";
import type { User } from "@supabase/supabase-js";

const testUser = { id: "user-1", email: "admin@voxly--ai.com" } as User;

function adminProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: "user-1",
    fullName: null,
    phone: null,
    defaultClinicId: null,
    role: "provider_admin",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    deletedAt: null,
    ...overrides,
  };
}

function buildAuthService(overrides: { getSessionUser?: unknown; getProfile?: unknown } = {}) {
  return {
    getSessionUser: overrides.getSessionUser ?? vi.fn().mockResolvedValue(ok(testUser)),
    getProfile: overrides.getProfile ?? vi.fn().mockResolvedValue(ok(adminProfile())),
  } as never;
}

describe("requireProviderAdmin", () => {
  it("throws unauthorized when there is no session", async () => {
    const authService = buildAuthService({ getSessionUser: vi.fn().mockResolvedValue(ok(null)) });
    await expect(requireProviderAdmin(authService)).rejects.toMatchObject({ status: 401 });
  });

  it("propagates a getSessionUser error result as a thrown error", async () => {
    const authService = buildAuthService({ getSessionUser: vi.fn().mockResolvedValue(err(AppError.unauthorized())) });
    await expect(requireProviderAdmin(authService)).rejects.toMatchObject({ status: 401 });
  });

  it("throws forbidden when the profile role is clinic_user", async () => {
    const authService = buildAuthService({
      getProfile: vi.fn().mockResolvedValue(ok(adminProfile({ role: "clinic_user" }))),
    });
    await expect(requireProviderAdmin(authService)).rejects.toMatchObject({ status: 403 });
  });

  it("throws forbidden when there is no profile row at all", async () => {
    const authService = buildAuthService({ getProfile: vi.fn().mockResolvedValue(ok(null)) });
    await expect(requireProviderAdmin(authService)).rejects.toMatchObject({ status: 403 });
  });

  it("returns the user and profile when role is provider_admin", async () => {
    const authService = buildAuthService();
    const result = await requireProviderAdmin(authService);
    expect(result.user.id).toBe("user-1");
    expect(result.profile.role).toBe("provider_admin");
  });
});
```

- [ ] **Step 2: הרץ, ודא כישלון**

```bash
npx vitest run tests/unit/provider-admin-guard.test.ts
```
Expected: FAIL — הקובץ `app/lib/api/provider-admin.ts` לא קיים.

- [ ] **Step 3: כתוב את המימוש**

```typescript
import { AppError } from "@/lib/errors/app-error";
import type { AuthService } from "@/lib/services/auth.service";
import type { Profile } from "@/types/domain/profile";
import type { User } from "@supabase/supabase-js";

/**
 * Guards /provider-admin/* API routes and pages. Unlike requireAuth(), this
 * also checks profiles.role — a site-wide flag, not clinic_memberships, so
 * this deliberately does NOT use getActorAndServices() (which throws for
 * anyone with zero clinic memberships).
 */
export async function requireProviderAdmin(
  authService: AuthService,
): Promise<{ user: User; profile: Profile }> {
  const userResult = await authService.getSessionUser();
  if (!userResult.ok) throw userResult.error;
  if (!userResult.value) throw AppError.unauthorized();
  const user = userResult.value;

  const profileResult = await authService.getProfile(user.id);
  if (!profileResult.ok) throw profileResult.error;
  if (!profileResult.value || profileResult.value.role !== "provider_admin") {
    throw AppError.forbidden("Provider admin access required");
  }

  return { user, profile: profileResult.value };
}
```

- [ ] **Step 4: הרץ את הטסט וודא שהוא עובר**

```bash
npx vitest run tests/unit/provider-admin-guard.test.ts
```
Expected: 5/5 PASS.

- [ ] **Step 5: Commit**

```bash
git add app/lib/api/provider-admin.ts app/tests/unit/provider-admin-guard.test.ts
git commit -m "feat: add requireProviderAdmin() guard"
```

---

### Task 4: `CallReview` domain type + `CallReviewRepository`

**Files:**
- Create: `app/types/domain/call-review.ts`
- Create: `app/lib/repositories/call-review.repository.ts`
- Test: `app/tests/unit/call-review.repository.test.ts`

- [ ] **Step 1: כתוב את הטיפוס**

```typescript
export type CallReviewProblem = {
  moment?: string;
  problem: string;
  root_cause?: string;
  category?: string;
  priority?: string;
  target_file?: string;
  proposed_change?: string;
};

export type CallReviewExceptionSeverity = "none" | "low" | "medium" | "high" | "critical";

export type CallReview = {
  id: string;
  clinicId: string;
  conversationId: string;
  agentId: string;
  versionId: string | null;
  callSuccessful: string | null;
  transcriptSummary: string | null;
  evaluationCriteriaResults: Record<string, unknown>;
  dataCollectionResults: Record<string, unknown>;
  flagged: boolean;
  flaggedReasons: string[];
  transcript: unknown[];
  callDurationSecs: number | null;
  qaAnalyzedAt: string | null;
  overallScore: number | null;
  empathyScore: number | null;
  naturalnessScore: number | null;
  accuracyScore: number | null;
  protocolScore: number | null;
  safetyScore: number | null;
  resolutionScore: number | null;
  isException: boolean;
  exceptionSeverity: CallReviewExceptionSeverity | null;
  strengths: string[];
  problems: CallReviewProblem[];
  reviewerSummary: string | null;
  analyzerModel: string | null;
  createdAt: string;
};

export type CallReviewSeverityFilter = "all" | CallReviewExceptionSeverity;
```

- [ ] **Step 2: כתוב את הטסט (יכשל — עדיין אין implementation)**

```typescript
import { describe, expect, it, vi, beforeEach } from "vitest";
import { CallReviewRepository } from "@/lib/repositories/call-review.repository";

function buildListQuery(result: { data: unknown[] | null; error: unknown; count: number | null }) {
  const query = {
    select: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockResolvedValue(result),
  };
  return query;
}

const row = {
  id: "cr-1",
  clinic_id: "clinic-1",
  conversation_id: "conv_1",
  agent_id: "agent_1",
  version_id: null,
  call_successful: "success",
  transcript_summary: "summary",
  evaluation_criteria_results: {},
  data_collection_results: {},
  flagged: false,
  flagged_reasons: [],
  transcript: [],
  call_duration_secs: 90,
  qa_analyzed_at: "2026-08-31T17:30:56.000Z",
  overall_score: "6.00",
  empathy_score: "6.00",
  naturalness_score: "5.00",
  accuracy_score: "6.00",
  protocol_score: "5.00",
  safety_score: "9.00",
  resolution_score: "7.00",
  is_exception: true,
  exception_severity: "medium",
  strengths: [],
  problems: [{ problem: "x", category: "conversation_flow" }],
  reviewer_summary: "review",
  analyzer_model: "claude-sonnet-5",
  created_at: "2026-08-31T17:30:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CallReviewRepository.listRecent", () => {
  it("maps rows, applies the since/severity filters, and returns the total count", async () => {
    const query = buildListQuery({ data: [row], error: null, count: 1 });
    const client = { from: vi.fn().mockReturnValue(query) };
    const repo = new CallReviewRepository(client as never);

    const result = await repo.listRecent({ sinceDays: 30, severity: "medium", limit: 50, offset: 0 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.total).toBe(1);
    expect(result.value.items[0]).toMatchObject({ id: "cr-1", overallScore: 6, isException: true, exceptionSeverity: "medium" });
    expect(query.eq).toHaveBeenCalledWith("exception_severity", "medium");
    expect(query.order).toHaveBeenNthCalledWith(1, "is_exception", { ascending: false });
    expect(query.order).toHaveBeenNthCalledWith(2, "created_at", { ascending: false });
    expect(query.range).toHaveBeenCalledWith(0, 49);
  });

  it("skips the severity filter when severity is 'all'", async () => {
    const query = buildListQuery({ data: [], error: null, count: 0 });
    const client = { from: vi.fn().mockReturnValue(query) };
    const repo = new CallReviewRepository(client as never);

    await repo.listRecent({ sinceDays: 30, severity: "all", limit: 50, offset: 0 });

    expect(query.eq).not.toHaveBeenCalled();
  });

  it("returns an externalProvider error when the query fails", async () => {
    const query = buildListQuery({ data: null, error: { message: "db down" }, count: null });
    const client = { from: vi.fn().mockReturnValue(query) };
    const repo = new CallReviewRepository(client as never);

    const result = await repo.listRecent({ sinceDays: 30, severity: "all", limit: 50, offset: 0 });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.status).toBe(502);
  });
});

describe("CallReviewRepository.findById", () => {
  it("maps a found row", async () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: row, error: null }),
    };
    const client = { from: vi.fn().mockReturnValue(query) };
    const repo = new CallReviewRepository(client as never);

    const result = await repo.findById("cr-1");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value?.id).toBe("cr-1");
    expect(query.eq).toHaveBeenCalledWith("id", "cr-1");
  });

  it("returns null when no row matches", async () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    const client = { from: vi.fn().mockReturnValue(query) };
    const repo = new CallReviewRepository(client as never);

    const result = await repo.findById("missing");

    expect(result).toEqual({ ok: true, value: null });
  });
});
```

- [ ] **Step 3: הרץ, ודא כישלון**

```bash
npx vitest run tests/unit/call-review.repository.test.ts
```
Expected: FAIL — `Cannot find module '@/lib/repositories/call-review.repository'`.

- [ ] **Step 4: כתוב את המימוש**

```typescript
import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError, err, ok, type Result } from "@/lib/errors/app-error";
import type { CallReview, CallReviewSeverityFilter } from "@/types/domain/call-review";

function num(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value);
}

function mapCallReviewRow(row: Record<string, unknown>): CallReview {
  return {
    id: row.id as string,
    clinicId: row.clinic_id as string,
    conversationId: row.conversation_id as string,
    agentId: row.agent_id as string,
    versionId: (row.version_id as string | null) ?? null,
    callSuccessful: (row.call_successful as string | null) ?? null,
    transcriptSummary: (row.transcript_summary as string | null) ?? null,
    evaluationCriteriaResults: (row.evaluation_criteria_results as Record<string, unknown>) ?? {},
    dataCollectionResults: (row.data_collection_results as Record<string, unknown>) ?? {},
    flagged: Boolean(row.flagged),
    flaggedReasons: (row.flagged_reasons as string[] | null) ?? [],
    transcript: (row.transcript as unknown[] | null) ?? [],
    callDurationSecs: num(row.call_duration_secs),
    qaAnalyzedAt: (row.qa_analyzed_at as string | null) ?? null,
    overallScore: num(row.overall_score),
    empathyScore: num(row.empathy_score),
    naturalnessScore: num(row.naturalness_score),
    accuracyScore: num(row.accuracy_score),
    protocolScore: num(row.protocol_score),
    safetyScore: num(row.safety_score),
    resolutionScore: num(row.resolution_score),
    isException: Boolean(row.is_exception),
    exceptionSeverity: (row.exception_severity as CallReview["exceptionSeverity"]) ?? null,
    strengths: (row.strengths as string[] | null) ?? [],
    problems: (row.problems as CallReview["problems"] | null) ?? [],
    reviewerSummary: (row.reviewer_summary as string | null) ?? null,
    analyzerModel: (row.analyzer_model as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

/**
 * Backed by the service-role client — call_reviews is deny-by-default under
 * RLS. Unlike every clinic-scoped repository in this app, listRecent()
 * deliberately does NOT filter by clinic_id: provider_admin is a site-wide
 * role, not a clinic membership.
 */
export class CallReviewRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listRecent(params: {
    sinceDays: number;
    severity: CallReviewSeverityFilter;
    limit: number;
    offset: number;
  }): Promise<Result<{ items: CallReview[]; total: number }>> {
    const since = new Date(Date.now() - params.sinceDays * 24 * 60 * 60 * 1000).toISOString();

    let query = this.client
      .from("call_reviews")
      .select("*", { count: "exact" })
      .gte("created_at", since)
      .order("is_exception", { ascending: false })
      .order("created_at", { ascending: false });

    if (params.severity !== "all") {
      query = query.eq("exception_severity", params.severity);
    }

    const { data, error, count } = await query.range(params.offset, params.offset + params.limit - 1);
    if (error) return err(AppError.externalProvider("Failed to list call reviews", error));
    return ok({ items: (data ?? []).map(mapCallReviewRow), total: count ?? 0 });
  }

  async findById(id: string): Promise<Result<CallReview | null>> {
    const { data, error } = await this.client.from("call_reviews").select("*").eq("id", id).maybeSingle();
    if (error) return err(AppError.externalProvider("Failed to load call review", error));
    return ok(data ? mapCallReviewRow(data as Record<string, unknown>) : null);
  }
}
```

- [ ] **Step 5: הרץ את הטסטים וודא שהם עוברים**

```bash
npx vitest run tests/unit/call-review.repository.test.ts
```
Expected: 5/5 PASS.

- [ ] **Step 6: Commit**

```bash
git add app/types/domain/call-review.ts app/lib/repositories/call-review.repository.ts app/tests/unit/call-review.repository.test.ts
git commit -m "feat: add CallReview domain type and repository"
```

---

### Task 5: `PromptSuggestionRepository.findBySupportingCallReviewId` + `CallReviewService`

**Files:**
- Modify: `app/lib/repositories/prompt-suggestion.repository.ts`
- Modify: `app/tests/unit/prompt-suggestion.repository-race-guard.test.ts`
- Create: `app/lib/services/call-review.service.ts`
- Test: `app/tests/unit/call-review.service.test.ts`

- [ ] **Step 1: הוסף טסט ל-`findBySupportingCallReviewId`**

Add to `app/tests/unit/prompt-suggestion.repository-race-guard.test.ts`, at the end of the `describe` block:

```typescript
  it("findBySupportingCallReviewId queries with .contains and returns the most recent match", async () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      contains: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: suggestionRow, error: null }),
    };
    const client = { from: vi.fn().mockReturnValue(query) };
    const repo = new PromptSuggestionRepository(client as never);

    const result = await repo.findBySupportingCallReviewId("cr-1");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value?.id).toBe("sugg-1");
    expect(query.contains).toHaveBeenCalledWith("supporting_call_review_ids", ["cr-1"]);
    expect(query.order).toHaveBeenCalledWith("created_at", { ascending: false });
  });

  it("findBySupportingCallReviewId returns null when nothing matches", async () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      contains: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    const client = { from: vi.fn().mockReturnValue(query) };
    const repo = new PromptSuggestionRepository(client as never);

    const result = await repo.findBySupportingCallReviewId("cr-none");

    expect(result).toEqual({ ok: true, value: null });
  });
```

- [ ] **Step 2: הרץ, ודא כישלון**

```bash
npx vitest run tests/unit/prompt-suggestion.repository-race-guard.test.ts
```
Expected: FAIL — `repo.findBySupportingCallReviewId is not a function`.

- [ ] **Step 3: הוסף את המתודה ל-`PromptSuggestionRepository`**

Add to the class in `app/lib/repositories/prompt-suggestion.repository.ts`, after `findById`:

```typescript
  /** Most recent suggestion whose supporting_call_review_ids includes this call review, if any. */
  async findBySupportingCallReviewId(callReviewId: string): Promise<Result<PromptSuggestion | null>> {
    const { data, error } = await this.client
      .from("tomer_prompt_suggestions")
      .select("*")
      .contains("supporting_call_review_ids", [callReviewId])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return err(AppError.externalProvider("Failed to look up linked prompt suggestion", error));
    return ok(data ? mapPromptSuggestionRow(data as Record<string, unknown>) : null);
  }
```

- [ ] **Step 4: הרץ את הטסטים וודא שהם עוברים**

```bash
npx vitest run tests/unit/prompt-suggestion.repository-race-guard.test.ts
```
Expected: כל הטסטים עוברים (הישנים + 2 חדשים).

- [ ] **Step 5: כתוב טסט ל-`CallReviewService`**

```typescript
import { describe, expect, it, vi } from "vitest";
import { ok } from "@/lib/errors/app-error";
import { CallReviewService } from "@/lib/services/call-review.service";

const review = { id: "cr-1", clinicId: "c1" } as never;
const suggestion = { id: "sugg-1", supportingCallReviewIds: ["cr-1"] } as never;

describe("CallReviewService", () => {
  it("list() delegates to the repository with a 30-day window and 50-item pages", async () => {
    const listRecent = vi.fn().mockResolvedValue(ok({ items: [review], total: 1 }));
    const service = new CallReviewService(
      { listRecent } as never,
      { findBySupportingCallReviewId: vi.fn() } as never,
    );

    await service.list({ severity: "medium", page: 2 });

    expect(listRecent).toHaveBeenCalledWith({ sinceDays: 30, severity: "medium", limit: 50, offset: 50 });
  });

  it("getWithLinkedSuggestion() returns null when the review does not exist", async () => {
    const service = new CallReviewService(
      { findById: vi.fn().mockResolvedValue(ok(null)) } as never,
      { findBySupportingCallReviewId: vi.fn() } as never,
    );

    const result = await service.getWithLinkedSuggestion("missing");

    expect(result).toEqual(ok(null));
  });

  it("getWithLinkedSuggestion() attaches the linked suggestion when found", async () => {
    const service = new CallReviewService(
      { findById: vi.fn().mockResolvedValue(ok(review)) } as never,
      { findBySupportingCallReviewId: vi.fn().mockResolvedValue(ok(suggestion)) } as never,
    );

    const result = await service.getWithLinkedSuggestion("cr-1");

    expect(result).toEqual(ok({ review, linkedSuggestion: suggestion }));
  });
});
```

- [ ] **Step 6: הרץ, ודא כישלון**

```bash
npx vitest run tests/unit/call-review.service.test.ts
```
Expected: FAIL — `Cannot find module '@/lib/services/call-review.service'`.

- [ ] **Step 7: כתוב את המימוש**

```typescript
import { ok, type Result } from "@/lib/errors/app-error";
import type { CallReviewRepository } from "@/lib/repositories/call-review.repository";
import type { PromptSuggestionRepository } from "@/lib/repositories/prompt-suggestion.repository";
import type { CallReview, CallReviewSeverityFilter } from "@/types/domain/call-review";
import type { PromptSuggestion } from "@/types/domain/prompt-suggestion";

const PAGE_SIZE = 50;
const LOOKBACK_DAYS = 30;

/**
 * No actor-based filtering here — requireProviderAdmin() already gates
 * every route this service is reachable from, and call_reviews is not
 * clinic-scoped for provider_admin.
 */
export class CallReviewService {
  constructor(
    private readonly repo: CallReviewRepository,
    private readonly promptSuggestionRepo: PromptSuggestionRepository,
  ) {}

  async list(params: { severity: CallReviewSeverityFilter; page: number }): Promise<Result<{ items: CallReview[]; total: number }>> {
    return this.repo.listRecent({
      sinceDays: LOOKBACK_DAYS,
      severity: params.severity,
      limit: PAGE_SIZE,
      offset: (params.page - 1) * PAGE_SIZE,
    });
  }

  async getWithLinkedSuggestion(
    id: string,
  ): Promise<Result<{ review: CallReview; linkedSuggestion: PromptSuggestion | null } | null>> {
    const reviewResult = await this.repo.findById(id);
    if (!reviewResult.ok) return reviewResult;
    if (!reviewResult.value) return ok(null);

    const suggestionResult = await this.promptSuggestionRepo.findBySupportingCallReviewId(id);
    if (!suggestionResult.ok) return suggestionResult;

    return ok({ review: reviewResult.value, linkedSuggestion: suggestionResult.value });
  }
}
```

- [ ] **Step 8: הרץ את הטסטים וודא שהם עוברים**

```bash
npx vitest run tests/unit/call-review.service.test.ts
```
Expected: 3/3 PASS.

- [ ] **Step 9: Commit**

```bash
git add app/lib/repositories/prompt-suggestion.repository.ts app/tests/unit/prompt-suggestion.repository-race-guard.test.ts app/lib/services/call-review.service.ts app/tests/unit/call-review.service.test.ts
git commit -m "feat: add findBySupportingCallReviewId and CallReviewService"
```

---

### Task 6: רפקטור `PromptSuggestionService` — הסרת גייטינג clinic-role

**Files:**
- Modify: `app/lib/services/prompt-suggestion.service.ts`
- Modify: `app/tests/unit/prompt-suggestion.service.test.ts` (שכתוב מלא)

Gating עובר כולו ל-`requireProviderAdmin()` ברמת ה-route (Task 7). ה-service כבר לא צריך `ServiceActor`, `hasPrivilegedClinicRole`, או בדיקות role — רק `userId` (string) לצורך `reviewed_by_user_id`.

- [ ] **Step 1: שכתב את `app/tests/unit/prompt-suggestion.service.test.ts` במלואו**

```typescript
import { describe, expect, it, vi, beforeEach } from "vitest";
import { ok } from "@/lib/errors/app-error";
import { PromptSuggestionService } from "@/lib/services/prompt-suggestion.service";
import type { PromptSuggestionRepository } from "@/lib/repositories/prompt-suggestion.repository";
import type { PromptSuggestion } from "@/types/domain/prompt-suggestion";

const { mockRunRegressionTests, mockGetLiveAgentConfig, mockPublishPrompt } = vi.hoisted(() => ({
  mockRunRegressionTests: vi.fn(),
  mockGetLiveAgentConfig: vi.fn(),
  mockPublishPrompt: vi.fn(),
}));

vi.mock("@/lib/learning/elevenlabsTesting", () => ({
  runRegressionTests: mockRunRegressionTests,
  getLiveAgentConfig: mockGetLiveAgentConfig,
  publishPrompt: mockPublishPrompt,
}));

const REVIEWER_ID = "user-2";

function suggestion(overrides: Partial<PromptSuggestion> = {}): PromptSuggestion {
  return {
    id: "sugg-1",
    clinicId: "clinic-target",
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

function buildService(overrides: Partial<ReturnType<typeof baseRepo>> = {}) {
  const repo = { ...baseRepo(), ...overrides };
  const service = new PromptSuggestionService(repo as unknown as PromptSuggestionRepository);
  return { service, repo };
}

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

beforeEach(() => {
  mockRunRegressionTests.mockReset();
  mockGetLiveAgentConfig.mockReset();
  mockPublishPrompt.mockReset();
});

describe("PromptSuggestionService.reject", () => {
  it("rejects a pending suggestion", async () => {
    const { service, repo } = buildService();
    const result = await service.reject(REVIEWER_ID, "sugg-1");
    expect(result.ok).toBe(true);
    expect(repo.markRejected).toHaveBeenCalledWith("sugg-1", REVIEWER_ID);
  });

  it("returns notFound when the suggestion does not exist", async () => {
    const { service } = buildService({ findById: vi.fn().mockResolvedValue(ok(null)) });
    const result = await service.reject(REVIEWER_ID, "missing");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.status).toBe(404);
  });
});

describe("PromptSuggestionService.approve", () => {
  it("marks non-prompt categories approved without running regression or publish", async () => {
    const { service, repo } = buildService({
      findById: vi.fn().mockResolvedValue(ok(suggestion({ category: "knowledge_base", suggestedPrompt: null }))),
    });

    const result = await service.approve(REVIEWER_ID, "sugg-1");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("approved");
    expect(repo.markApproved).toHaveBeenCalledWith("sugg-1", REVIEWER_ID);
    expect(mockRunRegressionTests).not.toHaveBeenCalled();
    expect(mockPublishPrompt).not.toHaveBeenCalled();
  });

  it.each(["tool", "backend_logic", "conversation_flow"] as const)(
    "marks category '%s' approved without publish, same as knowledge_base",
    async (category) => {
      const { service, repo } = buildService({
        findById: vi.fn().mockResolvedValue(ok(suggestion({ category, suggestedPrompt: null }))),
      });

      const result = await service.approve(REVIEWER_ID, "sugg-1");

      expect(result.ok).toBe(true);
      expect(repo.markApproved).toHaveBeenCalledOnce();
      expect(mockRunRegressionTests).not.toHaveBeenCalled();
    },
  );

  it("returns an internal error if a 'prompt' category suggestion is somehow missing suggested_prompt", async () => {
    const { service, repo } = buildService({
      findById: vi.fn().mockResolvedValue(ok(suggestion({ category: "prompt", suggestedPrompt: null }))),
    });

    const result = await service.approve(REVIEWER_ID, "sugg-1");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.status).toBe(500);
    expect(repo.markApproved).not.toHaveBeenCalled();
    expect(mockRunRegressionTests).not.toHaveBeenCalled();
  });

  it("refuses to re-approve a suggestion that was already reviewed", async () => {
    const { service } = buildService({
      findById: vi.fn().mockResolvedValue(ok(suggestion({ status: "published" }))),
    });
    const result = await service.approve(REVIEWER_ID, "sugg-1");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.status).toBe(409);
    expect(mockRunRegressionTests).not.toHaveBeenCalled();
  });

  it("publishes when every regression test passes", async () => {
    mockRunRegressionTests.mockResolvedValue({ allPassed: true, raw: { test_results: [] } });
    mockGetLiveAgentConfig.mockResolvedValue({ agent: { prompt: { prompt: "old prompt" } } });
    mockPublishPrompt.mockResolvedValue({ agent_id: "agent_1" });

    const { service, repo } = buildService();
    const result = await service.approve(REVIEWER_ID, "sugg-1");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("published");
    expect(mockGetLiveAgentConfig).toHaveBeenCalled();
    expect(mockPublishPrompt).toHaveBeenCalledWith(suggestion().suggestedPrompt);
    expect(repo.markPublished).toHaveBeenCalledOnce();
    expect(repo.recordRegressionResult).not.toHaveBeenCalled();
  });

  it("does not publish and marks failed_regression when a test fails", async () => {
    mockRunRegressionTests.mockResolvedValue({ allPassed: false, raw: { test_results: [{ result: "failure" }] } });

    const { service, repo } = buildService();
    const result = await service.approve(REVIEWER_ID, "sugg-1");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("failed_regression");
    expect(mockPublishPrompt).not.toHaveBeenCalled();
    expect(repo.recordRegressionResult).toHaveBeenCalledWith(
      "sugg-1",
      expect.objectContaining({ status: "failed_regression" }),
    );
  });

  it("does not publish when the run-tests response can't be confidently parsed", async () => {
    mockRunRegressionTests.mockResolvedValue({ allPassed: null, raw: { unexpected: "shape" } });

    const { service, repo } = buildService();
    const result = await service.approve(REVIEWER_ID, "sugg-1");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("pending");
    expect(mockPublishPrompt).not.toHaveBeenCalled();
    expect(repo.recordRegressionResult).toHaveBeenCalledWith(
      "sugg-1",
      expect.objectContaining({ status: "pending" }),
    );
  });

  it("does not publish when publish itself throws, even after regression passed", async () => {
    mockRunRegressionTests.mockResolvedValue({ allPassed: true, raw: {} });
    mockGetLiveAgentConfig.mockResolvedValue({});
    mockPublishPrompt.mockRejectedValue(new Error("ElevenLabs 500"));

    const { service, repo } = buildService();
    const result = await service.approve(REVIEWER_ID, "sugg-1");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.status).toBe(502);
    expect(repo.markPublished).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: הרץ, ודא כישלון**

```bash
npx vitest run tests/unit/prompt-suggestion.service.test.ts
```
Expected: FAIL — החתימות הישנות דורשות `ServiceActor`, לא `string`.

- [ ] **Step 3: שכתב את `app/lib/services/prompt-suggestion.service.ts`**

```typescript
import { AppError, err, type Result } from "@/lib/errors/app-error";
import { getLiveAgentConfig, publishPrompt, runRegressionTests } from "@/lib/learning/elevenlabsTesting";
import type { PromptSuggestionRepository } from "@/lib/repositories/prompt-suggestion.repository";
import type { PromptSuggestion } from "@/types/domain/prompt-suggestion";

/**
 * Permission is enforced once, upstream, by requireProviderAdmin() at the
 * API route boundary — this service does no actor/role checking of its own.
 */
export class PromptSuggestionService {
  constructor(private readonly repo: PromptSuggestionRepository) {}

  async listPending(): Promise<Result<PromptSuggestion[]>> {
    return this.repo.listByStatus("pending");
  }

  async reject(reviewedByUserId: string, id: string): Promise<Result<PromptSuggestion>> {
    const existing = await this.repo.findById(id);
    if (!existing.ok) return existing;
    if (!existing.value) return err(AppError.notFound("Prompt suggestion not found"));
    if (existing.value.status !== "pending") {
      return err(AppError.conflict(`Prompt suggestion already ${existing.value.status}`));
    }

    return this.repo.markRejected(id, reviewedByUserId);
  }

  /**
   * Regression-tests the candidate prompt before publishing. Only publishes
   * when every test passed AND the response could be confidently parsed —
   * an ambiguous response leaves the suggestion pending with the raw result
   * attached, never publishing on an unverified guess. Only category='prompt'
   * suggestions carry a suggested_prompt at all — everything else is marked
   * approved directly, for manual follow-through outside this pipeline.
   */
  async approve(reviewedByUserId: string, id: string): Promise<Result<PromptSuggestion>> {
    const existing = await this.repo.findById(id);
    if (!existing.ok) return existing;
    if (!existing.value) return err(AppError.notFound("Prompt suggestion not found"));
    const suggestion = existing.value;

    if (suggestion.status !== "pending") {
      return err(AppError.conflict(`Prompt suggestion already ${suggestion.status}`));
    }

    if (suggestion.category !== "prompt") {
      return this.repo.markApproved(id, reviewedByUserId);
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
      return this.repo.recordRegressionResult(id, {
        status: regression.allPassed === false ? "failed_regression" : "pending",
        regressionResult: regression.raw,
        reviewedByUserId,
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
      reviewedByUserId,
    });
  }
}
```

- [ ] **Step 4: עדכן את `listByStatus` ב-`PromptSuggestionRepository`** — מסיר את פרמטר ה-`clinicIds`

In `app/lib/repositories/prompt-suggestion.repository.ts`, replace:

```typescript
  async listByStatus(clinicIds: string[], status: PromptSuggestionStatus): Promise<Result<PromptSuggestion[]>> {
    const { data, error } = await this.client
      .from("tomer_prompt_suggestions")
      .select("*")
      .in("clinic_id", clinicIds)
      .eq("status", status)
      .order("created_at", { ascending: false });
```

with:

```typescript
  async listByStatus(status: PromptSuggestionStatus): Promise<Result<PromptSuggestion[]>> {
    const { data, error } = await this.client
      .from("tomer_prompt_suggestions")
      .select("*")
      .eq("status", status)
      .order("created_at", { ascending: false });
```

- [ ] **Step 5: הרץ את הטסטים וודא שהם עוברים**

```bash
npx vitest run tests/unit/prompt-suggestion.service.test.ts
```
Expected: כל הטסטים עוברים.

- [ ] **Step 6: הרץ typecheck (זה ישבור את הroutes הקיימים — מכוון, Task 7 מתקן)**

```bash
npx tsc --noEmit
```
Expected: שגיאות ב-`app/app/api/prompt-suggestions/*` (עדיין קוראים עם `actor`) — צפוי, מתוקן ב-Task הבא. אל תמשיך ל-commit הזה עם שגיאות typecheck פתוחות — Task 7 חייב לרוץ מיד אחרי, לפני commit נפרד. **שלב את Task 6 ו-Task 7 כ-commit אחד אם קל יותר**, או ודא commit רק אחרי ש-Task 7 מסיים.

- [ ] **Step 7: Commit (רק אחרי השלמת Task 7 — ראה שם)**

---

### Task 7: גייטינג מחדש ל-`/api/prompt-suggestions/*` + נתיבי `/api/provider-admin/calls/*`

**Files:**
- Modify: `app/app/api/prompt-suggestions/route.ts`
- Modify: `app/app/api/prompt-suggestions/[id]/approve/route.ts`
- Modify: `app/app/api/prompt-suggestions/[id]/reject/route.ts`
- Modify: `app/tests/unit/prompt-suggestions-routes.test.ts` (שכתוב מלא)
- Create: `app/app/api/provider-admin/calls/route.ts`
- Create: `app/app/api/provider-admin/calls/[id]/route.ts`
- Test: `app/tests/unit/provider-admin-calls-routes.test.ts`
- Modify: `app/lib/services/factory.ts`

- [ ] **Step 1: הוסף `callReview` ל-`createServices()` ב-`app/lib/services/factory.ts`**

Add the import:
```typescript
import { CallReviewRepository } from "@/lib/repositories/call-review.repository";
import { CallReviewService } from "@/lib/services/call-review.service";
```

Add the repository instantiation (near `promptSuggestionRepository`, uses `admin` client — `call_reviews` is deny-by-default under RLS):
```typescript
  const callReviewRepository = new CallReviewRepository(admin);
```

Add to the returned object:
```typescript
    callReview: new CallReviewService(callReviewRepository, promptSuggestionRepository),
```

- [ ] **Step 2: שכתב `app/tests/unit/prompt-suggestions-routes.test.ts` במלואו**

```typescript
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError, ok } from "@/lib/errors/app-error";
import { GET } from "@/app/api/prompt-suggestions/route";
import { POST as rejectRoute } from "@/app/api/prompt-suggestions/[id]/reject/route";
import { POST as approveRoute } from "@/app/api/prompt-suggestions/[id]/approve/route";

const { mockRequireProviderAdmin, mockCreateServices } = vi.hoisted(() => ({
  mockRequireProviderAdmin: vi.fn(),
  mockCreateServices: vi.fn(),
}));

vi.mock("@/lib/api/provider-admin", () => ({
  requireProviderAdmin: mockRequireProviderAdmin,
}));

vi.mock("@/lib/services/factory", () => ({
  createServices: mockCreateServices,
}));

const adminUser = { id: "admin-1" };

function mockServices(promptSuggestion: Record<string, unknown>) {
  mockCreateServices.mockResolvedValue({ auth: {}, promptSuggestion });
}

describe("prompt-suggestions API routes", () => {
  beforeEach(() => {
    mockRequireProviderAdmin.mockReset();
    mockCreateServices.mockReset();
    // Default stub so `services.auth` never resolves to `undefined` — routes
    // read `services.auth` before requireProviderAdmin() even runs, so an
    // unauthenticated/forbidden test that never calls mockServices() would
    // otherwise crash on `undefined.auth` with a raw TypeError, which
    // handleRouteError maps to 500 instead of the 401/403 the test expects.
    mockCreateServices.mockResolvedValue({ auth: {} });
  });

  it("GET /prompt-suggestions returns 401 when unauthenticated", async () => {
    mockRequireProviderAdmin.mockRejectedValue(AppError.unauthorized());

    const response = await GET();

    expect(response.status).toBe(401);
  });

  it("GET /prompt-suggestions returns 403 for a non-provider-admin", async () => {
    mockRequireProviderAdmin.mockRejectedValue(AppError.forbidden());

    const response = await GET();

    expect(response.status).toBe(403);
  });

  it("GET /prompt-suggestions lists pending suggestions with no actor argument", async () => {
    mockRequireProviderAdmin.mockResolvedValue({ user: adminUser });
    const listPending = vi.fn().mockResolvedValue(ok([{ id: "sugg-1", status: "pending" }]));
    mockServices({ listPending });

    const response = await GET();

    expect(response.status).toBe(200);
    expect(listPending).toHaveBeenCalledWith();
  });

  it("POST reject returns 401 when unauthenticated", async () => {
    mockRequireProviderAdmin.mockRejectedValue(AppError.unauthorized());

    const response = await rejectRoute(
      new Request("http://localhost/api/prompt-suggestions/sugg-1/reject", { method: "POST" }),
      { params: Promise.resolve({ id: "sugg-1" }) },
    );

    expect(response.status).toBe(401);
  });

  it("POST reject delegates to the service with the user id and suggestion id", async () => {
    mockRequireProviderAdmin.mockResolvedValue({ user: adminUser });
    const reject = vi.fn().mockResolvedValue(ok({ id: "sugg-1", status: "rejected" }));
    mockServices({ reject });

    const response = await rejectRoute(
      new Request("http://localhost/api/prompt-suggestions/sugg-1/reject", { method: "POST" }),
      { params: Promise.resolve({ id: "sugg-1" }) },
    );

    expect(response.status).toBe(200);
    expect(reject).toHaveBeenCalledWith(adminUser.id, "sugg-1");
  });

  it("POST approve returns 401 when unauthenticated", async () => {
    mockRequireProviderAdmin.mockRejectedValue(AppError.unauthorized());

    const response = await approveRoute(
      new Request("http://localhost/api/prompt-suggestions/sugg-1/approve", { method: "POST" }),
      { params: Promise.resolve({ id: "sugg-1" }) },
    );

    expect(response.status).toBe(401);
  });

  it("POST approve reports published:false when regression could not be confirmed", async () => {
    mockRequireProviderAdmin.mockResolvedValue({ user: adminUser });
    const approve = vi.fn().mockResolvedValue(ok({ id: "sugg-1", status: "pending" }));
    mockServices({ approve });

    const response = await approveRoute(
      new Request("http://localhost/api/prompt-suggestions/sugg-1/approve", { method: "POST" }),
      { params: Promise.resolve({ id: "sugg-1" }) },
    );
    const body = (await response.json()) as { data: { published: boolean } };

    expect(response.status).toBe(200);
    expect(body.data.published).toBe(false);
    expect(approve).toHaveBeenCalledWith(adminUser.id, "sugg-1");
  });

  it("POST approve reports published:true on a successful publish", async () => {
    mockRequireProviderAdmin.mockResolvedValue({ user: adminUser });
    const approve = vi.fn().mockResolvedValue(ok({ id: "sugg-1", status: "published" }));
    mockServices({ approve });

    const response = await approveRoute(
      new Request("http://localhost/api/prompt-suggestions/sugg-1/approve", { method: "POST" }),
      { params: Promise.resolve({ id: "sugg-1" }) },
    );
    const body = (await response.json()) as { data: { published: boolean } };

    expect(response.status).toBe(200);
    expect(body.data.published).toBe(true);
  });

  it("POST approve reports a non-empty message for the 'approved' status (non-prompt category, no regression run)", async () => {
    mockRequireProviderAdmin.mockResolvedValue({ user: adminUser });
    const approve = vi.fn().mockResolvedValue(ok({ id: "sugg-1", status: "approved" }));
    mockServices({ approve });

    const response = await approveRoute(
      new Request("http://localhost/api/prompt-suggestions/sugg-1/approve", { method: "POST" }),
      { params: Promise.resolve({ id: "sugg-1" }) },
    );
    const body = (await response.json()) as { data: { published: boolean; message: string } };

    expect(response.status).toBe(200);
    expect(body.data.published).toBe(false);
    expect(body.data.message).not.toBe("");
  });
});
```

- [ ] **Step 3: הרץ, ודא כישלון**

```bash
npx vitest run tests/unit/prompt-suggestions-routes.test.ts
```
Expected: FAIL — הroutes עדיין קוראים ל-`getActorAndServices`, לא ל-`requireProviderAdmin`.

- [ ] **Step 4: עדכן את `app/app/api/prompt-suggestions/route.ts`**

```typescript
import { createServices } from "@/lib/services/factory";
import { requireProviderAdmin } from "@/lib/api/provider-admin";
import { createRequestId } from "@/lib/api/request-id";
import { handleRouteError, jsonSuccess } from "@/lib/api/response";

export async function GET() {
  const requestId = createRequestId();

  try {
    const services = await createServices();
    await requireProviderAdmin(services.auth);
    const result = await services.promptSuggestion.listPending();
    if (!result.ok) return handleRouteError(result.error, requestId);
    return jsonSuccess({ items: result.value }, 200, requestId);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
```

- [ ] **Step 5: עדכן את `app/app/api/prompt-suggestions/[id]/approve/route.ts`**

Replace the imports and the body of `POST` (keep `messageFor` unchanged):

```typescript
import { createServices } from "@/lib/services/factory";
import { requireProviderAdmin } from "@/lib/api/provider-admin";
import { createRequestId } from "@/lib/api/request-id";
import { handleRouteError, jsonSuccess } from "@/lib/api/response";
import type { PromptSuggestion } from "@/types/domain/prompt-suggestion";

function messageFor(suggestion: PromptSuggestion): string {
  switch (suggestion.status) {
    case "published":
      return "Regression tests passed — the new prompt was published to the live agent.";
    case "approved":
      return "Marked approved for manual follow-through — this fix isn't a prompt rewrite, so no regression test or publish was run.";
    case "failed_regression":
      return "One or more regression tests failed. The prompt was not published; see regressionResult.";
    case "pending":
      return "Could not confidently determine pass/fail from the ElevenLabs response. The prompt was not published; see regressionResult for the raw response.";
    default:
      return "";
  }
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = createRequestId();

  try {
    const services = await createServices();
    const { user } = await requireProviderAdmin(services.auth);
    const { id } = await params;
    const result = await services.promptSuggestion.approve(user.id, id);
    if (!result.ok) return handleRouteError(result.error, requestId);

    return jsonSuccess(
      {
        suggestion: result.value,
        published: result.value.status === "published",
        message: messageFor(result.value),
      },
      200,
      requestId,
    );
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
```

- [ ] **Step 6: עדכן את `app/app/api/prompt-suggestions/[id]/reject/route.ts`**

```typescript
import { createServices } from "@/lib/services/factory";
import { requireProviderAdmin } from "@/lib/api/provider-admin";
import { createRequestId } from "@/lib/api/request-id";
import { handleRouteError, jsonSuccess } from "@/lib/api/response";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = createRequestId();

  try {
    const services = await createServices();
    const { user } = await requireProviderAdmin(services.auth);
    const { id } = await params;
    const result = await services.promptSuggestion.reject(user.id, id);
    if (!result.ok) return handleRouteError(result.error, requestId);
    return jsonSuccess(result.value, 200, requestId);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
```

- [ ] **Step 7: הרץ את הטסטים וודא שהם עוברים**

```bash
npx vitest run tests/unit/prompt-suggestions-routes.test.ts
```
Expected: 9/9 PASS.

- [ ] **Step 8: כתוב טסט ל-`/api/provider-admin/calls` (חדש)**

```typescript
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError, ok } from "@/lib/errors/app-error";
import { GET as listRoute } from "@/app/api/provider-admin/calls/route";
import { GET as detailRoute } from "@/app/api/provider-admin/calls/[id]/route";

const { mockRequireProviderAdmin, mockCreateServices } = vi.hoisted(() => ({
  mockRequireProviderAdmin: vi.fn(),
  mockCreateServices: vi.fn(),
}));

vi.mock("@/lib/api/provider-admin", () => ({
  requireProviderAdmin: mockRequireProviderAdmin,
}));

vi.mock("@/lib/services/factory", () => ({
  createServices: mockCreateServices,
}));

const adminUser = { id: "admin-1" };

function mockCallReviewService(callReview: Record<string, unknown>) {
  mockCreateServices.mockResolvedValue({ auth: {}, callReview });
}

describe("GET /api/provider-admin/calls", () => {
  beforeEach(() => {
    mockRequireProviderAdmin.mockReset();
    mockCreateServices.mockReset();
    // See the equivalent comment in prompt-suggestions-routes.test.ts: without
    // this default, an unauthenticated/forbidden test that never calls
    // mockCallReviewService() crashes on `undefined.auth` (500) instead of
    // reaching requireProviderAdmin()'s 401/403.
    mockCreateServices.mockResolvedValue({ auth: {} });
  });

  it("returns 401 when unauthenticated", async () => {
    mockRequireProviderAdmin.mockRejectedValue(AppError.unauthorized());
    const response = await listRoute(new Request("http://localhost/api/provider-admin/calls"));
    expect(response.status).toBe(401);
  });

  it("returns 403 for a non-provider-admin", async () => {
    mockRequireProviderAdmin.mockRejectedValue(AppError.forbidden());
    const response = await listRoute(new Request("http://localhost/api/provider-admin/calls"));
    expect(response.status).toBe(403);
  });

  it("parses severity and page query params and delegates to the service", async () => {
    mockRequireProviderAdmin.mockResolvedValue({ user: adminUser });
    const list = vi.fn().mockResolvedValue(ok({ items: [], total: 0 }));
    mockCallReviewService({ list });

    const response = await listRoute(
      new Request("http://localhost/api/provider-admin/calls?severity=medium&page=2"),
    );

    expect(response.status).toBe(200);
    expect(list).toHaveBeenCalledWith({ severity: "medium", page: 2 });
  });

  it("defaults to severity=all and page=1 when params are absent", async () => {
    mockRequireProviderAdmin.mockResolvedValue({ user: adminUser });
    const list = vi.fn().mockResolvedValue(ok({ items: [], total: 0 }));
    mockCallReviewService({ list });

    await listRoute(new Request("http://localhost/api/provider-admin/calls"));

    expect(list).toHaveBeenCalledWith({ severity: "all", page: 1 });
  });
});

describe("GET /api/provider-admin/calls/[id]", () => {
  beforeEach(() => {
    mockRequireProviderAdmin.mockReset();
    mockCreateServices.mockReset();
    mockCreateServices.mockResolvedValue({ auth: {} });
  });

  it("returns 401 when unauthenticated", async () => {
    mockRequireProviderAdmin.mockRejectedValue(AppError.unauthorized());
    const response = await detailRoute(
      new Request("http://localhost/api/provider-admin/calls/cr-1"),
      { params: Promise.resolve({ id: "cr-1" }) },
    );
    expect(response.status).toBe(401);
  });

  it("returns 404 when the call review does not exist", async () => {
    mockRequireProviderAdmin.mockResolvedValue({ user: adminUser });
    mockCallReviewService({ getWithLinkedSuggestion: vi.fn().mockResolvedValue(ok(null)) });

    const response = await detailRoute(
      new Request("http://localhost/api/provider-admin/calls/missing"),
      { params: Promise.resolve({ id: "missing" }) },
    );

    expect(response.status).toBe(404);
  });

  it("returns the review with its linked suggestion", async () => {
    mockRequireProviderAdmin.mockResolvedValue({ user: adminUser });
    const payload = { review: { id: "cr-1" }, linkedSuggestion: null };
    mockCallReviewService({ getWithLinkedSuggestion: vi.fn().mockResolvedValue(ok(payload)) });

    const response = await detailRoute(
      new Request("http://localhost/api/provider-admin/calls/cr-1"),
      { params: Promise.resolve({ id: "cr-1" }) },
    );
    const body = (await response.json()) as { data: typeof payload };

    expect(response.status).toBe(200);
    expect(body.data).toEqual(payload);
  });
});
```

- [ ] **Step 9: הרץ, ודא כישלון**

```bash
npx vitest run tests/unit/provider-admin-calls-routes.test.ts
```
Expected: FAIL — הroutes לא קיימים עדיין.

- [ ] **Step 10: כתוב את `app/app/api/provider-admin/calls/route.ts`**

```typescript
import { createServices } from "@/lib/services/factory";
import { requireProviderAdmin } from "@/lib/api/provider-admin";
import { createRequestId } from "@/lib/api/request-id";
import { handleRouteError, jsonSuccess } from "@/lib/api/response";
import type { CallReviewSeverityFilter } from "@/types/domain/call-review";

const VALID_SEVERITIES: CallReviewSeverityFilter[] = ["all", "none", "low", "medium", "high", "critical"];

function parseSeverity(value: string | null): CallReviewSeverityFilter {
  return VALID_SEVERITIES.includes(value as CallReviewSeverityFilter)
    ? (value as CallReviewSeverityFilter)
    : "all";
}

export async function GET(request: Request) {
  const requestId = createRequestId();

  try {
    const services = await createServices();
    await requireProviderAdmin(services.auth);

    const url = new URL(request.url);
    const severity = parseSeverity(url.searchParams.get("severity"));
    const page = Math.max(1, Number(url.searchParams.get("page")) || 1);

    const result = await services.callReview.list({ severity, page });
    if (!result.ok) return handleRouteError(result.error, requestId);
    return jsonSuccess(result.value, 200, requestId);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
```

- [ ] **Step 11: כתוב את `app/app/api/provider-admin/calls/[id]/route.ts`**

```typescript
import { createServices } from "@/lib/services/factory";
import { requireProviderAdmin } from "@/lib/api/provider-admin";
import { createRequestId } from "@/lib/api/request-id";
import { AppError } from "@/lib/errors/app-error";
import { handleRouteError, jsonSuccess } from "@/lib/api/response";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = createRequestId();

  try {
    const services = await createServices();
    await requireProviderAdmin(services.auth);
    const { id } = await params;

    const result = await services.callReview.getWithLinkedSuggestion(id);
    if (!result.ok) return handleRouteError(result.error, requestId);
    if (!result.value) return handleRouteError(AppError.notFound("Call review not found"), requestId);

    return jsonSuccess(result.value, 200, requestId);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
```

- [ ] **Step 12: הרץ את הטסטים וודא שהם עוברים**

```bash
npx vitest run tests/unit/provider-admin-calls-routes.test.ts
```
Expected: 7/7 PASS.

- [ ] **Step 13: הרץ typecheck מלא (סוגר את Task 6 + Task 7 יחד)**

```bash
npx tsc --noEmit
```
Expected: exit 0.

- [ ] **Step 14: הרץ את כל חבילת הטסטים של app**

```bash
npx vitest run
```
Expected: כל הקבצים עוברים.

- [ ] **Step 15: Commit (Task 6 + Task 7 יחד)**

```bash
git add app/lib/services/prompt-suggestion.service.ts app/lib/repositories/prompt-suggestion.repository.ts app/tests/unit/prompt-suggestion.service.test.ts app/app/api/prompt-suggestions app/tests/unit/prompt-suggestions-routes.test.ts app/app/api/provider-admin app/tests/unit/provider-admin-calls-routes.test.ts app/lib/services/factory.ts
git commit -m "feat: gate prompt-suggestions on provider-admin, add provider-admin calls API"
```

---

### Task 8: `proxy.ts` — session redirect ל-`/provider-admin`

**Files:**
- Modify: `app/proxy.ts`

- [ ] **Step 1: עדכן את התנאי ואת ה-matcher**

Replace:
```typescript
  if (pathname.startsWith("/dashboard") && !user) {
```
with:
```typescript
  if ((pathname.startsWith("/dashboard") || pathname.startsWith("/provider-admin")) && !user) {
```

Replace:
```typescript
export const config = {
  matcher: ["/dashboard/:path*", "/login"],
};
```
with:
```typescript
export const config = {
  matcher: ["/dashboard/:path*", "/provider-admin/:path*", "/login"],
};
```

- [ ] **Step 2: Commit**

```bash
git add app/proxy.ts
git commit -m "feat: redirect unauthenticated /provider-admin requests to login"
```

---

### Task 9: Shell — `ProviderAdminSidebar` + `layout.tsx`

**Files:**
- Create: `app/components/provider-admin/sidebar.tsx`
- Create: `app/app/provider-admin/layout.tsx`

- [ ] **Step 1: כתוב את `app/components/provider-admin/sidebar.tsx`**

```typescript
"use client";
import React from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";

const NAV_ITEMS = [
  { href: "/provider-admin/calls", label: "שיחות QA" },
  { href: "/provider-admin/improvements", label: "הצעות תיקון" },
];

export function ProviderAdminSidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="flex flex-col flex-shrink-0"
      style={{ width: "var(--sidebar-w)", background: "var(--rail-bg)" }}
    >
      <div className="px-4 py-5" style={{ borderBottom: "1px solid var(--rail-separator)" }}>
        <p className="text-[13px] font-semibold" style={{ color: "var(--rail-text-strong)" }}>
          Provider Admin
        </p>
        <p className="text-[11px]" style={{ color: "var(--rail-text-muted)" }}>Get A Vet · תומר</p>
      </div>
      <nav className="flex-1 py-3">
        {NAV_ITEMS.map((item) => {
          const active = pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center px-4 h-9 mx-2 rounded-[var(--radius-2)] text-[13px] font-medium"
              style={{
                background: active ? "var(--rail-bg-active)" : "transparent",
                color: active ? "var(--rail-text-strong)" : "var(--rail-text)",
                borderInlineStart: active ? "2px solid var(--rail-marker)" : "2px solid transparent",
              }}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
```

- [ ] **Step 2: כתוב את `app/app/provider-admin/layout.tsx`**

```typescript
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createServices } from "@/lib/services/factory";
import { ToastProvider } from "@/components/dashboard/ui/toast";
import { ProviderAdminSidebar } from "@/components/provider-admin/sidebar";

export default async function ProviderAdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const services = await createServices();
  const profileResult = await services.auth.getProfile(user.id);
  if (!profileResult.ok || profileResult.value?.role !== "provider_admin") {
    redirect("/dashboard");
  }

  return (
    <ToastProvider>
      <div className="flex h-screen overflow-hidden" style={{ background: "var(--surface-canvas)" }}>
        <ProviderAdminSidebar />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </ToastProvider>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/components/provider-admin/sidebar.tsx app/app/provider-admin/layout.tsx
git commit -m "feat: add provider-admin shell (sidebar + layout, role-gated)"
```

(אין טסט ייעודי ל-shell — הגייטינג עצמו כבר מכוסה ב-`requireProviderAdmin` (Task 3); אימות ידני ב-Task 13.)

---

### Task 10: `/provider-admin` redirect + `/provider-admin/calls`

**Files:**
- Create: `app/app/provider-admin/page.tsx`
- Create: `app/app/provider-admin/calls/page.tsx`

- [ ] **Step 1: כתוב את ה-redirect**

```typescript
import { redirect } from "next/navigation";

export default function ProviderAdminIndexPage() {
  redirect("/provider-admin/calls");
}
```

- [ ] **Step 2: כתוב את `app/app/provider-admin/calls/page.tsx`**

```typescript
"use client";
import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/dashboard/ui/card";
import { Badge } from "@/components/dashboard/ui/badge";
import { EmptyState } from "@/components/dashboard/ui/empty-state";
import { SkeletonRow } from "@/components/dashboard/ui/skeleton";
import type { CallReview, CallReviewSeverityFilter } from "@/types/domain/call-review";

const SEVERITY_TONE: Record<string, "critical" | "pending" | "info" | "done"> = {
  critical: "critical",
  high: "critical",
  medium: "pending",
  low: "info",
  none: "done",
};

const SEVERITY_LABEL: Record<string, string> = {
  critical: "קריטית",
  high: "גבוהה",
  medium: "בינונית",
  low: "נמוכה",
  none: "ללא חריגה",
};

const FILTERS: { value: CallReviewSeverityFilter; label: string }[] = [
  { value: "all", label: "הכול" },
  { value: "critical", label: "קריטית" },
  { value: "medium", label: "בינונית" },
  { value: "none", label: "ללא חריגה" },
];

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("he-IL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function ProviderAdminCallsPage() {
  const [items, setItems] = useState<CallReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [severity, setSeverity] = useState<CallReviewSeverityFilter>("all");

  const fetchData = useCallback(async (sev: CallReviewSeverityFilter) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/provider-admin/calls?severity=${sev}&page=1`);
      if (res.ok) {
        const d = (await res.json()) as { data: { items: CallReview[] } };
        setItems(d.data.items ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData(severity);
  }, [severity, fetchData]);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 style={{ font: "var(--type-page-title)", color: "var(--text-primary)" }}>שיחות עם ניקוד QA</h1>
        <div className="flex rounded-[var(--radius-2)] border border-[var(--border-field)] overflow-hidden">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setSeverity(f.value)}
              className="px-3 h-[var(--control-h)] text-[13px] font-medium transition-colors"
              style={{
                background: severity === f.value ? "var(--accent)" : "transparent",
                color: severity === f.value ? "var(--text-on-accent)" : "var(--text-secondary)",
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}
        </div>
      ) : items.length === 0 ? (
        <EmptyState title="אין שיחות בטווח הזה" subtitle="שיחות עם ניקוד QA מ-30 הימים האחרונים יופיעו כאן." />
      ) : (
        <Card noPad>
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-hairline)" }}>
                <th className="px-4 py-3 text-start text-[12px] font-semibold" style={{ color: "var(--text-faint)" }}>מתקשר</th>
                <th className="px-4 py-3 text-start text-[12px] font-semibold" style={{ color: "var(--text-faint)" }}>ציון כללי</th>
                <th className="px-4 py-3 text-start text-[12px] font-semibold" style={{ color: "var(--text-faint)" }}>חומרה</th>
                <th className="px-4 py-3 text-start text-[12px] font-semibold" style={{ color: "var(--text-faint)" }}>סיכום</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={item.id}>
                  <td colSpan={4} className="p-0">
                    <Link
                      href={`/provider-admin/calls/${item.id}`}
                      className="grid grid-cols-4 items-center px-0 py-0 cursor-pointer"
                      style={{
                        borderBottom: i < items.length - 1 ? "1px solid var(--border-row)" : "none",
                      }}
                    >
                      <span className="px-4 py-3 text-[13.5px]" style={{ color: "var(--text-primary)" }}>
                        {item.conversationId}
                        <span className="block text-[11.5px]" style={{ color: "var(--text-faint)" }}>{fmtDate(item.createdAt)}</span>
                      </span>
                      <span className="px-4 py-3" style={{ font: "var(--type-metric)", color: "var(--text-primary)" }}>
                        {item.overallScore ?? "—"}
                      </span>
                      <span className="px-4 py-3">
                        <Badge tone={SEVERITY_TONE[item.exceptionSeverity ?? "none"]}>
                          {SEVERITY_LABEL[item.exceptionSeverity ?? "none"]}
                        </Badge>
                      </span>
                      <span className="px-4 py-3 text-[12.5px] truncate block" style={{ color: "var(--text-secondary)" }}>
                        {item.reviewerSummary ?? "—"}
                      </span>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/app/provider-admin/page.tsx app/app/provider-admin/calls/page.tsx
git commit -m "feat: add /provider-admin redirect and calls list screen"
```

---

### Task 11: `/provider-admin/calls/[id]`

**Files:**
- Create: `app/app/provider-admin/calls/[id]/page.tsx`

- [ ] **Step 1: כתוב את הדף**

```typescript
"use client";
import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, SectionHeading } from "@/components/dashboard/ui/card";
import { Badge } from "@/components/dashboard/ui/badge";
import { EmptyState } from "@/components/dashboard/ui/empty-state";
import type { CallReview } from "@/types/domain/call-review";
import type { PromptSuggestion } from "@/types/domain/prompt-suggestion";

type Detail = { review: CallReview; linkedSuggestion: PromptSuggestion | null };

const SCORE_LABELS: { key: keyof CallReview; label: string }[] = [
  { key: "empathyScore", label: "אמפתיה" },
  { key: "naturalnessScore", label: "טבעיות" },
  { key: "accuracyScore", label: "דיוק" },
  { key: "protocolScore", label: "נוהל" },
  { key: "safetyScore", label: "בטיחות" },
  { key: "resolutionScore", label: "פתרון" },
];

export default function ProviderAdminCallDetailPage() {
  const params = useParams<{ id: string }>();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const res = await fetch(`/api/provider-admin/calls/${params.id}`);
      if (res.status === 404) {
        setNotFound(true);
      } else if (res.ok) {
        const d = (await res.json()) as { data: Detail };
        setDetail(d.data);
      }
      setLoading(false);
    })();
  }, [params.id]);

  if (loading) return <div className="p-6" />;
  if (notFound || !detail) {
    return (
      <div className="p-6">
        <EmptyState title="השיחה לא נמצאה" />
      </div>
    );
  }

  const { review, linkedSuggestion } = detail;

  return (
    <div className="p-6 space-y-5 max-w-3xl">
      <div>
        <h1 style={{ font: "var(--type-page-title)", color: "var(--text-primary)" }}>{review.conversationId}</h1>
        <p className="text-[12.5px]" style={{ color: "var(--text-muted)" }}>
          {new Date(review.createdAt).toLocaleString("he-IL")} · {review.callDurationSecs ?? "—"} שניות
        </p>
      </div>

      <Card>
        <SectionHeading title="ציוני QA" />
        <div className="grid grid-cols-3 gap-4 mt-3">
          <div>
            <p className="text-[11px]" style={{ color: "var(--text-faint)" }}>ציון כללי</p>
            <p style={{ font: "var(--type-metric)", color: "var(--text-primary)" }}>{review.overallScore ?? "—"}</p>
          </div>
          {SCORE_LABELS.map(({ key, label }) => (
            <div key={String(key)}>
              <p className="text-[11px]" style={{ color: "var(--text-faint)" }}>{label}</p>
              <p style={{ font: "var(--type-row)", color: "var(--text-primary)" }}>{String(review[key] ?? "—")}</p>
            </div>
          ))}
        </div>
        {review.exceptionSeverity && (
          <div className="mt-3">
            <Badge tone={review.isException ? "critical" : "done"}>
              {review.isException ? `חריגה — חומרה ${review.exceptionSeverity}` : "ללא חריגה"}
            </Badge>
          </div>
        )}
      </Card>

      {review.reviewerSummary && (
        <Card>
          <SectionHeading title="סיכום הביקורת" />
          <p className="text-[13.5px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>{review.reviewerSummary}</p>
        </Card>
      )}

      {review.problems.length > 0 && (
        <Card>
          <SectionHeading title="בעיות שזוהו" count={review.problems.length} />
          <div className="space-y-3 mt-3">
            {review.problems.map((p, i) => (
              <div key={i} style={{ borderBottom: i < review.problems.length - 1 ? "1px solid var(--border-row)" : "none", paddingBottom: 10 }}>
                <p className="text-[13.5px] font-medium" style={{ color: "var(--text-primary)" }}>{p.problem}</p>
                {p.root_cause && <p className="text-[12.5px] mt-1" style={{ color: "var(--text-muted)" }}>סיבה: {p.root_cause}</p>}
                {p.proposed_change && <p className="text-[12.5px] mt-1" style={{ color: "var(--text-secondary)" }}>הצעה: {p.proposed_change}</p>}
              </div>
            ))}
          </div>
        </Card>
      )}

      {linkedSuggestion && (
        <Card>
          <SectionHeading title="הצעת תיקון מקושרת" />
          <p className="text-[13.5px]" style={{ color: "var(--text-secondary)" }}>{linkedSuggestion.patternSummary}</p>
          <Link href="/provider-admin/improvements" className="text-[12.5px] mt-2 inline-block" style={{ color: "var(--text-link)" }}>
            לתיבת ההצעות ←
          </Link>
        </Card>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add "app/app/provider-admin/calls/[id]/page.tsx"
git commit -m "feat: add /provider-admin/calls/[id] detail screen"
```

---

### Task 12: `/provider-admin/improvements`

**Files:**
- Create: `app/app/provider-admin/improvements/page.tsx`

- [ ] **Step 1: כתוב את הדף**

```typescript
"use client";
import React, { useCallback, useEffect, useState } from "react";
import { Card, SectionHeading } from "@/components/dashboard/ui/card";
import { Badge } from "@/components/dashboard/ui/badge";
import { Btn } from "@/components/dashboard/ui/btn";
import { EmptyState } from "@/components/dashboard/ui/empty-state";
import { useToast } from "@/components/dashboard/ui/toast";
import type { PromptSuggestion } from "@/types/domain/prompt-suggestion";

export default function ProviderAdminImprovementsPage() {
  const [items, setItems] = useState<PromptSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/prompt-suggestions");
    if (res.ok) {
      const d = (await res.json()) as { data: { items: PromptSuggestion[] } };
      setItems(d.data.items ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  async function act(id: string, action: "approve" | "reject") {
    setBusyId(id);
    try {
      const res = await fetch(`/api/prompt-suggestions/${id}/${action}`, { method: "POST" });
      if (!res.ok) {
        toast("הפעולה נכשלה", "error");
        return;
      }
      const body = (await res.json()) as { data: { message?: string; status: string } };
      toast(body.data.message || `הצעה סומנה ${body.data.status}`, "success");
      setItems((prev) => prev.filter((s) => s.id !== id));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="p-6 space-y-5 max-w-3xl">
      <h1 style={{ font: "var(--type-page-title)", color: "var(--text-primary)" }}>הצעות תיקון</h1>

      {loading ? null : items.length === 0 ? (
        <EmptyState title="אין הצעות ממתינות" subtitle="הצעות תיקון שנוצרות מהניתוח השבועי יופיעו כאן." />
      ) : (
        <div className="space-y-3">
          {items.map((s) => (
            <Card key={s.id}>
              <SectionHeading title={s.patternSummary} action={<Badge tone="info">{s.category}</Badge>} />
              {s.proposedChange && (
                <p className="text-[13.5px] mt-2" style={{ color: "var(--text-secondary)" }}>{s.proposedChange}</p>
              )}
              {s.category === "prompt" && s.suggestedPrompt && (
                <pre
                  className="mt-3 p-3 text-[12px] whitespace-pre-wrap"
                  style={{ background: "var(--surface-sunken)", borderRadius: "var(--radius-2)", color: "var(--text-secondary)" }}
                >
                  {s.suggestedPrompt}
                </pre>
              )}
              <div className="flex gap-2 mt-4">
                <Btn variant="primary" size="sm" loading={busyId === s.id} onClick={() => void act(s.id, "approve")}>
                  אשר
                </Btn>
                <Btn variant="dangerSoft" size="sm" loading={busyId === s.id} onClick={() => void act(s.id, "reject")}>
                  דחה
                </Btn>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/app/provider-admin/improvements/page.tsx
git commit -m "feat: add /provider-admin/improvements approval screen"
```

---

### Task 13: אימות מלא + migration + הענקת role + deploy

**Files:** none — verification + deployment only.

- [ ] **Step 1: הרץ את כל שתי חבילות הטסטים מה-root**

```bash
cd /Users/idoamsalem/mvp-noa-1-0/.worktrees/provider-admin-dashboard
npm run test:all
```
Expected: agent + app שניהם ירוקים במלואם.

- [ ] **Step 2: הרץ typecheck מלא**

```bash
npm run typecheck:all
```
Expected: exit 0.

- [ ] **Step 3: `npm run build --workspace=app` — ודא שהעמודים החדשים בונים ב-Next.js**

```bash
cd app && npm run build
```
Expected: build מצליח, ללא שגיאות type/import ב-`provider-admin/*`.

- [ ] **Step 4: עצור לאישור מפורש לפני החלת המיגרציה על הענן**

לאחר אישור:
```bash
cd /Users/idoamsalem/mvp-noa-1-0/.worktrees/provider-admin-dashboard
supabase db push --linked
```
Expected: מחיל את `20260901120000_profiles_role.sql` (בדוק קודם `supabase migration list --linked` — ייתכנו migrations לא-קשורים ממתינים מסשנים אחרים, כמו שקרה בשלב 2; אל תדחוף אותם בלי לבדוק מה הם).

- [ ] **Step 5: עצור לאישור מפורש לפני העדכון הידני של role**

```sql
select id, email from auth.users where email = 'admin@voxly--ai.com';
-- verify the row is real, then:
update public.profiles set role = 'provider_admin' where id = '<verified-id>';
```

- [ ] **Step 6: אימות ידני — deploy ל-Vercel (push ל-main מפעיל auto-deploy) ואז**

1. כניסה כ-`admin@voxly--ai.com` → `/provider-admin/calls` נטען, מציג שיחות.
2. כניסה כ-clinic_user רגיל → ניסיון גישה ל-`/provider-admin` → redirect ל-`/dashboard`.
3. פתיחת שיחה עם חריגה → `/provider-admin/calls/[id]` מציג ציונים/בעיות.
4. `/provider-admin/improvements` → אישור/דחייה מול ההצעה האמיתית שכבר קיימת ב-DB (`af6371ff-cc63-4705-aa0c-7b35faafefa3`, category=`prompt`) — ודא שה-regression+publish רץ.

---

## Self-Review

**כיסוי ה-spec:** הרשאות (Tasks 1-3) ✓, backend call-review (Task 4-5) ✓, רפקטור prompt-suggestion (Task 6) ✓, גייטינג + API routes (Task 7) ✓, proxy (Task 8) ✓, shell+3 מסכים (Tasks 9-12) ✓, אימות+migration (Task 13) ✓.

**סריקת placeholders:** אין TBD — כל קוד ה-tasks מלא.

**עקביות טיפוסים:** `CallReview`/`CallReviewSeverityFilter` (Task 4) עקביים בין ה-repository, ה-service (Task 5), ה-API routes (Task 7), וה-UI (Tasks 10-11). `PromptSuggestionService.approve/reject(userId: string, id: string)` (Task 6) תואם בדיוק לקריאות ב-routes (Task 7) וב-UI (Task 12, דרך ה-API בלבד — ה-UI לא קורא ל-service ישירות).
