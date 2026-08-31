# שלב 2: לולאת הצעות מודעת-Knowledge-Base — Design Spec

> חלק מ-`docs/superpowers/plans/2026-08-30-tomer-qa-kb-provider-admin-roadmap.md` (שלב 2). נכתב ב-brainstorming, אושר.

## רקע ומצב קיים

`qaAnalyzer.ts` כבר מתייג כל בעיה שהוא מזהה בשיחה עם `category`/`target_file`/`root_cause`/`proposed_change`, נשמר כ-jsonb ב-`call_reviews.problems`. `analyzeConversations.ts` (ה-job השבועי) עדיין לא קורא את השדה הזה — הוא קורא `evaluation_criteria_results`/`flagged_reasons` (השדות של ElevenLabs-native evaluation מ-`logConversation.ts`), מצרף הכל יחד, ומייצר **הצעה אחת** ל-`prompt_suggestions` לכל הרצה, תמיד עם `suggested_prompt` מלא.

`PromptSuggestionService.approve()` כבר מריץ regression tests אמיתיים מול ElevenLabs ומפרסם אוטומטית כל הצעה שעברה — ללא תלות בסוג התיקון. אין כרגע UI צרכן (`/api/prompt-suggestions/*` קיים אבל שום דבר בדשבורד לא קורא לו).

**ממצא נוסף שהתגלה בזמן ה-brainstorming:** `app/lib/learning/elevenlabsTesting.ts`'s `publishPrompt()` שולח `PATCH conversation_config.agent.prompt = { prompt: newPromptText }` בלי `tools`/`knowledge_base`/`rag` — אותה בעיית סמנטיקת-merge-לא-מתועדת שתוקנה בשלב 1 בסקריפטי ה-Node (`agent/scripts/sync-elevenlabs-agent.ts`, `sync-elevenlabs-knowledge-base.ts`). כרגע זה "רדום" כי אין UI שקורא ל-`approve()`, אבל שלב 2 מפעיל את הנתיב הזה בפועל לראשונה — אישור הצעת `category='prompt'` הראשונה היה מוחק בשקט את ה-KB וכלי המערכת שהוקמו בשלב 1. **בסקופ של שלב הזה.**

## מטרה

להפוך את `analyzeConversations.ts` לקורא את `problems[]` העשיר (לא את שדות ה-ElevenLabs הישנים), לקבץ בעיות לפי `(category, target_file)`, ולייצר הצעת-תיקון נפרדת לכל קבוצה שעוברת סף מינימלי — עם `suggested_prompt` מלא רק כשמדובר בקטגוריית `prompt`. לגייט את `approve()` כך שרק הצעות `category='prompt'` עוברות regression+publish; כל השאר עוברות ישר ל-`status:'approved'`. לתקן את `publishPrompt()` לפני שהנתיב הזה נהיה בר-הפעלה בפועל.

## מיגרציה

קובץ חדש `supabase/migrations/<timestamp>_prompt_suggestions_categories.sql`:

```sql
alter table public.prompt_suggestions add column category text not null default 'prompt'
  check (category in ('prompt','knowledge_base','tool','backend_logic','conversation_flow'));
alter table public.prompt_suggestions add column target_file text;
alter table public.prompt_suggestions add column root_cause text;
alter table public.prompt_suggestions add column proposed_change text;
alter table public.prompt_suggestions alter column suggested_prompt drop not null;

comment on column public.prompt_suggestions.category is
  'What kind of fix this is — only "prompt" suggestions get auto-published via ElevenLabs regression+publish; everything else is marked approved for manual follow-through.';
```

`no_change` **אינו** בין הערכים המותרים ב-`category` — בעיות עם הקטגוריה הזו מסוננות החוצה לפני האגרגציה (ראו למטה), אף פעם לא נכתבות ל-`prompt_suggestions.category`.

## קיבוץ ואגרגציה (`agent/src/lib/learning/analyzeConversations.ts`)

### שאילתת המקור

```sql
select id, problems, transcript_summary
from call_reviews
where clinic_id = $1 and is_exception = true and created_at >= $2  -- 7 ימים אחרונים
```

`problems` הוא `QaProblem[]` (מוגדר כבר ב-`qaAnalyzer.ts`):
```ts
type QaProblem = {
  moment?: string;
  problem: string;
  root_cause?: string;
  category?: string;
  priority?: string;
  target_file?: string;
  proposed_change?: string;
};
```

### שיטוח + סינון

לכל `call_reviews` row, לכל `problem` ב-`problems[]`:
- **דלג** אם `category` חסר, ריק, או `'no_change'`, או לא אחד מ-5 הערכים המותרים (`prompt`/`knowledge_base`/`tool`/`backend_logic`/`conversation_flow`) — לא ניתן לפעולה שיטתית, לא נכנס לשום קבוצה.
- אחרת: הוסף ל-flat list עם `reviewId` מצורף (ל-`supporting_call_review_ids`).

### קיבוץ

מפתח קיבוץ: `` `${category}::${target_file ?? ''}` ``. לכל קבוצה עם **פחות מ-2** בעיות — דלג (סף מינימום, זהה לסף הגלובלי הקיים היום, אבל עכשיו per-group).

### קריאת Claude לכל קבוצה

פרומפט-מערכת חדש, מודע-קטגוריה:

```
אתה עוזר שמנתח דפוס חוזר של בעיות מסוג "{category}" בקוד/פרומפט/תוכן של תומר,
סוכן קולי וטרינרי בעברית. קיבלת {N} מקרים מתועדים עם אותו category ואותו target_file
("{target_file}"). זהה את הדפוס המשותף והצע תיקון קונקרטי.

אם category=="prompt": הצע גם נוסח מלא ומתוקן לפרומפט המערכת (suggested_prompt).
אחרת: השאר suggested_prompt כ-null — רק pattern_summary + proposed_change.

החזר אך ורק JSON: {"pattern_summary": "...", "proposed_change": "...",
"suggested_prompt": "..." | null}
```

Input: רשימת `{problem, root_cause, moment, call_summary}` מכל הבעיות בקבוצה.

### כתיבה

לכל קבוצה שעברה את הסף — `insert` שורה נפרדת:
```ts
{
  clinic_id: clinicId,
  status: "pending",
  category: group.category,
  target_file: group.targetFile || null,
  pattern_summary: claudeResult.pattern_summary,
  proposed_change: claudeResult.proposed_change,
  root_cause: mergedRootCause,          // concatenation of unique root_cause values in the group, capped length
  suggested_prompt: claudeResult.suggested_prompt,  // null unless category === 'prompt'
  supporting_call_review_ids: group.reviewIds,
}
```

**התנהגות משתנה מכוונת:** הרצה אחת של ה-job יכולה עכשיו לייצר **מספר שורות** ב-`prompt_suggestions` (אחת לכל קבוצה שעברה את הסף), במקום שורה אחת מצרפת כמו היום.

`AnalyzeConversationsResult` (טיפוס החזרה) מתעדכן:
```ts
export type AnalyzeConversationsResult = {
  ranAnalysis: boolean;
  flaggedCallCount: number;
  groupsConsidered: number;
  suggestionIds: string[];   // was: suggestionId?: string
};
```

## גייטינג ב-`PromptSuggestionService.approve()`

```ts
async approve(actor: ServiceActor, id: string): Promise<Result<PromptSuggestion>> {
  // ...existing lookup + permission + status checks unchanged...

  if (suggestion.category !== "prompt") {
    // No suggested_prompt to regression-test or publish — mark approved,
    // the fix (KB doc edit, tool change, backend patch) happens manually
    // outside this pipeline. `approved` blocks re-approval via the
    // existing `.eq("status", "pending")` repository guard.
    return this.repo.markApproved(id, actor.userId);
  }

  // ...existing regression + publish flow, unchanged, for category === 'prompt'...
}
```

`PromptSuggestionRepository` מקבל מתודה חדשה `markApproved(id, reviewedByUserId)` — אותו דפוס בדיוק כמו `markRejected` (guard על `status='pending'`, מעדכן `status`/`reviewed_by_user_id`/`reviewed_at`).

## תיקון `publishPrompt()` (`app/lib/learning/elevenlabsTesting.ts`)

אותו דפוס fetch-then-merge כמו בשני הסקריפטים בשלב 1:

```ts
export async function publishPrompt(newPromptText: string): Promise<Record<string, unknown>> {
  const { apiKey, agentId } = getConfig();
  const client = getClient(apiKey);

  const current = await client.conversationalAi.getAgent(agentId);
  const currentPrompt = (current.conversation_config as Record<string, unknown> | undefined)
    ?.agent as Record<string, unknown> | undefined;
  const promptBlock = (currentPrompt?.prompt as Record<string, unknown> | undefined) ?? {};

  const updated = await client.conversationalAi.updateAgent(agentId, {
    conversation_config: {
      agent: {
        prompt: {
          prompt: newPromptText,
          tools: promptBlock.tools,
          knowledge_base: promptBlock.knowledge_base,
          rag: promptBlock.rag,
        },
      },
    },
  });
  return updated as unknown as Record<string, unknown>;
}
```

`getLiveAgentConfig()` נשאר ללא שינוי (כבר עושה GET מלא — `previous_prompt` snapshot ב-`markPublished` כבר תופס את המצב לפני הפרסום, כולל `knowledge_base`/`rag`, בלי צורך בשינוי).

`runRegressionTests()` **לא** משתנה בשלב הזה — היקף מוגדר: הוא כבר משתמש ב-`agent_config_override` שהוא זמני ולא נשמר, כך שאין סיכון דריסה. (אפשרות לשפר את איכות תוצאות הרגרסיה על ידי הזרקת ה-KB הקיים גם ל-override — **נדחה במפורש**, לא בסקופ.)

## טיפול בשגיאות

- `analyzeConversations`: כשל בקריאת Claude לקבוצה אחת (למשל timeout) לא אמור לעצור קבוצות אחרות — `try/catch` סביב כל קבוצה, לוג שגיאה, המשך לקבוצה הבאה. הפונקציה עדיין throw-ת רק אם השאילתה הראשונית ל-`call_reviews` נכשלת (כמו היום).
- `publishPrompt`: אם ה-GET הראשוני נכשל — throw לפני כל PATCH (לא לנסות לפרסם עם קונפיג חלקי/לא ידוע).

## טסטים

- `agent/tests/unit/learning/analyzeConversations.test.ts` — עדכון מלא: מוקים ל-`problems[]` שונים (כמה קטגוריות, כמה target_file, `no_change` מעורב, סף לא-עובר), מוודא מספר שורות `insert` נכון, `suggested_prompt` null מחוץ ל-`prompt`.
- `app/tests/unit/prompt-suggestion.service.test.ts` — עדכון: טסט חדש ל-`approve()` על הצעה עם `category='knowledge_base'` → קורא ל-`markApproved`, **לא** ל-`runRegressionTests`/`publishPrompt`.
- `app/tests/unit/elevenlabs-testing.test.ts` (**חדש**) — מוקה ל-`global.fetch`/`ElevenLabsClient`, מוודא שה-PATCH payload כולל `tools`/`knowledge_base`/`rag` שנשלפו מה-GET הקודם.
- טסט שמוכיח במפורש: הצעה עם `category` בכל ערך מלבד `'prompt'` אף פעם לא קוראת ל-`runRegressionTests`/`publishPrompt` (מפורש ב-roadmap כדרישת אימות).

## קבצים

| קובץ | פעולה |
|---|---|
| `supabase/migrations/<ts>_prompt_suggestions_categories.sql` | חדש |
| `agent/src/lib/learning/analyzeConversations.ts` | שכתוב |
| `agent/tests/unit/learning/analyzeConversations.test.ts` | עדכון |
| `app/types/domain/prompt-suggestion.ts` | שדות חדשים (`category`/`targetFile`/`rootCause`/`proposedChange`); `suggestedPrompt` → `string \| null` (נשאר מחייב שדה בטיפוס, לא הופך ל-optional — `pattern_summary`/`proposed_change` נשארים חובה כי Claude תמיד מחזיר אותם, לא רק ב-`prompt`) |
| `app/lib/repositories/prompt-suggestion.repository.ts` | מיפוי שדות חדשים + `markApproved()` |
| `app/lib/services/prompt-suggestion.service.ts` | גייטינג ב-`approve()` |
| `app/tests/unit/prompt-suggestion.service.test.ts` | עדכון |
| `app/lib/learning/elevenlabsTesting.ts` | תיקון `publishPrompt()` |
| `app/tests/unit/elevenlabs-testing.test.ts` | חדש |

## מפורש מחוץ לסקופ

- UI לצפייה/אישור/דחייה של ההצעות המקוטלגות (שלב 3).
- הזרקת KB ל-regression tests (`runRegressionTests`'s `agent_config_override`).
- clustering סמנטי בין שיחות מעבר לקיבוץ `(category, target_file)` המדויק (כבר נדחה במפורש ב-roadmap הראשי).
- שינוי בתזמון ה-cron או ב-`/jobs/analyze-conversations` route עצמו — ללא שינוי.

## אימות

1. טסטים ירוקים (agent + app).
2. הרצה ידנית אחת מול `call_reviews` אמיתיים בענן (יש כבר כמה שורות עם `is_exception=true` ו-`problems` אמיתיים משלב 1) — לוודא שנוצרות שורות `prompt_suggestions` הגיוניות.
3. קריאה ידנית של ההצעות שנוצרו.
