# דוח אבחון מקיף — Tomer (mvp-noa-1-0)

**תאריך:** 2026-09-02
**מבוצע על:** `main` @ `d21e4c7` (ראה הערה קריטית בסעיף 1 לגבי יציבות המצב בזמן הסריקה)
**שיטה:** סריקה סטטית + הרצת טסטים בפועל, ללא כל שינוי בקוד. בוצעה ע"י 6 סוכני-משנה מקבילים (מבנה תיקיות/כפילויות, ארכיטקטורה/איכות קוד, באגים/לוגיקה/טסטים, UI/UX, תלויות/קונפיגורציה/סודות, וסריקת ה-branch `pims-gap-closure`) + ריכוז ואימות ע"י הסשן המתאם.

---

## 1. תמונת מצב כללית

### 1.א — ממצא-על: הריפו השתנה *בזמן אמת* תוך כדי הסריקה עצמה

זה החשוב מכל הממצאים, כי הוא מסביר את מקור ה"בלגן" יותר מכל דבר בקוד:

- כשהתחלתי (שלב 0), הייתי על branch `chore/clinic-reset-and-users` (main+1 קומיט), ו-`main` היה ב-`b9cd0a2`. היה worktree נפרד ב-`.worktrees/pims-gap-closure` עם branch `pims-gap-closure` ו-19 קומיטים לא-pushed.
- **תוך כדי הרצת סוכני הסריקה** (כמה דקות בלבד), מישהו/משהו אחר (כנראה session מקביל — תואם בדיוק לזיכרון הקיים על "PIMS parallel initiative" ו-"Graphite Pro concurrent session"):
  1. מיזג את `pims-gap-closure` לתוך `main` (קומיט `34a525c`).
  2. הוסיף עוד 4 קומיטים ישירות על main.
  3. **מחק את ה-worktree** `.worktrees/pims-gap-closure` לגמרי.
  4. **החליף את ה-branch המקוצ'ק-אאוט בתיקיית העבודה הראשית** מ-`chore/clinic-reset-and-users` ל-`main` (!) — ומאז main מקומי הוא קומיט אחד לפני origin/main (`d21e4c7`, קומיט תיעוד).
  5. השאיר קובץ חדש לא-tracked: `docs/superpowers/plans/2026-09-01-provider-admin-dashboard.md`.

**המשמעות:** יש כרגע **יותר מגורם אחד שעובד על אותה תיקיית עבודה בו-זמנית**, כולל מעבר branch בתיקייה הראשית בלי תיאום. זה בדיוק הדפוס שיוצר "בלגן" — לא (רק) קוד רשלני, אלא היעדר נוהל תיאום בין sessions/branches/worktrees שעובדים על אותו repo. זה חוזר על עצמו: התקרית מ-2026-08-25 (voice_url), התנגשות טבלת `prompt_suggestions` (PIMS), וה"Graphite Pro concurrent session" — כולן מאותה משפחת בעיה.

**המלצה מיידית, לפני כל דבר אחר בדוח הזה:** לקבוע כלל עבודה ברור — session אחד/worktree אחד בכל רגע נתון על התיקייה הראשית, ושימוש עקבי ב-`git worktree` לכל עבודה מקבילה (לא לגעת ב-checkout הראשי מבלי לוודא שאין session פעיל אחר). זו בעיית תהליך, לא בעיית קוד, ואי אפשר "לתקן" אותה בקומיט.

### 1.ב — מצב ה-branches (נכון להשוואה מול `main` הנוכחי, `d21e4c7`)

| Branch | מצב מול main | תוכן בפועל |
|---|---|---|
| `chore/clinic-reset-and-users` | +1 (לא ממוזג) | סקריפט איפוס נתוני מרפאה + הקמת משתמשים (`e92ac38`) — **יש בעיית בטיחות אמיתית, ראה M13** |
| `feat/hebrew-triage-labels` | +1 (אך diff מול main = ריק) | כבר ממוזג בפועל ל-main (סקוואש), רק ה-branch עצמו לא נמחק. ✅ בטוח למחוק |
| `codex/batch-1-4-checkpoint` | +0 | ענף מת — הכל כבר ב-main. ✅ בטוח למחוק |
| `codex/batch-5-live-calls` | +0 | ענף מת — הכל כבר ב-main. ✅ בטוח למחוק |
| `fix/hardening-validation-security` | +0 | ענף מת — הכל כבר ב-main. ✅ בטוח למחוק |
| `design-system-graphite-pro` | +5 (אך 4 מהם content-כפול עם מה שכבר ב-main בסקוואש) | **קומיט אחד אמיתי ולא-ממוזג:** `363d7dd refactor(voice): retire the superseded call list, redesign the call detail` |
| `pims-gap-closure` (origin) | +0 | ✅ מוזג במלואו ל-main (`34a525c`). ה-worktree המקומי (עם 19 קומיטים נוספים שלא היו ב-origin) כבר לא קיים — הם נכנסו ל-main ישירות מה-worktree בלי push ל-origin קודם. |

**מסקנה:** אחרי המיזוג שקרה תוך כדי הסריקה, נשארו רק **שני branches אמיתיים שדורשים החלטה**: `chore/clinic-reset-and-users` (סקריפט) ו-`design-system-graphite-pro` (קומיט redesign יחיד לרשימת שיחות). כל השאר הם ענפים מתים שרק צריך לנקות.

### 1.ג — מקור הבלגן בקבצים (לא ב-branches)

בניגוד לחשש הראשוני, **אין כפילויות-תיקיות דרמטיות בקוד החי עצמו** (למשל אין `app-v2/` או `agent-old/`). הבלגן בפועל הוא מסוג אחר:
1. **שאריות מנקיון חלקי בעבר** — קובץ טריאז' ראשוני נטוש, JSON ידע יתום, מודולי DTMF יתומים עם טסטים שלא הועברו לארכיון יחד עם הקוד עצמו, טבלת DB "רפאים" (`prompt_suggestions`) שמיגרציה ישנה עדיין יוצרת.
2. **שני עותקים לא-זהים** של מסמך design-handoff (`design_handoff_voxly_vet/` מול `docs/design/dashboard/`).
3. **מיגרציה חלקית לעיצוב** (Graphite Pro) — רוב המסכים עברו במלואם, אבל אזור ה-visits/SOAP (שהתפתח מאוחר יותר, ב-`pims-gap-closure`) לא קיבל את אותה רמת גימור: אנגלית בזרימה עברית, placeholder במקום label, ו-`ExamForm` שהוא בכלל mock סטטי.
4. **קונפליקט "בלתי-נראה" של קוד:** תבנית SMS תזכורת חיסון מוגדרת פעמיים (agent + app) ולא מסונכרנת, מה שיצר את הבאג הכי חמור בדוח הזה (C1).

---

## 2. ממצאים — טבלת חומרה

### קריטי

| # | ממצא | מיקום | השפעה בפועל |
|---|---|---|---|
| C1 | SMS תזכורת חיסון: הדשבורד שולח נוסח מאולתר לפני שה-cron היומי של ה-agent מספיק לשלוח את התבנית ה"קפואה" המאושרת — וה-`upsert(..., ignoreDuplicates:true)` של ה-cron משתיק לצמיתות את השורה הנכונה ברגע שהדשבורד כבר תפס אותה | `app/lib/services/dashboard-notifications.service.ts:219-237` מול `agent/src/lib/vaccinationReminders.ts:82-84` ו-`agent/src/services/sms.templates.ts` | לקוחות מקבלים ניסוח SMS **שלא אושר ע"י נועה**, בכל תזכורת חיסון שנרשמה דרך הדשבורד — הפרה ישירה של כלל מחייב מפורש ב-CLAUDE.md ("wording frozen — do not change") |
| C2 | `/tools/lookup-customer` לא מסנן חיות מחמד עם `deleted_at` — תומר "מקריא" בקול חיית מחמד שנמחקה/מוזגה, בכל שיחה נכנסת של לקוח קיים | `agent/src/lib/store.ts:71` (`findCustomerByPhone`) | הבאג **הזהה בדיוק** תוקן בפונקציה האחות `listCustomerPets` (קומיט `8451fdd`) — כולל הערה בקוד שמנוגדת במפורש בין שתי הפונקציות — אבל לא הועתק לכאן. חי היום ב-main, רץ בתחילת כמעט כל שיחה נכנסת |

### בינוני

| # | ממצא | מיקום | השפעה בפועל |
|---|---|---|---|
| M1 | Race ב-`createOrFindCustomer`/`createOrFindPet`: check-then-insert בלי טיפול ב-23505; ל-pet אין בכלל unique constraint | `store.ts:1126, 1146` | טלפון חדש שמתקשר פעמיים כמעט-בו-זמנית עלול לקבל "שגיאה פנימית", ול-pet יכולות להיווצר רשומות כפולות שקטות |
| M2 | עמוד `appointments/` שלם — אנגלית בלבד, Tailwind גולמי בלי טוקנים, בלי שום רכיב משותף, לא מקושר מהניווט אך נגיש דרך URL עם פעולת "soft delete" עצמאית | `app/app/dashboard/appointments/**` | מסך "רפאים" שיכול לבצע מוטציות אמיתיות (מחיקה רכה) דרך זרימה לא-מתוחזקת שאף אחד לא רואה בניווט |
| M3 | טפסי ביקור/SOAP באנגלית עם placeholder בלבד (בלי `<label>`), ו-`ExamForm` הוא **mock סטטי** שלא ניתן לשנות | `app/app/dashboard/visits/vitals-form.tsx`, `visit-notes-section.tsx`, `exam-form.tsx` | וטרינר/ית לא יכולים לתעד ממצא בדיקה חריג בכלל; שדות קליניים באנגלית בזרימה עברית מלאה |
| M4 | Drawer/Modal ידניים עוקפים את הרכיבים המשותפים — בלי `role="dialog"`, `CallDrawer` בלי `aria-label` לכפתור סגירה, `ResolveModal` בלי טיפול ב-Escape | `app/app/dashboard/calls/page.tsx` (CallDrawer), `escalations/page.tsx` (ResolveModal) | חוסר עקביות נגישות/UX מול שאר האפליקציה שמשתמשת נכון ב-`components/dashboard/ui/{modal,drawer}.tsx` |
| M5 | גרסאות תלות סותרות בפועל (לא מכוונות): `zod` 3 (agent) מול 4 (app) — שני עותקי npm שונים מותקנים בפועל; `twilio` 5 מול 6 עם שני מימושי אימות-חתימה עצמאיים | `agent/package.json`, `app/package.json` | סיכון drift שקט בין שתי מימושי לוגיקה קריטית (אימות webhook); הכפלת טביעת install |
| M6 | SDK מיושן (`elevenlabs@^1.59.0`, deprecated רשמית) עדיין בשימוש פעיל ב-app | `app/lib/learning/elevenlabsTesting.ts:1` | חוב טכני מתועד; הצד ב-agent שמייבא אותו (`twilio.ts`) הוא ממילא קוד מת בפרודקשן |
| M7 | `agent/tests/**` מוחרג לגמרי מ-`tsc --noEmit` וגם מ-`eslint` | `agent/tsconfig.json:21`, `agent/package.json:12` | שגיאות טיפוסים/lint בקבצי טסט לא ייתפסו עד שיגרמו לכשל ריצה בפועל — פער אמיתי מול `app/` שכן בודק |
| M8 | לוגיקת שעון ירושלים/DST ממומשת בנפרד ב-3+ מקומות; 3 מתוך 6 תבניות SMS "קפואות" מועתקות ידנית ל-app עם הערה "נשמר מסונכרן ידנית" | `agent/src/lib/notifications.ts`, `agent/src/services/triage.service.ts:36`, `app/lib/services/dashboard-notifications.service.ts` | פצצת-זמן ל-drift נוסף בדיוק כמו C1 — כל עוד יש שני מקורות, שינוי באחד בלי השני יחזור על עצמו |
| M9 | `store.ts` מייבא מ-`services/notification.processor.ts` — הפוך מכיוון השכבות המתועד (`routes → lib → services`) | `agent/src/lib/store.ts` | צימוד שברירי lib↔services; לא מעגל קשיח עדיין אך פותח פתח לאחד |
| M10 | חישוב מספר חשבונית ב-`count+1` מחוץ לנעילה | `app/lib/repositories/invoice.repository.ts` | קונפליקט בו-זמני נכשל ב-502 גנרי במקום 409/retry ידידותי כמו בכל מקום אחר במערכת |
| M11 | `cancelFutureNotifications` מטפל רק ב-`status='pending'`, מפספס שורות שכבר `processing` ע"י ה-cron המקביל | `agent/src/lib/notifications.ts:220` | לקוח יכול לקבל SMS תזכורת שניות אחרי שביטל את התור |
| M12 | תיקון ה-race של ההקלטה (double-stop/unmount) סוגר רק ניווט *תוך כדי* הקלטה — לא ניווט מיד אחרי "עצור" בזמן שההעלאה/תמלול עוד רצים | `app/app/dashboard/visits/voice-soap-recorder.tsx` | אותו תרחיש כשל שהתיקון המקורי נועד למנוע (artifact יתום, בזבוז קריאת LLM), רק בטריגר אחר |
| M13 | סקריפט `reset-clinic-data.mjs` מוחק טבלאות **שלמות** בלי סינון `clinic_id`, בסכמה שהיא מפורשות multi-tenant | `app/scripts/reset-clinic-data.mjs` (branch `chore/clinic-reset-and-users`, לא ממוזג) | ברגע שתהיה מרפאה שנייה — "איפוס מרפאת הפיילוט" ימחק את כל המרפאות. יש מיטיגציות (dry-run כברירת מחדל, `--confirm` נדרש, ללא URL קשיח) אך אין בדיקת זהות סביבה |
| M14 | שני עותקים **לא-זהים** של מסמך design-handoff | `design_handoff_voxly_vet/` מול `docs/design/dashboard/` | מסמך "docs" חסר מסך visit.jsx והערת RTL קריטית שקיימת רק בעותק השני |
| M15 | `agent/.env.example` מפנה לפרויקט Supabase **מחוק** ולתייג אותו בשם ("voxly ai") שמשמש כיום לפרויקט הנוכחי | `agent/.env.example` (הערת `AGENT_CLINIC_ID`) | מפתח שיעתיק את ה-UUID הזה בהקמה חדשה יצביע על clinic_id שגוי — בדיוק סוג התקרית שכבר קרתה (TOOLS_BEARER_TOKEN) |
| M16 | `HUMAN_HANDOFF_NUMBER` בשימוש פעיל בקוד (ניתוב שיחה חיה לנועה) אך לא מתועד כלל ב-`agent/.env.example` | `agent/src/server/routes/tools.ts:162`, `agent/src/lib/env.ts:33` | פיצ'ר חי נכבה בשקט (השדה אופציונלי) בלי שום רמז בתבנית ה-setup שהוא קיים |
| M17 | `checkAvailability` מסנן לפי סטטוסים צר יותר מאילוץ ה-DB בפועל | `agent/src/lib/store.ts:202` | תומר עלול להציע תור שבפועל תפוס; ה-DB חוסם בבטחה אך חוויית משתמש מבלבלת (round-trip מיותר) |

### נמוך

| # | ממצא | מיקום |
|---|---|---|
| L1 | מנוע טריאז' טיוטה-ראשונה נטוש, לצד המנוע החי (`decideTriage`) | `agent/src/triage/triageDecision.ts` + test |
| L2 | JSON ידע יתום מאותו commit נטוש — המקור החי הוא `red-flags.ts` | `agent/src/knowledge/red_flags.json`, `triage_rules.json` |
| L3 | שרשרת מודולי DTMF יתומים ב-`app/lib/integrations/twilio/` שעדיין "מוחזקים בחיים" ע"י שני טסטים שלא עברו לארכיון | `client.ts` (0 שימושים), `twiml.ts`, `signature.ts` + `phase6-twiml.test.ts`, `phase6-twilio-signature.test.ts` |
| L4 | טבלת `prompt_suggestions` "רפאים" — מיגרציה ישנה עדיין יוצרת אותה למרות שהקוד עבר כולו ל-`tomer_prompt_suggestions` | `supabase/migrations/20260828000022_prompt_learning_loop.sql:28-46` |
| L5 | אותו סמל חץ `←` משמש גם ל"אחורה" וגם ל"קדימה/עוד" במסכים שונים | כמה עמודים ב-`app/app/dashboard/**` |
| L6 | צבעי hex קשיחים לצד טוקנים — עדות למיגרציה חלקית ל-Graphite Pro | `clients/page.tsx:421`, `pets/[petId]/page.tsx:93`, `components/dashboard/sidebar.tsx:100` |
| L7 | Modal/Drawer משותפים בלי focus-trap / ניהול פוקוס ראשוני בפתיחה | `components/dashboard/ui/{modal,drawer}.tsx` |
| L8 | Toast מבדיל חומרה בצבע בלבד, בלי `role="status"`/`aria-live` | `components/dashboard/ui/toast.tsx` |
| L9 | מסך Inventory חסר skeleton/empty-state ותוויות קלט | `app/app/dashboard/inventory/page.tsx`, `inventory-table.tsx` |
| L10 | Today dashboard בולע שגיאת fetch בלי catch — "אין פעילות" גם כשיש כשל טעינה אמיתי | `app/app/dashboard/page.tsx` (`fetchData`) |
| L11 | CLAUDE.md עצמו: פקודת טסט שגויה (`agent/src/tests` במקום `agent/tests/unit`), שם פרויקט Vercel לא מעודכן | `CLAUDE.md` |
| L12 | תלות `esbuild` לא בשימוש ב-agent; `@supabase/supabase-js` מיותר ב-root package.json | `agent/package.json`, root `package.json` |
| L13 | `app/package.json` חסר `"type":"module"` — אזהרת תאימות-קדימה מ-Vite | `app/vitest.config.ts` |
| L14 | אי-עקביות בשמות קבצי מיגרציה (suffix ידני מול timestamp אמיתי) מ-29.8 ואילך | `supabase/migrations/` |
| L15 | `docs/VOXLY_SOURCE_OF_TRUTH.md` — מסמך "מקור אמת" מתחרה/מיושן, לא מוזכר יותר ב-CLAUDE.md | `docs/VOXLY_SOURCE_OF_TRUTH.md` |
| L16 | תיקיית `app/output/` ריקה, לא ב-`.gitignore` | `app/output/` |
| L17 | ניסוח `AFTER_HOURS_SCRIPT` הקפוא שונה בתוך קומיט פיצ'ר רחב (`ab69f29`) ולא קומיט ייעודי — לא בהכרח לא-מאושר, רק ראוי לתשומת לב | `agent/src/services/triage.service.ts:28` |
| L18 | פינת-DST תיאורטית ב-`appointments.ts:247` — נופל ל-`+02:00` קשיח; מסלול קוד מת בפועל כי שעות הפעילות לא מגיעות לחלון הזה | `agent/src/lib/appointments.ts:247` |

**סודות/credentials:** נבדק בקפידה (JWT, מפתחות API, טוקנים, מחרוזות חיבור) — **לא נמצא דבר** בקוד המתועד או בהיסטוריית ה-git. `npm audit` נקי (0 חולשות) בשני החבילות.

---

## 3. מה טוב בפרויקט — לשמר כמו שהוא

- **מניעת double-booking אמיתית ברמת ה-DB** — Postgres exclusion constraint (`appointments_no_active_overlap`), לא רק לוגיקת אפליקציה. `reschedule_appointment` הוא RPC טרנזקציוני יחיד עם `FOR UPDATE`.
- **דפוס optimistic-locking עקבי** (`version`/`expectedVersion`) על פני appointments, visits, tasks, follow-ups, lab-orders, invoices — לא רק "טלאי" במקום אחד שהיה בו תקרית.
- **כיסוי auth מוצק** — כמעט כל route עובר `requireAuth`/`getActorAndServices`, כולל אימות `clinicIds`/role לפני כל מוטציה.
- **משמעת TypeScript חזקה** — אין `any`/`as any`/הנחות non-null מסוכנות בשכבות service/repository; אין SQL string concatenation גולמי.
- **בטיחות/סודות נקיים** — 0 חולשות `npm audit`, אין credentials בקוד או בהיסטוריה, `.gitignore` מכסה נכון את כל קבצי ה-env.
- **677 טסטים עוברים** (agent 325/325, app 352/368 כאשר כל 16 המדולגים הם integration-gated כמצופה) — אין `.skip`/`.only` תקועים בטעות.
- **חישובי שעון ירושלים/גבולות עסקיים מדויקים** — 14 יום, 4 שעות, שעות פעילות — נבדקו ידנית עד רמת תאריך בודד ועברו.
- **תיקון "status-bypass" ב-medical-notes התכנס נקי** — הוסר השדה `status` מהסכמה/טיפוס לגמרי במקום לתקן בזמן ריצה, עם הגנת-עומק (שירות + DB trigger) וטסטים בשתי השכבות.
- **אימוץ Graphite Pro הצליח ברוב המסכים** — 12+ רכיבים משותפים בשימוש עקבי, RTL תקין כמעט בכל מקום (`ms-`/`me-`/`start-`/`end-`, לא `ml-`/`mr-`).
- **מסכי pets/records/settings** שתועדו כ"placeholder" ב-CLAUDE.md בפועל בנויים במלואם, עם loading/empty/error תקינים.
- כלי ה-patient-lookup החדשים עוקבים במדויק אחר המוסכמות הקיימות (`{result: string}`, Zod validation, לוגים).

---

## 4. מה לא טוב — לב הבעיות

1. **שני מקורות אמת ללוגיקה קריטית ללא סנכרון אכיף** — SMS תזכורות (C1) ושעון ירושלים (M8) ממומשים פעמיים, ב-agent וב-app, בלי מנגנון שמונע drift. זו הבעיה המבנית שהכי צריך לתקן, כי היא כבר גרמה לבאג קריטי אחד ותגרום לעוד.
2. **תהליך עבודה מקביל בלי בידוד** — ראה סעיף 1.א. יותר מגורם אחד נגע באותה תיקיית עבודה, כולל מעבר branch, בלי תיאום גלוי.
3. **פערי "backport"** — כשמתקנים באג, לא בודקים אם אותו דפוס קיים במקום אחר (C2 הוא עותק מדויק של באג שכבר תוקן בפונקציה האחות).
4. **מיגרציה חלקית לעיצוב** — אזור ה-visits/SOAP (M3) נשאר מאחור מבחינת שפה/נגישות/גימור לעומת שאר האפליקציה.
5. **ניקיון-אחרי-ארכוב לא שלם** — כל פעם שקוד "הועבר לארכיון" (DTMF, מנוע טריאז' ישן), חלק מהעקבות (טסטים, JSON, קבצי config) נשארו מחוברים לחיים.

---

## 5. מה למחוק — עם נימוק

| קובץ/branch | נימוק |
|---|---|
| `agent/src/triage/triageDecision.ts` + הטסט שלו | מנוע טיוטה-ראשונה, הוחלף יום למחרת ע"י `decideTriage()`, אפס שימוש אמיתי |
| `agent/src/knowledge/red_flags.json`, `triage_rules.json` | אפס שימוש בקוד; המקור החי היחיד הוא `red-flags.ts` |
| `app/lib/integrations/twilio/client.ts` | אפס importers בכל הריפו |
| `app/output/` (תיקייה ריקה) | לא בשימוש, לא ב-gitignore |
| `origin/feat/hebrew-triage-labels` (branch) | diff מול main ריק — כבר ממוזג בסקוואש |
| `origin/codex/batch-1-4-checkpoint`, `origin/codex/batch-5-live-calls`, `origin/fix/hardening-validation-security` (branches) | 0 קומיטים ייחודיים מול main — נבלעו לגמרי |
| `agent` devDependency `esbuild` | אפס import ישיר, לא בשימוש ב-build script |
| root `package.json` dependency `@supabase/supabase-js` | לא בשימוש ישיר ב-root (אין קבצי מקור ב-root) |

**דורש החלטה לפני מחיקה (לא "בטוח עיוור"):**
- `app/lib/integrations/twilio/twiml.ts` + `signature.ts` + שני הטסטים שלהם (`phase6-twiml.test.ts`, `phase6-twilio-signature.test.ts`) — `config.ts` שהם תלויים בו עדיין חי (דרך `sms.ts`), אז זו לא מחיקה "נקייה" לגמרי; להעביר ל-`tests/archive` או למחוק בבת אחת.
- `app/tests/archive/phase6-voice-calls.integration.test.ts` — כבר מוחרג מ-build/lint, אין נזק אם יישאר; למחוק רק אם רוצים לאבד את ההפניה ההיסטורית (עדיין תהיה זמינה ב-git history בכל מקרה).
- `supabase/migrations/20260828000022_prompt_learning_loop.sql` יצירת `public.prompt_suggestions` — לא למחוק את המיגרציה עצמה (זה ישבור db reset היסטורי), אלא להוסיף מיגרציה **חדשה** ש-`DROP TABLE IF EXISTS public.prompt_suggestions` — לתאם קודם שאין תלות חיצונית שנשארה תלויה בשם הישן.
- `design_handoff_voxly_vet/` **או** `docs/design/dashboard/` — אחד מהשניים מיותר, אך יש תוכן ייחודי בכל אחד (visit.jsx, הערת RTL, SETUP.md/screenshots) — למזג לפני מחיקה, לא למחוק ישירות.
- `docs/VOXLY_SOURCE_OF_TRUTH.md` — כנראה מיושן וכבר הוחלף ע"י דף הנושן, אבל כדאי סריקה קצרה של תוכנו לפני מחיקה סופית.

---

## 6. מה לתקן — הצעת פתרון קונקרטית לכל פריט

| # | פתרון קונקרטי |
|---|---|
| C1 | לבטל את יצירת ה-SMS העצמאית ב-`dashboard-notifications.service.ts:219-237`; לגרום לדשבורד לקרוא לאותה פונקציית-תבנית מ-`sms.templates.ts` (או, אם השירותים חייבים להישאר נפרדים, לחלץ את תבניות ה-SMS ל-package/module משותף שגם agent וגם app מייבאים ישירות — לא מעתיקים ידנית) |
| C2 | ב-`findCustomerByPhone` (`store.ts:71`), להעתיק את אותו דפוס תיקון מ-`listCustomerPets`: לפצל את שאילתת ה-pets מהלקוח ולסנן `deleted_at` בצד השרת, במקום embed יחיד ללא סינון |
| M1 | להוסיף `.eq("customer_id", ...).eq("name", ...)` בדיקת-existence עם retry על 23505 ב-`createOrFindCustomer`; להוסיף unique constraint (migration) על `pets(customer_id, name)` ואז לטפל ב-23505 גם שם |
| M2 | להחליט אם `appointments/` route family עדיין נחוץ; אם לא — למחוק (הלוח-שנה `calendar/` הוא התחליף האמיתי); אם כן — לקשר מהניווט ולהעביר לרכיבי Graphite Pro |
| M3 | לתרגם כותרות/שדות ל-עברית, להוסיף `<label>` אמיתי לכל שדה בטופס (`vitals-form.tsx`, `visit-notes-section.tsx`); לממש בפועל את `ExamForm` עם state/props אמיתיים במקום ה-badge הקבוע |
| M4 | להחליף את המימוש הידני ב-`CallDrawer`/`ResolveModal` ברכיבי `Drawer`/`Modal` המשותפים; להוסיף `aria-label` לכפתור הסגירה |
| M5 | לקבוע גרסה אחידה ל-`zod` ו-`twilio` בשני החבילות (workspace-level `overrides`/`resolutions` או שדרוג מתואם); לאחד את מימוש אימות חתימת Twilio למודול משותף אחד |
| M6 | לתזמן שדרוג ל-`@elevenlabs/elevenlabs-js` ב-`app/lib/learning/elevenlabsTesting.ts` (כבר פתוח ב-backlog); אין צורך לגעת בצד agent כי זה קוד מת |
| M7 | להסיר `"tests"` מ-`exclude` ב-`agent/tsconfig.json`, ולשנות `"lint": "eslint src"` ל-`"lint": "eslint ."` (כמו ב-app) |
| M8 | לחלץ את כל לוגיקת שעון ירושלים למודול יחיד משותף (או package פנימי) שגם `agent/` וגם `app/` מייבאים; להסיר את שתי המימושים הכפולים |
| M9 | להפוך את התלות ההפוכה: לחלץ פונקציונליות משותפת ל-`lib/` נקי, ו-`notification.processor.ts` יקרא ל-`lib`, לא להפך |
| M10 | לעטוף את יצירת מספר החשבונית ב-DB sequence/RPC אטומי במקום `count+1` באפליקציה; להחזיר 409 ידידותי בהתנגשות |
| M11 | לשנות את הסינון ב-`cancelFutureNotifications` לכלול גם `status='processing'` (עם בדיקת timestamp כדי לא לבטל שורה שכבר *נשלחה בפועל*) |
| M12 | להוסיף דגל/AbortController שנבדק גם אחרי `stopRecording()` לפני תחילת ההעלאה/תמלול, לא רק ב-`onstop` עצמו |
| M13 | להוסיף `.eq("clinic_id", CLINIC_ID)` לכל שאילתת מחיקה בסקריפט; להוסיף בדיקת זהות סביבה (אימות project ref מול קלט/env) לפני מחיקה בפועל |
| M14 | למזג את התוכן הייחודי (`visit.jsx`, הערת RTL) מ-`design_handoff_voxly_vet/` לתוך `docs/design/dashboard/`, ואז למחוק את הראשון |
| M15 | לעדכן את ההערה ב-`agent/.env.example` לפרויקט/UUID הנוכחיים (`xpsuhtqfxqmnunppnyov` / `37681721-a59f-40d5-a041-ad15a49ecf29`) |
| M16 | להוסיף `HUMAN_HANDOFF_NUMBER` (מתועד כאופציונלי) ל-`agent/.env.example` |
| M17 | להרחיב את הפילטר ב-`checkAvailability` שיתאים בדיוק לרשימת הסטטוסים שב-exclusion constraint ב-DB |

---

## 7. מה להוסיף / חסר — הצעה קונקרטית לכל פריט

| מה חסר | הצעה קונקרטית |
|---|---|
| טסטים ל-race conditions | טסט ייעודי ל-`createOrFindCustomer`/`createOrFindPet` שמדמה שתי בקשות בו-זמניות (mock עם delay מכוון) |
| unique constraint על `pets` | מיגרציה: `UNIQUE (customer_id, name) WHERE deleted_at IS NULL` |
| בדיקת סביבה בסקריפט האיפוס | פרמטר חובה `--project-ref=<ref>` שמושווה ל-`SUPABASE_URL` בפועל לפני מחיקה |
| נגישות ל-Toast | `role="status" aria-live="polite"` על מיכל ה-toast; אייקון בנוסף לצבע |
| focus trap ל-Modal/Drawer | להשתמש ב-hook קיים (למשל `focus-trap-react`) או ליישם ידנית עם `useEffect` שמעביר פוקוס לרכיב הראשון בפתיחה ותופס Tab בסוף |
| typecheck/lint לטסטים ב-agent | הסרת ה-exclude (M7 למעלה) |
| מקור אמת יחיד לתבניות SMS/שעון | package/module משותף (M8 למעלה) — זה גם "לתקן" וגם "להוסיף" (תשתית שחסרה) |
| בדיקת זהות environment כללית | שקול middleware/guard גנרי ברמת ה-agent/app שמסרב לפעולות destructive אם `SUPABASE_URL` לא תואם רשימת פרויקטים מוכרים — יעצור תקריות עתידיות מהסוג שכבר קרו |
| נוהל worktree/session | תיעוד קצר ב-CLAUDE.md: "לפני שמתחילים session חדש על התיקייה הראשית — בדוק `git worktree list` ואיזה session אחר עשוי להיות פעיל" |

---

## 8. סדר עדיפויות מומלץ לביצוע

1. **C1 — SMS תזכורת חיסון לא-מאושר** (הפרת כלל מחייב, פוגע בלקוחות עכשיו)
2. **C2 — דליפת חיות מחמד מחוקות בשיחות** (רץ בכל שיחה, פוגע באמינות תומר)
3. **M1 — race conditions ביצירת לקוח/חיה** + unique constraint
4. **M8 — איחוד מקור-אמת לשעון ירושלים ותבניות SMS** (מונע את "C1 הבא")
5. **M13 — אבטחת סקריפט האיפוס** *לפני* מיזוג `chore/clinic-reset-and-users`
6. **ניקוי branches מתים** (feat/hebrew-triage-labels + 3 הענפים הנבלעים) ומיזוג/סגירת `design-system-graphite-pro` (קומיט יחיד) ו-`chore/clinic-reset-and-users`
7. **ניקוי קבצים יתומים** (סעיף 5) — סיכון נמוך, משפר בהירות מיידית
8. **M2-M4, M17 — תיקוני UI/UX בינוניים** באזור ה-visits/SOAP וה-appointments היתום
9. **M15, M16, L11 — עדכוני תיעוד/env**
10. **L5-L10 — ליטוש נגישות/UX נמוך-סיכון**

---

## נספח — פקודות/צעדים מוצעים לביצוע בפועל (לאישור אחד-אחד, לא בוצע כלום)

**ניקוי branches (בטוח, אחרי אישור):**
```
git branch -d feat/hebrew-triage-labels          # אם קיים מקומית
git push origin --delete feat/hebrew-triage-labels
git push origin --delete codex/batch-1-4-checkpoint
git push origin --delete codex/batch-5-live-calls
git push origin --delete fix/hardening-validation-security
```

**מיזוג ענפים חיים (כל אחד בנפרד, אחרי code review קצר):**
```
git checkout main && git pull
git merge --no-ff origin/design-system-graphite-pro   # רק אחרי בדיקה שקומיט 363d7dd עדיין רלוונטי
git merge --no-ff origin/chore/clinic-reset-and-users  # רק אחרי תיקון M13 (clinic_id scoping)
```

**מחיקת קבצים יתומים (כל אחד בנפרד):**
```
git rm agent/src/triage/triageDecision.ts agent/tests/unit/triage/triageDecision.test.ts
git rm agent/src/knowledge/red_flags.json agent/src/knowledge/triage_rules.json
git rm app/lib/integrations/twilio/client.ts
rmdir app/output
```

**דורש דיון לפני ביצוע (לא רק אישור טכני):**
```
# להחליט: להעביר לארכיון או למחוק
git mv app/lib/integrations/twilio/twiml.ts docs/archive/
git mv app/lib/integrations/twilio/signature.ts docs/archive/
git rm app/tests/unit/phase6-twiml.test.ts app/tests/unit/phase6-twilio-signature.test.ts

# מיגרציה חדשה (אחרי תיאום) — DROP TABLE IF EXISTS public.prompt_suggestions

# מיזוג ידני של design_handoff_voxly_vet/ לתוך docs/design/dashboard/, ואז מחיקת הראשון
```

**תיקוני קוד (כל אחד = PR/commit נפרד לאישור):**
- C1: איחוד תבנית SMS לתזכורת חיסון
- C2: תיקון `findCustomerByPhone` לסינון `deleted_at`
- M1: retry/unique-constraint ליצירת לקוח/חיה
- M13: הוספת `clinic_id` scoping לסקריפט האיפוס

לא בוצע אף שינוי בקוד או ב-git. מחכה לאישורך על כל פריט בנפרד.
