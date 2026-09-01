# שלב 3: דשבורד Provider Admin — Design Spec (פונקציונלי)

> חלק מ-`docs/superpowers/plans/2026-08-30-tomer-qa-kb-provider-admin-roadmap.md` (שלב 3). נכתב ב-brainstorming, אושר.
>
> **הערה על עיצוב ויזואלי:** המשתמש בונה מערכת עיצוב חדשה לדשבורד באופן עצמאי. ה-spec הזה עוסק **רק במבנה הפונקציונלי** (routes, הרשאות, backend, זרימת נתונים) — לא בעיצוב סופי (צבעים, טיפוגרפיה, spacing). ה-UI שייבנה בשלב המימוש ישתמש בסגנון מינימלי/פונקציונלי (מבוסס על רכיבי ה-UI הקיימים ב-`app/components/dashboard/ui/`, ללא polish ויזואלי מיוחד) ויוחלף כשמערכת העיצוב החדשה תוטמע.

## רקע

`docs/design/dashboard/README.md` חושף שה-`app/app/globals.css` הקיים בפרודקשן משתמש בערכי צבע שגויים (teal במקום הכתום הקנוני של המותג) — **לא בסקופ של שלב 3**, מטופל בנפרד ע"י המשתמש.

## הרשאות

### Migration

```sql
alter table public.profiles add column role text not null default 'clinic_user'
  check (role in ('clinic_user','provider_admin'));
```

**עדכון ידני חד-פעמי (לא בקובץ migration — מבוצע ידנית אחרי המיגרציה, אחרי אימות שהמשתמש קיים):**

```sql
-- verify first:
select id, email from auth.users where email = 'admin@voxly--ai.com';
-- then:
update public.profiles set role = 'provider_admin' where id = '<verified-id>';
```

### תלות: `AuthService.getProfile()` (חדש, שיטה קטנה על שירות קיים)

`createServices()` (ב-`app/lib/services/factory.ts`) **לא חושף `profile` כ-service עצמאי כרגע** — `ProfileRepository` מוזרק פנימית ל-`AuthService` בלבד ומשמש רק בתוך `getCurrentContext()`. במקום להוסיף service חדש שלם בשביל שיטה אחת, מוסיפים מתודה קטנה ל-`AuthService` הקיים (`app/lib/services/auth.service.ts`), עקבי עם איך שהוא כבר משתמש ב-`profileRepository`:

```typescript
async getProfile(userId: string): Promise<Result<Profile | null>> {
  return this.profileRepository.findByUserId(userId);
}
```

### `requireProviderAdmin()`

`app/lib/api/provider-admin.ts` — אותו דפוס כמו `requireAuth()` הקיים (`app/lib/api/auth-guard.ts`), אבל בודק גם role. חתימה עם פרמטר יחיד (`authService`), בדיוק כמו `requireAuth(authService)` — לא צריך `profileRepository` בנפרד כי `AuthService.getProfile()` כבר עוטף אותו:

```typescript
import { AppError } from "@/lib/errors/app-error";
import type { AuthService } from "@/lib/services/auth.service";
import type { Profile } from "@/types/domain/profile";
import type { User } from "@supabase/supabase-js";

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

**חשוב:** לא `getActorAndServices()` — זה זורק `forbidden` עבור מי שאין לו חברות במרפאה בכלל (`actor.clinicIds.length === 0`), ו-provider_admin לא בהכרח חבר קליניקה.

### `Profile` domain type

`app/types/domain/profile.ts` — הצורה הנוכחית (`id`, `fullName`, `phone`, `defaultClinicId`, `createdAt`, `updatedAt`, `deletedAt`) מקבלת שדה נוסף:

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

`mapProfileRow` (ב-`app/lib/repositories/mappers.ts:42`) מתעדכן להוסיף `role: row.role as Profile["role"]`.

### הגנת עמודים

`app/app/provider-admin/layout.tsx` (server component) — מבנה מקביל בדיוק ל-`app/app/dashboard/layout.tsx` הקיים:

```typescript
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createServices } from "@/lib/services/factory";

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
    <div className="flex h-screen overflow-hidden">
      {/* Minimal nav shell — Calls | Improvements. Will be restyled once the
          new design system lands; no visual polish investment now. */}
      {children}
    </div>
  );
}
```

### `proxy.ts`

הוספת `/provider-admin/:path*` ל-`matcher`, והרחבת תנאי ה-redirect הקיים לכלול גם אותו (רק בדיקת session, לא role — ה-role נבדק ב-layout, נמנע round-trip DB נוסף ב-edge runtime):

```typescript
if ((pathname.startsWith("/dashboard") || pathname.startsWith("/provider-admin")) && !user) {
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}
```

```typescript
export const config = {
  matcher: ["/dashboard/:path*", "/provider-admin/:path*", "/login"],
};
```

## Scope הנתונים — לא מסונן לפי clinic_id

`provider_admin` הוא role כלל-מערכתי (מוגדר על `profiles`, לא `clinic_memberships`). ה-repository/service החדשים **לא** מסננים לפי `clinic_id` בשום שאילתה — בניגוד לכל שאר ה-repositories באפליקציה שתמיד מסננים לפי `actor.clinicIds`. כרגע יש מרפאה אחת בלבד (Get A Vet) אז זה לא מורגש בפועל, אבל זו החלטה מכוונת לטובת עתיד רב-מרפאות.

## Backend חדש: Call Review

### `app/types/domain/call-review.ts`

```typescript
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
  exceptionSeverity: "none" | "low" | "medium" | "high" | "critical" | null;
  strengths: string[];
  problems: Array<{
    moment?: string;
    problem: string;
    root_cause?: string;
    category?: string;
    priority?: string;
    target_file?: string;
    proposed_change?: string;
  }>;
  reviewerSummary: string | null;
  analyzerModel: string | null;
  createdAt: string;
};

export type CallReviewSeverityFilter = "all" | "critical" | "high" | "medium" | "low" | "none";
```

### `app/lib/repositories/call-review.repository.ts`

```typescript
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
      .order("created_at", { ascending: false })
      .range(params.offset, params.offset + params.limit - 1);

    if (params.severity !== "all") {
      query = query.eq("exception_severity", params.severity);
    }

    const { data, error, count } = await query;
    if (error) return err(AppError.externalProvider("Failed to list call reviews", error));
    return ok({ items: (data ?? []).map(mapCallReviewRow), total: count ?? 0 });
  }

  async findById(id: string): Promise<Result<CallReview | null>> {
    const { data, error } = await this.client.from("call_reviews").select("*").eq("id", id).maybeSingle();
    if (error) return err(AppError.externalProvider("Failed to load call review", error));
    return ok(data ? mapCallReviewRow(data) : null);
  }
}
```

Note: `call_reviews` uses the service-role client (same deny-by-default RLS pattern as `tomer_prompt_suggestions`) — this repository is constructed with the admin client, same as `PromptSuggestionRepository`.

### `app/lib/services/call-review.service.ts`

Thin — permission already enforced by `requireProviderAdmin()` at the route boundary, so the service does no actor-based filtering. Its one piece of real logic: attaching a linked `tomer_prompt_suggestions` row (if any) to a call-review detail, by checking whether the call review's `id` appears in a suggestion's `supporting_call_review_ids`.

```typescript
export class CallReviewService {
  constructor(
    private readonly repo: CallReviewRepository,
    private readonly promptSuggestionRepo: PromptSuggestionRepository,
  ) {}

  async list(params: { severity: CallReviewSeverityFilter; page: number }): Promise<Result<{ items: CallReview[]; total: number }>> {
    return this.repo.listRecent({ sinceDays: 30, severity: params.severity, limit: 50, offset: (params.page - 1) * 50 });
  }

  async getWithLinkedSuggestion(id: string): Promise<Result<{ review: CallReview; linkedSuggestion: PromptSuggestion | null } | null>> {
    const reviewResult = await this.repo.findById(id);
    if (!reviewResult.ok) return reviewResult;
    if (!reviewResult.value) return ok(null);

    const suggestionResult = await this.promptSuggestionRepo.findBySupportingCallReviewId(id);
    if (!suggestionResult.ok) return suggestionResult;

    return ok({ review: reviewResult.value, linkedSuggestion: suggestionResult.value });
  }
}
```

**New repository method needed on `PromptSuggestionRepository`:** `findBySupportingCallReviewId(callReviewId: string): Promise<Result<PromptSuggestion | null>>` — queries `tomer_prompt_suggestions` where `supporting_call_review_ids` contains the given id (`.contains("supporting_call_review_ids", [callReviewId])`), returns the most recent match or null.

### API routes

- `app/app/api/provider-admin/calls/route.ts` — `GET`, query params `?severity=&page=`, calls `requireProviderAdmin()` first.
- `app/app/api/provider-admin/calls/[id]/route.ts` — `GET`, same guard.

## Refactor: `PromptSuggestionService` — clinic-role gating → provider-admin gating

Current signatures take `ServiceActor` (clinic-scoped) and check `hasPrivilegedClinicRole(actor, suggestion.clinicId)` inside `approve()`/`reject()`. Since gating now happens once at the API boundary (`requireProviderAdmin()`), this becomes redundant and clinic-shaped in a way that no longer fits. New signatures:

```typescript
async listPending(): Promise<Result<PromptSuggestion[]>>
async reject(reviewedByUserId: string, id: string): Promise<Result<PromptSuggestion>>
async approve(reviewedByUserId: string, id: string): Promise<Result<PromptSuggestion>>
```

`hasPrivilegedClinicRole` and the `ServiceActor` import are removed from `prompt-suggestion.service.ts`. `PromptSuggestionRepository.listByStatus` no longer takes `clinicIds` (drops the `.in("clinic_id", clinicIds)` filter — matches the "no clinic scoping" decision above).

### API routes re-gated

`app/app/api/prompt-suggestions/route.ts`, `[id]/approve/route.ts`, `[id]/reject/route.ts` — replace `getActorAndServices()` + `promptSuggestion.listPending(actor)` / `.approve(actor, id)` with `requireProviderAdmin(...)` + `.listPending()` / `.approve(user.id, id)`. No backward compatibility needed (roadmap confirmed: no consumer UI exists yet).

## Routes (pages)

| Route | תוכן |
|---|---|
| `/provider-admin` | redirect ל-`/provider-admin/calls` |
| `/provider-admin/calls` | רשימה: חריגות ראשונות, פילטר חומרה, 30 יום אחרונים + pagination (50/עמוד) |
| `/provider-admin/calls/[id]` | פרטים מלאים: תמלול, 6 ציונים, `problems[]`, `reviewer_summary`, הצעת-תיקון מקושרת אם קיימת |
| `/provider-admin/improvements` | תיבת `tomer_prompt_suggestions` בסטטוס `pending`, אישור/דחייה |

`layout.tsx` + ניווט מינימלי (Calls / Improvements) — לא סיידבר של המרפאה, לא polish ויזואלי בשלב הזה.

## מפורש מחוץ לסקופ

- עיצוב ויזואלי סופי (ממתין למערכת העיצוב החדשה של המשתמש).
- אנליטיקה/צבירה (KPI cards, גרפים) — נדחה מפורשות ב-roadmap הראשי.
- שינוי הרשאות בזמן ריצה (UI לניהול role) — ה-UPDATE הידני מספיק לפיילוט.

## אימות

1. טסטים: `call-review.repository.test.ts`, `call-review.service.test.ts`, `provider-admin.test.ts` (ה-guard), עדכון `prompt-suggestion.service.test.ts` + `prompt-suggestion.repository-race-guard.test.ts` לחתימות החדשות, עדכון `prompt-suggestions-routes.test.ts` לגייטינג החדש.
2. כניסה כ-`admin@voxly--ai.com` (provider_admin) מול משתמש `clinic_user` רגיל — הראשון רואה `/provider-admin/*`, השני מקבל redirect ל-`/dashboard`.
3. אישור/דחייה ידניים מול ההצעה האמיתית שכבר קיימת ב-DB (`af6371ff-cc63-4705-aa0c-7b35faafefa3`, category=`prompt`) — מוודא שה-regression+publish עדיין רץ נכון תחת החתימה החדשה.
