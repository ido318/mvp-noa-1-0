# תומר: QA / Knowledge Base / Provider Admin — תוכנית עבודה מרוכזת

> **מסמך זה הוא נקודת הכניסה היחידה להמשך העבודה על היוזמה הזו.** נכתב ב-Plan Mode, עבר סקירה מול המסמכים הקודמים, ואושר. לפני שמתחילים לבצע — ראו "איך להתחיל" בסוף המסמך.

## רקע ומצב קיים

**מה כבר קיים ומוגדר (לא לשכתב):**
- `docs/superpowers/specs/2026-08-29-provider-admin-qa-phase1-2-design.md` — ה-spec המקורי של ה-QA analyzer (Phase 1+2). מומש במלואו; יש שם הערת תיקון post-implementation לגבי מעבר מ-`.upsert()` ל-`.update()`.
- `docs/superpowers/plans/2026-08-29-qa-analyzer-phase1-2.md` — תוכנית המימוש task-by-task של אותו spec. **הושלמה במלואה (✅), 7/7 משימות**, כולל deploy ואימות בשיחת בדיקה אמיתית. אין בה תוכן קדימה — נשמרת רק כתיעוד היסטורי.

**מה זה אומר בפועל:** על branch `feat/qa-analyzer-phase1-2` (worktree ב-`.worktrees/qa-analyzer`) יש QA analyzer שלם ופרוס ל-production: כל שיחה מקבלת ציון 0-10 ב-6 מימדים (אמפתיה, טבעיות, דיוק, עמידה בנוהל, בטיחות, פתרון) דרך Claude, עם ספי חריגה דטרמיניסטיים, נכתב ל-`call_reviews`. **ה-branch הזה עדיין לא מוזג ל-`main`** — זה השלב הראשון (שלב 0) בתוכנית הזו.

תוך כדי אימות העבודה הזו עלה היעד הרחב יותר: **דשבורד Provider Admin** (רק לאדמין, נפרד מ-`/dashboard` של צוות המרפאה) שמציג שיחות/תמלולים/ציוני QA והצעות תיקון לאישור — ועוד החלטה ארכיטקטונית: לשמור על פרומפט המערכת של תומר ב-ElevenLabs **בסיסי** (זהות/טון/בטיחות בלבד), ולהעביר את כל תוכן המדיניות/הניסוח/המחירים ל-**Knowledge Base**, כדי שתיקונים עתידיים יהיו עדכוני KB ממוקדים במקום שכתוב פרומפט מלא.

בדיקת הפרומפט החי לצורך תכנון המיגרציה הזו חשפה בעיה נפרדת ואמיתית: **הפרומפט החי ב-ElevenLabs (6,433 תווים, נערך ידנית בדשבורד של ElevenLabs ב-28.8.2026, לא דרך ה-repo) סטה וגרוע מהקובץ המתועד ב-repo** (`agent/src/knowledge/tomer-system-prompt.md`, 13,598 תווים) — חסרות בו הנחיות ל-5 מתוך 9 כלים, יש בו סתירה לתיקון באג ששוחרר, חסרים כללי פנייה ניטרלית-מגדרית, ויש בו עובדה מומצאת ("ד״ר שחר"). יש בו כן תוספת שווה-שימור (פרוטוקול שקט/חוסר-תגובה) ופריט מידע אמיתי (קישור לחנות `getavettstore.com` — מידעי בלבד, ללא תפקיד ניהולי לתומר כרגע).

התוכנית הזו נבנתה ע"י 3 סוכני Explore + סוכן Plan אחד, ואומתה ישירות (`git diff`, קריאת שני טקסטי הפרומפט המלאים, קריאת `prompt-suggestion.service.ts` בפועל) מול המצב האמיתי ב-repo — לא מהנחות.

## שלב 0 — מיזוג `feat/qa-analyzer-phase1-2` ל-`main`

כל מה שבהמשך תלוי בזה שזה יהיה על `main` (שלב 2 כותב מחדש את `analyzeConversations.ts`, שקיים בגרסת ה-`is_exception` שלו רק על ה-branch הזה). סיכון אפסי — כבר נבדק (284 טסטים ב-agent) ורץ ב-production.

**מאומת:** `git diff --name-only feat/qa-analyzer-phase1-2...main` מול הכיוון ההפוך מראה **חפיפה אפסית בקבצים** — `git merge feat/qa-analyzer-phase1-2` מ-`main` ימוזג נקי אוטומטית. ל-`main` יש כרגע שינויים לא-committed (`agent/src/server/routes/jobs.ts` + הטסט שלו, `app/.env.example`, `app/lib/env.ts`, `app/app/api/health/route.ts`, `app/next-env.d.ts`, `app/tests/unit/health-route.test.ts`) — **אסור לגעת, לעשות stash, או לקמט את ה-WIP הזה**; ייתכן שהוא שייך לסשן אחר שפעיל במקביל (יש כמה סשנים פתוחים על ה-repo הזה). חפיפה אפסית בקבצים אומרת ש-`git merge` לא דורש working tree נקי — יתקדם סביב הקבצים המלוכלכים בלי לגעת בהם.

צעדים:
1. מ-repo root על `main`: `git merge feat/qa-analyzer-phase1-2`.
2. `npm run typecheck:all && npm run test:all`.
3. `supabase db push --linked` — צפוי "already applied"; אם ינסה להחיל משהו חדש — **לעצור ולבדוק** (סוג הבאג שכבר תועד פעם ב-CLAUDE.md).
4. `flyctl deploy --app voxly-agent`.
5. `curl https://voxly-agent.fly.dev/health`, ולוודא ששורת שיחת הבדיקה הקודמת ב-`call_reviews` עדיין מציגה `qa_analyzed_at` מלא.
6. לשאול לפני דחיפה של ~37 קומיטים ל-`origin/main`.

## שלב 1 — הרזיית הפרומפט, העברת תוכן ל-Knowledge Base

**1א. סינתוז פרומפט חדש אחד** (`agent/src/knowledge/tomer-system-prompt.md`), מבוסס על הקובץ המקומי (הבשל, המוקשח מבאגים):
- לשמור: כל "כללי הברזל", כללי שפה עברית + פנייה ניטרלית-מגדרית, מפת שימוש מלאה ב-9 הכלים, כללי דיוק ב-timezone/`scheduled_at`, תהליך תיקון סוג ביקור דרך reschedule, כלל "אל תכריז, פשוט תשתוק ותקרא לכלי".
- להוסיף מהחי: פרוטוקול שקט/חוסר-תגובה (2 ניסיונות + הגנת "איתי").
- להחריג: "ד״ר שחר" המומצא, והנחיית מילות מילוי לפני קריאה לכלי (סותרת תיקון קיים).
- להעביר ל-KB: כתובת, שעות, וואטסאפ/מייל, אזורי שירות, טבלת מחירים, מדיניות ביטול, חלון קביעה.
- להוסיף שורה: הנחיה מפורשת להתייעץ עם ה-KB לכל שאלת מדיניות/מחיר ולעולם לא להמציא.

**1ב. מסמכי KB** (חדש, `agent/src/knowledge/kb/*.md`), על בסיס `agent/src/knowledge/business_info.json` (כרגע לא בשימוש, טיוטה נקייה):
1. `clinic_info.md` — כתובת/שעות/יצירת קשר/אזור שירות/חיות מטופלות
2. `pricing_and_visits.md` — תפריט מחירים + סוגי ביקור/משך + חלון קביעה 14 יום
3. `policies.md` — מדיניות ביטול/איחור + קריטריוני `escalate-to-noa`
4. `store_and_products.md` — פסקת חנות/וואטסאפ, מידעי בלבד

**1ג. כלי העלאה ל-KB** — חדש, `agent/scripts/sync-elevenlabs-knowledge-base.ts`, באותה צורה כמו `sync-elevenlabs-agent.ts` הקיים (`--dry-run`). אין תקדים בקוד — לאמת מחדש את ה-API של ElevenLabs בזמן המימוש (מחקר ראשוני: `GET/POST /v1/convai/knowledge-base(/text)`, אין עדכון-במקום — עריכה = יצירת-חדש + מחיקת-ישן + הצבעה מחדש).

**1ד. מצב חיבור — אושר:** `usage_mode: "prompt"` (דטרמיניסטי, מוזרק תמיד), `rag.enabled: false`. קורפוס קטן; צפיות עדיפה על גמישות retrieval לבוט רגיש-בטיחות.

**1ה. פריסה + אימות:** dry-run קודם (לקרוא לפני סנכרון — תוכן פונה-ללקוח, רגיש רפואית). שיחות בדיקה: קביעת תור, רמז טריאז', שאלה לאסקלציה, תרחיש שקט, שאלת מחיר/מדיניות (מ-KB), שאלה בלי תשובה ב-KB (לוודא אין המצאה). אחרי שלב 0, כל שיחת בדיקה מקבלת ניקוד QA אוטומטית.

## שלב 2 — הפיכת לולאת הצעות השיפור למודעת-Knowledge-Base

**תיקון היקף (מאומת):** `qaAnalyzer.ts` כבר מתייג כל בעיה ב-`category`/`target_file`/`root_cause`/`proposed_change`, נשמר ב-`call_reviews.problems`. השלב הזה הוא בעיקר **המצרף השבועי שמדביק פערים**, לא בניית טקסונומיה חדשה. גם מאומת: `PromptSuggestionService.approve()` **כבר** מריץ טסטי רגרסיה של ElevenLabs ומפרסם אוטומטית הצעות להחלפת-פרומפט — צריך *לשער* את זה נכון ל-`category === 'prompt'` בלבד, לא לבנות auto-apply מאפס.

**מיגרציה** על `prompt_suggestions`:
```sql
alter table public.prompt_suggestions add column category text not null default 'prompt'
  check (category in ('prompt','knowledge_base','tool','backend_logic','conversation_flow'));
alter table public.prompt_suggestions add column target_file text;
alter table public.prompt_suggestions add column root_cause text;
alter table public.prompt_suggestions add column proposed_change text;
alter table public.prompt_suggestions alter column suggested_prompt drop not null;
```

**כתיבה מחדש** של `agent/src/lib/learning/analyzeConversations.ts`: לקרוא `problems` (jsonb) מ-`is_exception=true` רגע במקום `evaluation_criteria_results`/`flagged_reasons`; לקבץ לפי `(category, target_file)`; סף מינימום-הופעות לכל קבוצה; קריאת Claude אחת לכל קבוצה מאחדת ל-`pattern_summary`+`proposed_change` (`suggested_prompt` מלא רק ב-`category==='prompt'`). גבול היקף: קיבוץ category+target_file בלבד, לא clustering סמנטי (עתידי).

**עדכון** `app/lib/services/prompt-suggestion.service.ts`: `approve()` מריץ רגרסיה+פרסום רק ב-`category==='prompt'`; אחרת עובר ל-`status:'approved'` ועוצר.

**קבצים:** מיגרציה חדשה; `agent/src/lib/learning/analyzeConversations.ts` + טסט; `app/types/domain/prompt-suggestion.ts`, `app/lib/repositories/prompt-suggestion.repository.ts`, `app/lib/services/prompt-suggestion.service.ts` + טסטים.

**אימות:** טסטים לקיבוץ מול `problems[]` מדומים שונים; טסט שמוכיח ש-KB/tool/backend אף פעם לא קורא לצינור הפרסום; הרצה ידנית אחת מול נתונים אמיתיים; קריאה ידנית של ההצעות הראשונות.

## שלב 3 — דשבורד Provider Admin

**הרשאה (אושר: `profiles.role`):** מיגרציה `alter table public.profiles add column role text not null default 'clinic_user' check (role in ('clinic_user','provider_admin'));`, ואז `update profiles set role='provider_admin' where id=<לאמת קודם>` ידני חד-פעמי. חדש `app/lib/api/provider-admin.ts` → `requireProviderAdmin()`, על `services.auth.getSessionUser()` — **לא** `getActorAndServices()` (זורק עבור לא-חבר-מרפאה, מאומת).

**נתיבים:** `/provider-admin` → `/provider-admin/calls`; `/provider-admin/calls` (חריגות ראשונות, פילטר חומרה); `/provider-admin/calls/[id]` (פרטים/ציוני QA/בעיות/הצעה מקושרת); `/provider-admin/improvements` (תיבת `prompt_suggestions`, אישור/דחייה, `category`/`target_file` משלב 2). `layout.tsx` וסיידבר משלו — לא של המרפאה. להוסיף `"/provider-admin/:path*"` ל-matcher של `app/proxy.ts`.

**backend חדש** (משקף את `PromptSuggestionRepository`): `app/lib/repositories/call-review.repository.ts`, `app/lib/services/call-review.service.ts`, `app/types/domain/call-review.ts`, `app/app/api/provider-admin/calls/*`.

**נתיבי `/api/prompt-suggestions/*`:** להחליף שער במקום (clinic-role → provider-admin) — אין UI צרכן כרגע, אין תאימות לשמר.

**היקף UI מינימלי:** רשימת שיחות+ציונים ופרטים, תיבת הצעות עם אישור/דחייה. לא אנליטיקה/צבירה.

**אימות:** טסטים ל-repository/service; כניסה כ-provider-admin מול משתמש מרפאה (חסימה + אי-נראות בתפריט); אישור/דחייה ידניים מול הצעה אמיתית.

## נדחה במפורש

- החלה אוטומטית של תיקון `knowledge_base/tool/backend_logic` בחזרה ל-ElevenLabs (דורש הרחבת סקריפט הסנכרון).
- versioning + rollback (`agent_versions`).
- סט eval cases רגרסיה מעבר לקיים.
- clustering סמנטי בין שיחות מעבר לקיבוץ category+target_file.
- מעורבות תומר במלאי/חיוב/משלוח של החנות.

## קבצים קריטיים

- `agent/src/lib/learning/analyzeConversations.ts`, `qaAnalyzer.ts`, `logConversation.ts`, `claudeJson.ts`
- `agent/src/knowledge/tomer-system-prompt.md`, `business_info.json`
- `agent/scripts/sync-elevenlabs-agent.ts`
- `app/lib/services/prompt-suggestion.service.ts`, `app/lib/repositories/prompt-suggestion.repository.ts`, `app/lib/learning/elevenlabsTesting.ts`
- `app/lib/api/actor.ts`, `app/proxy.ts`
- `app/app/dashboard/layout.tsx`, `app/components/dashboard/ui/*`
- `supabase/migrations/20260828000022_prompt_learning_loop.sql`, `20260829020637_call_reviews_qa_scores.sql`

## הערת תהליך

שלב 2 ושלב 3 צריכים כל אחד design spec קצר ב-`docs/superpowers/specs/` (דרך skill ה-brainstorming) לפני מימוש — התוכנית הזו קובעת כיוון וסדר; תוכנית המימוש בפועל של כל שלב נכתבת כשהשלב מתחיל, לפי מה שנכון על `main` באותו רגע.

## אימות מקצה-לקצה (כשכל השלבים ישוחררו)

1. חבילות הטסטים ירוקות (`npm run test:all`, `npm run typecheck:all`).
2. שיחה אמיתית קובעת תור, מטפלת בטריאז', עונה נכון על מחיר — מקור מהפרומפט הרזה + KB.
3. השיחה מופיעה ב-`call_reviews` עם ציוני QA תוך ~30 שניות.
4. הרצת job שבועי על שיחה שגויה מייצרת `prompt_suggestions` עם `category`/`target_file` אמיתיים.
5. כניסה כ-provider-admin מציגה הכל ב-`/provider-admin/*`; משתמש מרפאה לא מגיע לשם.

---

## איך להתחיל (עבור סשן חדש)

ראו את הודעת הפתיחה המוצעת בסוף השיחה שיצרה מסמך זה — מיועדת להדבקה בסשן Claude Code חדש כדי להתחיל את שלב 0.
