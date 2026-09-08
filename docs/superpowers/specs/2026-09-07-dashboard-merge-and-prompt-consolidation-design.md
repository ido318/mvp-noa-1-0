# מיזוג Provider Admin לדשבורד הרגיל + איחוד הצעות תיקון — Design Spec

**תאריך:** 2026-09-07
**סטטוס:** מאושר ע"י המשתמש (ראה שיחת brainstorming)

## רקע

שלב 3 (Provider Admin dashboard) נבנה כמסך נפרד לגמרי (`/provider-admin/*`, layout+sidebar משלו, guard ייעודי `requireProviderAdmin`). אחרי בדיקה בפרודקשן, המשתמש ביקש שני שינויים:

1. **מיזוג ניווט** — "שיחות QA" ו"הצעות תיקון" עוברים לתוך תפריט הדשבורד הרגיל (`/dashboard`, אותו login שנועה משתמשת בו), נעלמים מהמסך הנפרד.
2. **פיצ'ר חדש — איחוד הצעות תיקון** — מסך/כפתור שלוקח את כל הצעות התיקון הפתוחות (שחוזרות הרבה פעמים על אותה בעיה במילים שונות) ומאחד אותן, בעזרת LLM, לפרומפט מלא אחד מעודכן — מוכן לאישור ופרסום לסוכן "תומר" ב-ElevenLabs.

זהו מסמך spec יחיד לשני החלקים, כי הם נבנים ברצף על אותה תשתית (`tomer_prompt_suggestions`, `PromptSuggestionService`).

---

## חלק A: מיזוג הניווט לדשבורד הרגיל

### עקרון

הגייטינג לפי `profiles.role='provider_admin'` **נשאר בדיוק כמו שהוא** — רק המיקום הפיזי של המסכים והניווט אליהם משתנה. שני המסכים ("שיחות QA", "הצעות תיקון") ייעלמו מהתפריט למשתמש `clinic_user` רגיל, ויופיעו רק ל-`provider_admin`. ה-API routes הקיימים (`/api/provider-admin/calls/*`, `/api/prompt-suggestions/*`) **לא משתנים כלל** — רק הדפים שקוראים להם עוברים כתובת.

### שינויי קבצים

**קבצים שעוברים (עם עדכון role-guard):**

| מ- | אל |
|---|---|
| `app/app/provider-admin/calls/page.tsx` | `app/app/dashboard/qa-calls/page.tsx` |
| `app/app/provider-admin/calls/[id]/page.tsx` | `app/app/dashboard/qa-calls/[id]/page.tsx` |
| `app/app/provider-admin/improvements/page.tsx` | `app/app/dashboard/improvements/page.tsx` |

כל שלושת הדפים הם `"use client"` components. מכיוון שבדיקת role חייבת לרוץ ב-server (session cookies, `getProfile`), כל דף עטוף ב-**Server Component wrapper** דק שמבצע את הבדיקה ומרנדר את ה-client component המקורי (שעובר rename ל-`*Client` באותו קובץ, או קובץ נפרד `*-client.tsx` — ראו למטה).

**קובץ guard משותף חדש:** `app/lib/api/require-provider-admin-page.ts`

```typescript
import { redirect } from "next/navigation";
import { createServices } from "@/lib/services/factory";
import { requireProviderAdmin } from "@/lib/api/provider-admin";

/**
 * Page-level equivalent of requireProviderAdmin() for the API routes — used
 * by dashboard pages that are provider_admin-only but live inside the shared
 * /dashboard/* tree (so requireAuth() alone, which the tree's layout already
 * ran, is not enough). Redirects rather than throwing, since this runs in a
 * server component, not a route handler with try/catch → handleRouteError.
 */
export async function requireProviderAdminPage(): Promise<void> {
  const services = await createServices();
  try {
    await requireProviderAdmin(services.auth);
  } catch {
    redirect("/dashboard");
  }
}
```

כל אחד משלושת הדפים מקבל בתחילתו (server component):

```typescript
// app/app/dashboard/qa-calls/page.tsx
import { requireProviderAdminPage } from "@/lib/api/require-provider-admin-page";
import { ProviderAdminCallsPageClient } from "./page-client";

export default async function ProviderAdminCallsPage() {
  await requireProviderAdminPage();
  return <ProviderAdminCallsPageClient />;
}
```

והתוכן הקיים (fetch, state, JSX) עובר כמעט ללא שינוי ל-`page-client.tsx` (`"use client"`), באותה תיקייה. אותה תבנית לשלושתם: `app/app/dashboard/qa-calls/page.tsx` + `page-client.tsx`, `app/app/dashboard/qa-calls/[id]/page.tsx` + `page-client.tsx`, `app/app/dashboard/improvements/page.tsx` + `page-client.tsx`.

**קבצים שמוסרים לגמרי:**
- `app/app/provider-admin/` — כל התיקייה (layout.tsx, page.tsx [redirect], calls/, improvements/)
- `app/components/provider-admin/sidebar.tsx`

**קבצים שנשארים ללא שינוי:**
- `app/lib/api/provider-admin.ts` (`requireProviderAdmin`) — עדיין בשימוש ע"י ה-API routes וע"י ה-page guard החדש.
- `app/app/api/provider-admin/calls/*` — כל ה-API routes.
- `app/app/api/prompt-suggestions/*` — כל ה-API routes.

**`app/proxy.ts`:** מסיר `/provider-admin/:path*` מהתנאי ומה-`matcher` (חוזר למצב שהיה לפני Task 8 של שלב 3, כי `/dashboard/:path*` כבר מכסה את הדפים החדשים).

### חשיפת `role` דרך `/api/me`

`app/app/dashboard/layout.tsx` צריך לדעת אם המשתמש הוא `provider_admin` כדי להעביר את זה ל-`Sidebar`. הנתון היחיד שחסר כרגע ל-layout הוא ה-role — `MeResponse.profile` לא כולל אותו (פער שתועד כבר בסקירת קוד של Task 2 בשלב 3, ולא תוקן כי לא היה לו צרכן אז — עכשיו יש).

**שינוי `app/types/api/me.ts`:**
```typescript
profile: {
  id: string;
  fullName: string | null;
  phone: string | null;
  defaultClinicId: string | null;
  role: "clinic_user" | "provider_admin"; // חדש
};
```

**שינוי `AuthService.getCurrentContext()`** (`app/lib/services/auth.service.ts`) — בתוך האובייקט המוחזר:
```typescript
profile: {
  id: user.id,
  fullName: profile?.fullName ?? null,
  phone: profile?.phone ?? null,
  defaultClinicId: profile?.defaultClinicId ?? null,
  role: profile?.role ?? "clinic_user", // חדש
},
```

### שינוי `app/app/dashboard/layout.tsx`

מעביר `isProviderAdmin={me?.profile.role === "provider_admin"}` ל-`<Sidebar>`.

### שינוי `app/components/dashboard/sidebar.tsx`

`NAV_GROUPS` הופך מקבוע סטטי לפונקציה:

```typescript
function getNavGroups(isProviderAdmin: boolean): NavGroup[] {
  const groups: NavGroup[] = [
    { label: "מרפאה", items: [ /* ...ללא שינוי... */ ] },
    {
      label: "תומר",
      items: [
        { href: "/dashboard/calls", label: "שיחות" },
        { href: "/dashboard/escalations", label: "תשומת לב", countKey: "escalations", critical: true },
        ...(isProviderAdmin
          ? [
              { href: "/dashboard/qa-calls", label: "שיחות QA" },
              { href: "/dashboard/improvements", label: "הצעות תיקון" },
            ]
          : []),
      ],
    },
    { label: "רפואה", items: [ /* ...ללא שינוי... */ ] },
    { label: "ניהול", items: [ /* ...ללא שינוי... */ ] },
  ];
  return groups;
}
```

`SidebarProps` מקבל `isProviderAdmin?: boolean` (ברירת מחדל `false`), והרינדור קורא ל-`getNavGroups(isProviderAdmin)` במקום להשתמש בקבוע הישן.

### טסטים

- טסט קיים (אם יש) שבודק את `NAV_GROUPS` הסטטי — מותאם ל-`getNavGroups(false)` / `getNavGroups(true)`.
- `app/tests/unit/auth-service-get-profile.test.ts` וטסטים דומים ל-`getCurrentContext()` — אם קיים טסט ל-`getCurrentContext` שבודק את צורת `profile`, הוא צריך לצפות גם ל-`role`.
- אין טסט חדש ל-`requireProviderAdminPage` בפני עצמו (זה wrapper דק סביב `requireProviderAdmin`, שכבר מכוסה) — אבל שווה טסט קליל שמוודא שהוא בולע את השגיאה ומפנה, לא זורק.

---

## חלק B: איחוד הצעות תיקון לפרומפט אחד

### זרימה

1. בעמוד `/dashboard/improvements`, כפתור **"אחד הכל"** מופיע בראש המסך — פעיל רק כשיש **2 ומעלה** הצעות pending בקטגוריית `prompt`. פחות מזה → הכפתור מוסתר.
2. לחיצה → `POST /api/prompt-suggestions/consolidate` (guard: `requireProviderAdmin`, כמו שאר הנתיבים).
3. השרת:
   - שולף את כל הצעות ה-pending בקטגוריית `prompt` (`repo.listByStatus("pending")`, מסונן ל-`category==="prompt"`).
   - אם פחות מ-2 → `AppError.conflict("צריך לפחות שתי הצעות פתוחות כדי לאחד")`.
   - שולף את הפרומפט החי (`getLiveAgentConfig()`).
   - קורא ל-LLM (OpenAI, ראו "ספק ה-LLM" למטה) עם: הפרומפט החי + **כל השדות המלאים** של כל הצעה (`patternSummary`, `proposedChange`, `rootCause`, `suggestedPrompt`).
   - יוצר שורה חדשה ב-`tomer_prompt_suggestions`: `category='prompt'`, `status='pending'`, `pattern_summary` = תקציר קבוע ("איחוד N הצעות תיקון פתוחות"), `proposed_change` = תקציר שה-LLM מחזיר (מה אוחד ולמה), `suggested_prompt` = הפרומפט המלא המאוחד, `supporting_call_review_ids` = איחוד (union, ללא כפילויות) של כל ה-IDs מכל ההצעות המקוריות, `clinic_id` = של ההצעה הראשונה שנכנסה לאיחוד (כולן מאותה מרפאה בפועל), `merged_from_ids` = מערך ה-IDs של ההצעות המקוריות.
   - **מיד אחרי** (באותה קריאת שירות, לא בעסקה אטומית ברמת ה-DB — ראו "טיפול בשגיאות" למטה): מסמן את כל ההצעות המקוריות שנכנסו לאיחוד כ-`status='merged'`.
4. ה-UI מרענן את הרשימה — ההצעות המקוריות נעלמות (הן כבר לא `pending`), ההצעה המאוחדת החדשה מופיעה כרגיל עם כפתורי "אשר"/"דחה" **הקיימים, ללא שינוי קוד**. לחיצה על "אשר" מריצה בדיוק את ה-regression+publish הקיים היום (`PromptSuggestionService.approve`).

### מיגרציה חדשה

`supabase/migrations/<ts>_prompt_suggestions_merged_status.sql`:

```sql
-- Supports the "consolidate all pending prompt suggestions into one" feature:
-- a new meta-suggestion row is created from N pending ones, and those N
-- originals are marked 'merged' (a new terminal status) rather than staying
-- pending or being deleted — merged_from_ids on the new row documents the
-- reverse relationship for auditing.
alter table public.tomer_prompt_suggestions drop constraint tomer_prompt_suggestions_status_check;
alter table public.tomer_prompt_suggestions add constraint tomer_prompt_suggestions_status_check
  check (status in ('pending', 'approved', 'rejected', 'published', 'failed_regression', 'merged'));

alter table public.tomer_prompt_suggestions add column merged_from_ids uuid[];

comment on column public.tomer_prompt_suggestions.merged_from_ids is
  'Populated only on a suggestion created by the "consolidate" action: the ids of the pending prompt-category suggestions it was merged from. Null for a normal, non-merged suggestion.';
```

(שם המגבלה `tomer_prompt_suggestions_status_check` הוא הניחוש הסטנדרטי של Postgres לשם `check` שלא נקרא בפירוש במיגרציה המקורית — Task 1 של המימוש יאמת את השם האמיתי מול הסכמה החיה לפני הרצה, ויתקן במידת הצורך.)

### טיפוס `PromptSuggestion` (`app/types/domain/prompt-suggestion.ts`)

```typescript
export type PromptSuggestionStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "published"
  | "failed_regression"
  | "merged"; // חדש

export interface PromptSuggestion {
  // ...כל השדות הקיימים...
  mergedFromIds: string[] | null; // חדש
}
```

`mapPromptSuggestionRow` מקבל `mergedFromIds: (row.merged_from_ids as string[] | null) ?? null`.

### ספק ה-LLM (`app/lib/ai/prompt-consolidation/`)

עוקב אחרי הדפוס הקיים של `app/lib/ai/visit-summary/provider.ts` (stub + real, `OPENAI_API_KEY`, `generateText` מ-`ai`/`@ai-sdk/openai`).

**`app/lib/ai/prompt-consolidation/types.ts`:**
```typescript
export type ConsolidationInput = {
  livePrompt: string;
  suggestions: Array<{
    patternSummary: string;
    proposedChange: string | null;
    rootCause: string | null;
    suggestedPrompt: string | null;
  }>;
};

export type ConsolidationResult = {
  mergedPrompt: string;
  summary: string; // for proposed_change on the new meta-suggestion
};

export interface PromptConsolidationProvider {
  consolidate(input: ConsolidationInput): Promise<ConsolidationResult>;
}
```

**`app/lib/ai/prompt-consolidation/prompt.ts`** — system prompt קבוע (בעברית, כי תומר וההצעות כולן בעברית) שמסביר: זהו תומר, סוכן קולי בעברית למרפאה וטרינרית (Get A Vet) ב-ElevenLabs; המשימה שלך — לקרוא את הפרומפט החי המלא ואת רשימת הבעיות/התיקונים המוצעים (חלקן עשויות לתאר את **אותה** בעיה במילים שונות — לזהות ולאחד כפילויות כאלה); להפיק **פרומפט מלא אחד מעודכן** (לא diff, לא רשימת שינויים) שמשלב את כל התיקונים הרלוונטיים לתוך מבנה הפרומפט הקיים, תוך שמירה מדויקת על כל חלק בפרומפט החי שלא קשור לתיקונים ולא אמור להשתנות. הפלט חייב להיות רק טקסט הפרומפט המלא (ללא הקדמות/הסברים) בתגית אחת, ותקציר קצר נפרד (2-3 משפטים בעברית) של מה אוחד ולמה, בתגית שנייה.

**`app/lib/ai/prompt-consolidation/provider.ts`:**
```typescript
export function getPromptConsolidationModelName(): string {
  return process.env.AI_PROMPT_MERGE_MODEL ?? "gpt-4o-mini";
}

export function isOpenAiConfigured(): boolean { /* כמו visit-summary */ }

export function createOpenAiPromptConsolidationProvider(): PromptConsolidationProvider {
  return {
    async consolidate(input) {
      // generateText עם system prompt מ-prompt.ts, user prompt שמשלב
      // livePrompt + כל ההצעות בפורמט קריא, parsing של שתי התגיות בפלט.
      // maxOutputTokens גבוה יותר מ-visit-summary (1200) כי הפלט הוא פרומפט
      // סוכן שלם — 4000.
    },
  };
}

export function createStubPromptConsolidationProvider(
  mergedPrompt = "פרומפט מאוחד לבדיקה",
  summary = "תקציר איחוד לבדיקה",
): PromptConsolidationProvider {
  return { async consolidate() { return { mergedPrompt, summary }; } };
}
```

פורמט הפלט מה-LLM: שתי תגיות XML-פשוטות בתגובה (`<merged_prompt>...</merged_prompt>` ו-`<summary>...</summary>`), עם parsing ב-provider (regex/split) ו-fallback ברור (זרוק שגיאה אם אחת התגיות חסרה — אל תנחש).

### `PromptSuggestionRepository` — שתי מתודות חדשות

```typescript
/** Creates the meta-suggestion produced by "consolidate". Always category='prompt', status='pending'. */
async createFromMerge(input: {
  clinicId: string;
  patternSummary: string;
  proposedChange: string;
  suggestedPrompt: string;
  supportingCallReviewIds: string[];
  mergedFromIds: string[];
}): Promise<Result<PromptSuggestion>> { /* insert + select single */ }

/** Bulk-marks the source suggestions consumed by a merge. Guarded by status='pending' per row, same race-safety as markApproved/markRejected. */
async markMerged(ids: string[]): Promise<Result<void>> {
  const { error } = await this.client
    .from("tomer_prompt_suggestions")
    .update({ status: "merged" })
    .in("id", ids)
    .eq("status", "pending");
  if (error) return err(AppError.externalProvider("Failed to mark suggestions merged", error));
  return ok(undefined);
}
```

### `PromptSuggestionService` — מתודה חדשה + constructor מורחב

```typescript
export class PromptSuggestionService {
  constructor(
    private readonly repo: PromptSuggestionRepository,
    private readonly consolidationProvider?: PromptConsolidationProvider, // חדש, אופציונלי (לטסטים)
  ) {}

  // ...listPending/reject/approve ללא שינוי...

  async consolidatePending(): Promise<Result<PromptSuggestion>> {
    const pendingResult = await this.repo.listByStatus("pending");
    if (!pendingResult.ok) return pendingResult;

    const candidates = pendingResult.value.filter((s) => s.category === "prompt");
    if (candidates.length < 2) {
      return err(AppError.conflict("צריך לפחות שתי הצעות תיקון פתוחות בקטגוריית prompt כדי לאחד"));
    }

    let livePrompt: string;
    try {
      const config = await getLiveAgentConfig();
      livePrompt = extractPromptText(config); // helper: config.agent?.prompt?.prompt
    } catch (error) {
      return err(AppError.externalProvider("Failed to fetch the live agent prompt", error instanceof Error ? error.message : error));
    }

    const provider = this.consolidationProvider ?? getDefaultConsolidationProvider();
    let result: ConsolidationResult;
    try {
      result = await provider.consolidate({
        livePrompt,
        suggestions: candidates.map((s) => ({
          patternSummary: s.patternSummary,
          proposedChange: s.proposedChange,
          rootCause: s.rootCause,
          suggestedPrompt: s.suggestedPrompt,
        })),
      });
    } catch (error) {
      return err(AppError.externalProvider("Failed to consolidate prompt suggestions", error instanceof Error ? error.message : error));
    }

    const created = await this.repo.createFromMerge({
      clinicId: candidates[0].clinicId,
      patternSummary: `איחוד ${candidates.length} הצעות תיקון פתוחות`,
      proposedChange: result.summary,
      suggestedPrompt: result.mergedPrompt,
      supportingCallReviewIds: [...new Set(candidates.flatMap((s) => s.supportingCallReviewIds))],
      mergedFromIds: candidates.map((s) => s.id),
    });
    if (!created.ok) return created;

    // Best-effort: the new suggestion already exists and is what matters to
    // the caller: if marking the originals 'merged' fails, surface the new
    // suggestion anyway rather than erroring out a successful creation — a
    // stray still-pending original is a cosmetic annoyance (visible in the
    // list once more), not a correctness or data-loss problem, and the
    // admin can reject it manually.
    await this.repo.markMerged(candidates.map((s) => s.id));

    return created;
  }
}
```

**`getDefaultConsolidationProvider()`** (helper בקובץ ה-service או ב-provider module) — בוחר stub/real לפי `isOpenAiConfigured()`, באותו דפוס בדיוק כמו `generateVisitSummaryDraft`.

### `factory.ts`

```typescript
promptSuggestion: new PromptSuggestionService(promptSuggestionRepository),
```
נשאר ללא שינוי — ה-consolidation provider לא מוזרק דרך ה-factory (הוא default-נבחר בתוך השירות עצמו, כמו visit-summary), כך שלא צריך לשנות את חתימת הבנייה כאן.

### API route חדש

`app/app/api/prompt-suggestions/consolidate/route.ts`:

```typescript
export async function POST() {
  const requestId = createRequestId();
  try {
    const services = await createServices();
    await requireProviderAdmin(services.auth);
    const result = await services.promptSuggestion.consolidatePending();
    if (!result.ok) return handleRouteError(result.error, requestId);
    return jsonSuccess(result.value, 200, requestId);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
```

### UI (`app/app/dashboard/improvements/page-client.tsx`)

- כפתור "אחד הכל" (`Btn variant="secondary"` או מקביל) בראש העמוד, ליד הכותרת — `disabled`/מוסתר אם `items.filter(s => s.category === "prompt").length < 2`.
- לחיצה → `POST /api/prompt-suggestions/consolidate`, `busy` state נפרד (לא אותו `busyId` של אישור/דחייה בודדים), toast על הצלחה/כישלון (**כולל `catch` על שגיאת רשת/JSON**, כמו שכבר תוקן ב-`act()` — לא חוזרים לבאג הישן), רענון הרשימה (`fetchData()`) בהצלחה.
- ההצעה המאוחדת מוצגת בדיוק כמו כל הצעה אחרת — אין UI ייעודי נוסף (אין תג "מאוחד" מיוחד ב-MVP הזה; `patternSummary` שלה ("איחוד N הצעות תיקון פתוחות") כבר מתאר את זה).

### טיפול בשגיאות — סיכום

| שלב שנכשל | תוצאה |
|---|---|
| פחות מ-2 הצעות `prompt` pending | 409, שום דבר לא נוצר |
| `getLiveAgentConfig()` נכשל | 502, שום דבר לא נוצר |
| קריאת ה-LLM נכשלת/מחזירה פלט לא תקין (תגית חסרה) | 502, שום דבר לא נוצר, ההצעות המקוריות נשארות `pending` ללא שינוי |
| יצירת השורה החדשה (`createFromMerge`) נכשלת | השגיאה מוחזרת, ההצעות המקוריות נשארות `pending` |
| יצירת השורה הצליחה אבל `markMerged` נכשל | ההצעה המאוחדת החדשה **כן** נוצרת ומוחזרת בהצלחה (200); ההצעות המקוריות עלולות להישאר `pending` (best-effort, לא חוסם) — יופיעו כפולות ברשימה עד שינוהלו ידנית |

### טסטים חדשים

- `app/tests/unit/prompt-suggestion.service-consolidate.test.ts` (או תוספת לקובץ הקיים): `consolidatePending()` — פחות מ-2 מועמדים → conflict; זרימה מוצלחת → `createFromMerge` נקרא עם הפרמטרים הנכונים (כולל union נכון של `supportingCallReviewIds`), `markMerged` נקרא עם כל ה-IDs; כישלון LLM → externalProvider, `createFromMerge` לא נקרא; כישלון `markMerged` אחרי הצלחה → עדיין מחזיר `ok` עם ההצעה החדשה.
- טסט ל-`app/lib/ai/prompt-consolidation/provider.ts` (stub בלבד — אין קריאות רשת אמיתיות ב-unit tests, כמו ב-`visit-summary`).
- `app/tests/unit/prompt-suggestions-consolidate-route.test.ts` — 401/403/200/409 (אותו דפוס `vi.hoisted` + מוקים כמו שאר ה-routes tests).
- `app/tests/unit/prompt-suggestion.repository-race-guard.test.ts` — טסטים ל-`createFromMerge` ו-`markMerged`.

---

## סדר ביצוע מומלץ (לתוכנית הביצוע)

1. חלק A (מיזוג ניווט) — עצמאי, לא תלוי בחלק B, סיכון נמוך יותר.
2. חלק B (איחוד) — בנוי על גבי `/dashboard/improvements` שכבר קיים אחרי חלק A.

זה מאפשר לבדוק את חלק A בפרודקשן (deploy ביניים) לפני שמתחילים את חלק B, אם רוצים — לא חובה, אבל אפשרי בזכות ההפרדה.
