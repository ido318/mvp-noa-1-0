# דוח ממצאים — Tomer / Get A Vet

**תאריך:** 2026-09-15  
**HEAD:** `main` @ `d9a2f27` (`fix/noa-production-readiness`)  
**שיטה:** סריקה סטטית של `agent/`, `app/`, `packages/shared/`, `supabase/` + אימות מול דוחות קודמים (`AUDIT_REPORT.md` מ-2.9, `docs/BUGFIX_PLAN_2026-09-05.md`) + בדיקת `/health` חי. בלי שינוי לוגיקה. טסטים לא רצו בסביבה הזו (`node_modules` חסר).

מסמך זה **לא מחליף** את `AUDIT_REPORT.md` (2.9) — הוא מעדכן אותו: מה באמת תוקן מאז, מה נשאר, ומה חדש.

---

## 1. תקציר מנהלים

הליבה הקלינית והקולית במצב טוב יותר מכפי שהיה ב-2.9. PR #7 סגר כמעט את כל ממצאי הדוח הישן (C1/C2, מקור אמת ל-SMS/שעון ירושלים, uniqueness של pets, מחירון עיקור בפרומפט). PR #5/#12 חיזקו SMS, מחיר עיקור, ולידציה.

**הבעיות הפתוחות היום הן בעיקר משלושה סוגים:**

1. **תפעול בפרודקשן שלא ניתן לאשר מהקוד** — ה-cron של SMS תוקן בסקריפט, אבל אין הוכחה מהריפו שהוא באמת רץ בהצלחה בענן.
2. **כללי מדיניות שלא נאכפים בכל הנתיבים** — חלון 14 יום בקביעה, סטטוסי תור תפוסים ביומן הדשבורד, לקוח `active`.
3. **פערי מוצר שעדיין פתוחים מתוכנית 5.9** — כרטיס אסקלציה בלי זהות לקוח, איסוף פרטי חיה חלקי, אין מסלול המתת חסד, אין סנכרון תשלום מ-Green Invoice.

אין באג קריטי חדש בסגנון "תומר מקריא חיה שנמחקה" או "SMS בנוסח לא מאושר". יש כמה באגים בינוניים-גבוהים שפוגעים באמינות היומן ובכרטיסי "דורש תשומת לב".

---

## 2. מה בריא — לשמר

- `@tomer/shared` הוא באמת מקור אמת יחיד לזמן ירושלים ול-8 תבניות ה-SMS הקפואות. שני הצדדים מייבאים משם.
- Exclusion constraint ב-Postgres על תורים חופפים (`scheduled` / `confirmed` / `pending_approval` / `checked_in` / `in_visit`) — רשת ביטחון אמיתית, לא רק לוגיקת אפליקציה.
- `findCustomerByPhone` מסנן `deleted_at` + `status=active`. `createOrFindCustomer`/`createOrFindPet` מטפלים ב-`23505`.
- אימות כלים: Bearer (`TOOLS_BEARER_TOKEN`) — תואם ElevenLabs ConvAI. HMAC נשאר ל-`/hooks/call-ended`.
- Optimistic locking עקבי בדשבורד. מספור חשבוניות אטומי דרך RPC `create_invoice`.
- הסוכן החי ב-Fly משיב 200 מ-`https://voxly-agent.fly.dev/health`.
- מחיר עיקור במאגר הידע וב-SMS: "המחיר יימסר על ידי ד״ר נועה" — לא מספר מומצא.

---

## 3. סטטוס דוחות קודמים

### 3.א — `AUDIT_REPORT.md` (2.9) — PR #7

| ID | נושא | סטטוס ב-HEAD |
|---|---|---|
| C1 | SMS חיסון בנוסח לא מאושר | **תוקן** — `@tomer/shared` |
| C2 | חיות מחמד מחוקות ב-lookup | **תוקן** |
| M1 | race ביצירת לקוח/חיה | **תוקן** |
| M2 | עמוד appointments רפאים | **תוקן** (נמחק) |
| M3 | ExamForm mock/אנגלית | **תוקן** |
| M4 | CallDrawer/ResolveModal | **תוקן** |
| M8 | כפילות שעון/SMS | **תוקן** |
| M10 | מספור חשבונית `count+1` | **תוקן** (RPC) |
| M11 | ביטול SMS מפספס `processing` | **תוקן** |
| M12 | race בהקלטת SOAP | **תוקן** |
| M13 | סקריפט איפוס בלי `clinic_id` | **פתוח — ומוזג ל-main** |
| M15/M16 | `.env.example` | **תוקן** (עם הערות למטה על `DEMO_MODE`) |
| M17 | סטטוסי availability בסוכן | **תוקן בסוכן; עדיין שבור בדשבורד** |
| L10 | today בולע שגיאת fetch | **תוקן במסך היום; חזר ב-waitlist/billing/inventory** |

### 3.ב — `BUGFIX_PLAN_2026-09-05.md`

| # | נושא | סטטוס |
|---|---|---|
| 4+8 | cron SMS (`net.http_post`) | **קוד/סקריפט תוקנו; הצלחה בענן לא מאומתת מכאן** |
| 10 | מחיר עיקור מומצא | **תוקן בקוד/KB** |
| 9 | רעש רקע | **תוקן בגל 1 (קונפיג ElevenLabs)** |
| 12 | משפט סגירה חוזר | **תוקן בגל 1 (פרומפט)** |
| 5 | SMS ידני מהדשבורד | **רמה 1 קיימת** (`POST /api/customers/.../messages`) |
| 7 | ביקור חדש בוחר לקוח שרירותי | **תוקן** |
| 1 | אסקלציה בלי לקוח/טלפון/תסמינים | **פתוח** |
| 3 | איסוף פרטי חיה מלאים | **פתוח** |
| 6 | חשבונית אוטומטית מביקור | **חלקי** — מחירון קיים, חיובים ידניים |
| 11 | המתת חסד | **פתוח** |
| 2 | תמלולים בכל נקודות המגע | **חלקי** — קיים במסך שיחות |

---

## 4. ממצאים פתוחים

חומרה: **P0** = שובר הבטחה ללקוח/צוות עכשיו או סיכון הרסני. **P1** = באג לוגיקה אמיתי בנתיב חי. **P2** = אמינות/UX. **P3** = חוב טכני/תיעוד.

### P0 — לאמת מיידית בפרודקשן (לא באג קוד חדש)

| ID | ממצא | ראיה | השפעה | תיקון |
|---|---|---|---|---|
| **P0-1** | הצלחת `pg_cron` בענן לא ניתנת לאימות מהריפו | `supabase/scripts/cron-jobs.sql` משתמש נכון ב-`net.http_post`. CLAUDE.md עדיין מתאר כישלון היסטורי של `extensions.http_post`. `/health` לא בודק תור SMS. | אם ה-jobs לא הורצו מחדש אחרי התיקון — תזכורות בוקר, הגעה, מעקב וחיסון **עדיין לא נשלחות**. אישור עיקור בדשבורד יכול להצהיר על SMS בזמן שהשורה רק נכנסה לתור. | להריץ ב-SQL editor: `select jobid, status, return_message, start_time from cron.job_run_details order by start_time desc limit 20`. אם נכשל — להריץ `cron-jobs.sql` עם URL/טוקן אמיתיים, ואז שחרור ידני של `pending` שעדיין רלוונטי. |

### P1 — באגים בנתיב חי

| ID | ממצא | מיקום | השפעה | תיקון |
|---|---|---|---|---|
| **P1-1** | `bookAppointment` לא אוכף חלון 14 יום (גם לא שעות פעילות / שבת) | `agent/src/lib/store.ts` ~314–337. `isWithin14Days` רץ רק ב-`checkAvailability`. | אם המודל מדלג על check-availability, תור מחוץ למדיניות נכנס ל-DB. ה-exclusion חוסם רק חפיפה, לא טווח ימים. | לקרוא ל-`isWithin14Days` + `getClinicHours` לפני insert; להחזיר `{result}` בעברית. טסט ייעודי. |
| **P1-2** | יומן הדשבורד מתעלם מ-`checked_in` / `in_visit` בחישוב משבצות | `app/lib/services/calendar.service.ts:98-103` מול הסוכן `store.ts:255` וה-constraint ב-`20260831102335`. | נועה יכולה לראות משבצת "פנויה" שחופפת לביקור פתוח. ה-DB ידחה ב-overlap, אבל חוויית הקביעה נשברת. | ליישר את רשימת הסטטוסים לזו של הסוכן וה-constraint. |
| **P1-3** | כרטיסי אסקלציה בלי זהות לקוח, טלפון, תסמינים מלאים | טבלה: `20260611000012_agent_schema.sql:37-48`. כתיבה: `store.ts:110-118`. חיתוך: `tools.ts:247-248`. | "דורש תשומת לב" מציג מחרוזת אחת. אין כפתור חיוג, אין קישור לשיחה, תסמינים נחתכים ל-120 תווים. זה הבאג שהצוות דיווח ב-5.9. | מיגרציה: `customer_id`, `pet_id`, `caller_phone`, `context jsonb`. הכלים מקבלים `{{system__caller_id}}`. UI: שם + `tel:` + קישור לשיחה. |
| **P1-4** | `findCustomerIdByPhone` בלי `status=active` | `store.ts:199-209` מול `findCustomerByPhone` שכן מסנן. | קביעה/ביטול/waitlist ללקוח מושבת — דרך `createOrFindCustomer`. | אותו פילטר כמו ב-lookup. להחליט אם מושבת = "לא נמצא" או "מפעיל מחדש במפורש". |
| **P1-5** | נרמול טלפון שובר מספר ישראלי בלי `0` | `store.ts:56-61`, גם `app/lib/integrations/twilio/sms.ts:toE164Israel`. | `549581991` → `+549581991` במקום `+972549581991`. miss ב-lookup + לקוח כפול + SMS נכשל. | לזהות 9 ספרות שמתחילות ב-`5` ולהוסיף `972`. מקור אחד ב-`@tomer/shared`. |
| **P1-6** | סקריפט איפוס מוחק את כל המרפאות | `app/scripts/reset-clinic-data.mjs:99-100` — `.delete().not("id","is",null)` בלי `clinic_id`. **כבר ב-main.** | ברגע שיש clinic שני (או DB משותף), "איפוס פיילוט" מוחק הכל. dry-run לא מגן על זה. | חובת `--clinic-id=` + `.eq("clinic_id", …)` + התאמת `SUPABASE_URL` ל-`--project-ref=`. |
| **P1-7** | מיגרציית `call_reviews` לא תואמת לקוד | יצירה: `20260828000022` (`elevenlabs_conversation_id`, `evaluation_results`). קוד: `logConversation.ts` (`conversation_id`, `evaluation_criteria_results`, `onConflict: "conversation_id"`). | `supabase db reset` מקומי/CI ישבור את לולאת הלמידה. פרודקשן עובד רק כי הטבלה שונתה ידנית בענן. | מיגרציה חדשה שמיישרת את הסכמה לצורת ElevenLabs (לא `CREATE IF NOT EXISTS` שוב). |
| **P1-8** | חילוץ שעת callback דחוף נשבר מול פורמט דיבור | `tools.ts:276` מחפש `/\b(\d{2}:\d{2})\b/` על טקסט מ-`formatSlotSpokenHe` (`1:00 בצהריים`, לא `13:00`). | ברוב שעות הבוקר (8–9) אין התאמה — תומר לא מציע משבצת היום אחרי טריאז' דחוף. | לחלץ מ-`scheduled_at=` ב-`formatSlotOptionForTool`, לא מ-HH:MM מדובר. |

### P2 — אמינות, UX, אבטחה תפעולית

| ID | ממצא | מיקום | השפעה | תיקון |
|---|---|---|---|---|
| **P2-1** | waitlist / billing / inventory בולעים כשל טעינה כ-empty | `waitlist/page.tsx:57-65`, `billing/page.tsx`, `inventory/page.tsx:22-28` | תקלה נראית כ"אין נתונים" — אותה מחלקה שתוקנה במסך היום. | `loadError` + Alert + "נסה שוב". |
| **P2-2** | יצירת פריט מלאי בלי בדיקת `res.ok` | `inventory/page.tsx:42-51` | כשל validation נראה כהצלחה (הטופס מתנקה). | לבדוק `ok`, toast, לא לנקות בשגיאה. |
| **P2-3** | אשף תור: חיפוש לקוח / availability נכשלים בשקט | `new-appointment-wizard.tsx` | "אין תוצאות" במקום 403/רשת. | toast אחיד כמו בטעינת pets. |
| **P2-4** | חלון 14 יום בדשבורד מחושב לפי תאריך UTC | `new-appointment-wizard.tsx:50` — `new Date().toISOString().slice(0, 10)` | בין חצות ל-02:00/03:00 שעון ישראל החלון זז יום אחורה. ה-API לא אוכף 14 יום בכלל. | `israelDateIso()` מה-shared; לאכוף גם ב-`availabilityByDate` / `appointment.service.create`. |
| **P2-5** | `DEMO_MODE` default `true` + תיאור מטעה | `agent/src/lib/env.ts:35-37`, `.env.example:11-12`. בפועל המשתנה **רק מלוגג** ב-`index.ts`. | מי שיעתיק `.env.example` או ישכח להגדיר ב-Fly עלול לחשוב שהסוכן ב-demo. אם מישהו יוסיף דילוג על Twilio לפי הדגל — פרודקשן יישבר בשקט. | default `false` ב-production; לחייב ערך מפורש; לתקן/להסיר את ההערה "skips external API calls". |
| **P2-6** | `/hooks/call-ended`: `saveVoiceCall` מחוץ ל-try/catch | `hooks.ts:69` | כשל DB → 500 ל-ElevenLabs → retry אגרסיבי / איבוד הקלטה. | לעטוף, להחזיר 200 אחרי best-effort + לוג, או תור retry. |
| **P2-7** | lookup/escalate בלי try/catch כמו שאר הכלים | `tools.ts` | שגיאת Supabase → 500 גולמי במקום `{result}` בעברית. | אותו דפוס catch כמו book/cancel. |
| **P2-8** | כשל עדכון `sent` אחרי Twilio הצליח → SMS כפול | `notificationProcessor.ts:129-136` (מתועד בקוד) | תזכורת כפולה אחרי recovery של 5 דקות. | Twilio idempotency key, או סימון `sent` לפני/יחד עם claim חזק יותר. |
| **P2-9** | jobs מקבלים `clinicId` מגוף הבקשה עם bearer משותף | `jobs.ts` | דליפת טוקן = עיבוד מרפאה אחרת. בפיילוט מרפאה אחת. | לקבע ל-`AGENT_CLINIC_ID`. |
| **P2-10** | תזכורות חיסון נסרקות לכל המרפאות | `vaccinationReminders.ts` | agent אחד מעלה SMS לכל tenant בפרויקט. | לסנן `AGENT_CLINIC_ID` אלא אם זה job מערכת מכוון. |
| **P2-11** | מחירים חיים ב-3+ מקומות | KB `pricing_and_visits.md`, `VISIT_PRICE` בסוכן, `VISIT_PRICES` בדשבורד, `price_list_items` בדשבורד. | עדכון מחירון בדשבורד לא משנה מה תומר אומר ומה נכתב ב-SMS קביעה. | מקור אחד (`price_list_items`) + סנכרון KB אוטומטי אחרי שמירה. |
| **P2-12** | Modal/Drawer בלי `aria-labelledby` | `components/dashboard/ui/{modal,drawer}.tsx` | קורא מסך מקבל דיאלוג בלי שם. | `id` על הכותרת + `aria-labelledby`. |

### P3 — סכמה, תיעוד, חוב

| ID | ממצא | תיקון |
|---|---|---|
| **P3-1** | טבלת רפאים `prompt_suggestions` ליד `tomer_prompt_suggestions` | מיגרציה `DROP TABLE IF EXISTS public.prompt_suggestions` אחרי וידוא שאין תלות בענן (PIMS). |
| **P3-2** | CLAUDE.md / AGENTS.md: HMAC על `/tools/*`, "15 מיגרציות", latest ישן, cron סותר | לעדכן: Bearer ל-tools; 47 מיגרציות; cron = לאמת `job_run_details`. |
| **P3-3** | README עדיין מתאר `POST /twilio/voice` כנתיב החי | הנתיב החי: Twilio → ElevenLabs native inbound. `twilio.ts` קוד מת בפרודקשן. |
| **P3-4** | `VISIT_TYPE_CONFIG` כפול בין agent ל-app (לא ב-shared) | להעביר ל-`@tomer/shared` כמו הזמן וה-SMS. |
| **P3-5** | `deleted_at` לא אחיד בין טבלאות | לתעד מטריצה; לא להוסיף בכל מקום אוטומטית. |
| **P3-6** | seed מקומי `clinic_id` ≠ UUID של Get A Vet | לתעד יישור env↔seed. |
| **P3-7** | Notion "מאסטר שלבי פיתוח" מיושן (עודכן 8.9, הטבלאות מ-12.6) | לסנכרן אחרי אישור הדוח. |
| **P3-8** | `DEPLOYMENT_STATUS.md` מ-28.8 (טוען לבדוק `voice_url` לשרת שלנו) | לעדכן לפי CLAUDE: voice_url = ElevenLabs native. |

---

## 5. פערי מוצר פתוחים (לא באגים, דורשים החלטת נועה)

אלה עדיין נכונים מהתוכנית מ-5.9. לא "לתקן בשקט":

1. **המתת חסד** — אין תסריט, אין חסימת follow-up SMS, אין כרטיס רגיש. דורש נוסח מנועה.
2. **איסוף פרטי חיה בשיחה** — נשמרים רק שם/סוג/גזע. `sex` / גיל / משקל / כתובת לביקור בית קיימים בסכמה ולא נאספים.
3. **חשבונית אוטומטית מתיעוד הביקור** — מחירון קיים; חיובים עדיין ידניים. אין webhook Green Invoice (מתועד כפאזה הבאה).
4. **WhatsApp Business אמיתי** — היום קישור `wa.me` + SMS Twilio. API של Meta דורש החלטה עסקית.

---

## 6. ארכיטקטורה — תמונה מול תיעוד

```
[מתקשר] → Twilio (מספר ישראלי)
        → ElevenLabs native inbound  ← זה הנתיב החי
        → תומר (עברית)
           POST /tools/*  (Bearer TOOLS_BEARER_TOKEN)
           → Supabase: customers, pets, appointments, waitlist, escalations
        → POST /hooks/call-ended (HMAC)
           → voice_calls + call_reviews
[דשבורד Next.js] → session + RLS
[pg_cron] → POST /jobs/* (Bearer JOBS_BEARER_TOKEN)
```

פערי תיעוד מסוכנים:

- CLAUDE.md/AGENTS.md עדיין כותבים ש-`/tools/*` מוגן ב-HMAC. הקוד: Bearer. מי שיגדיר webhook לפי התיעוד ישבור כלים.
- README עדיין מצייר `POST /twilio/voice`. זה בדיוק סוג הבלבול שגרם לתקרית 25.8.
- Notion המאסטר לא מעודכן למיזוגים של ספטמבר (shared package, Green Invoice, prompt consolidation).

---

## 7. שלבי עבודה לפתרון

כל שלב = PR נפרד. לא לערבב ops עם סכמה עם UI.

### שלב 0 — עצירת דימום תפעולי (בלי קוד, היום)

1. בענן Supabase: לבדוק `cron.job_run_details` (P0-1).
2. אם נכשל: להריץ `supabase/scripts/cron-jobs.sql` עם ה-URL והטוקן האמיתיים.
3. להחליט מה לעשות עם `pending` שעבר זמנו (לסמן `skipped`, לא לשלוח תזכורת לתור מלפני שבועיים).
4. שיחת מבחן אחת: קביעה → SMS מיידי; המתנה ל-cron → morning/arrival אם רלוונטי.

**הצלחה:** לפחות הרצה אחת עם `status=succeeded` לכל אחד מ-3 ה-jobs.

### שלב 1 — אמינות קביעה וזהות לקוח (P1)

PR אחד ממוקד סוכן:

1. P1-1 — אכיפת 14 יום + שעות פעילות ב-`bookAppointment`.
2. P1-4 — `status=active` ב-`findCustomerIdByPhone`.
3. P1-5 — נרמול טלפון ישראלי (כולל 9 ספרות) ב-`@tomer/shared`, שימוש בסוכן ובדשבורד.
4. P1-8 — חילוץ משבצת מ-`scheduled_at=` בטריאז' דחוף.
5. P2-7 — try/catch על lookup/escalate.
6. P2-6 — `saveVoiceCall` לא מפיל את ה-webhook.

PR נפרד לדשבורד:

7. P1-2 — סטטוסי overlap ביומן = כמו בסוכן.
8. P2-4 — חלון 14 יום לפי `israelDateIso` + אכיפה ב-API.

**הצלחה:** טסטים אדומים שהופכים לירוקים לכל אחד; קביעה מחוץ ל-14 יום נדחית גם אם מדלגים על check-availability.

### שלב 2 — אסקלציות שמישות (P1-3) — המוצר שנועה רואה

1. מיגרציה + backfill מ-`voice_calls` לפי `elevenlabs_conversation_id`.
2. הכלים מקבלים טלפון + כותבים context מובנה.
3. כרטיס בדשבורד: שם לקוח/חיה, תסמינים מלאים, חייג, פתח שיחה.

**הצלחה:** אסקלציה חדשה מציגה שם + טלפון בלי לפתוח את מסך השיחות.

### שלב 3 — הגנות הרסניות וסכמה ירוקה

1. P1-6 — לנעול את `reset-clinic-data.mjs` **לפני שימוש חוזר**.
2. P1-7 — מיגרציית `call_reviews` שתואמת לקוד. אחרי זה `db reset` מקומי חייב לעבור את לולאת הלמידה.
3. P3-1 — drop לטבלת `prompt_suggestions` הרפאית (אחרי בדיקת ענן).
4. P2-5 — `DEMO_MODE` לא יכול להיות default מסוכן.

**הצלחה:** `supabase db reset` + agent tests ירוקים מול סכמת המיגרציות, בלי תיקונים ידניים בענן.

### שלב 4 — אמינות דשבורד (P2-1…P2-3, P2-12)

1. Error states ב-waitlist / billing / inventory / wizard.
2. בדיקת `res.ok` ביצירת מלאי.
3. `aria-labelledby` ל-Modal/Drawer.

**הצלחה:** ניתוק רשת מדומה מציג "נסה שוב", לא רשימה ריקה.

### שלב 5 — מקור אמת למחיר + תור SMS עמיד

1. P2-11 — SMS קביעה קורא מ-`price_list_items` (או RPC), לא מ-const כפול.
2. סנכרון KB אחרי שמירת מחירון (`POST /jobs/sync-knowledge-base`).
3. P2-8 — מניעת SMS כפול (idempotency Twilio).
4. P2-9/P2-10 — קיבוע `clinic_id` ב-jobs ובתזכורות חיסון.
5. `/health` מחזיר `pending_overdue` — כדי ש-P0-1 לא יחזור בשקט.

**הצלחה:** שינוי מחיר בדשבורד מופיע ב-SMS הבא ובמה שתומר אומר אחרי סנכרון; אין כפילות תזכורת בטסט recovery.

### שלב 6 — תיעוד (P3-2, P3-3, P3-7, P3-8)

1. CLAUDE.md + AGENTS.md + README: נתיב קול, Bearer, מספר מיגרציות, נוהל בדיקת cron.
2. Notion מאסטר: לסנכרן עם הדוח הזה.
3. `DEMO_MODE` / `HUMAN_HANDOFF_NUMBER` / cron verify ב-`.env.example` ובצ׳ק-ליסט.

**הצלחה:** מישהו חדש שקורא רק את CLAUDE.md מגדיר tools נכון ולא מחזיר `voice_url` לשרת שלנו.

### שלב 7 — מוצר (אחרי אישור נועה)

1. המתת חסד — תסריט קפוא + חסימת follow-up.
2. איסוף פרטי חיה אופציונליים בשיחה + תג "פרטים חלקיים".
3. חיובים אוטומטיים מביקור / מלאי.
4. Webhook Green Invoice — או סימון UI ברור ש"שולם" ידני עד אז.

---

## 8. סדר מומלץ אם עושים רק חלק

אם יש קיבולת ל-3 PRs בלבד:

1. **שלב 0** (cron) — בלי זה כל תזכורת מתוזמנת עשויה להיות מתה.
2. **שלב 1** (קביעה + טלפון + overlap ביומן) — מונע תורים שגויים ולקוחות כפולים.
3. **שלב 2** (אסקלציות) — זה מה שהצוות רואה כל בוקר ב"דורש תשומת לב".

הסקריפט `reset-clinic-data.mjs` (P1-6) לא דחוף עד שרצים אותו שוב — אבל **אסור להריץ אותו על ענן לפני שלב 3**.

---

## 9. מה לא אומת כאן

- הרצות `cron.job_run_details` בענן (אין גישת SQL מהסביבה הזו).
- קונפיג ElevenLabs החי (VAD / turn_eagerness) — סומך על גל 1 מ-6.9.
- `DEMO_MODE` בפועל ב-Fly secrets.
- טסטים (`npm run test:all`) — אין `node_modules` בסביבת הענן הזו.
- E2E שיחה אמיתית.
- Issues ב-GitHub (האינטגרציה לקריאה חסומה).

---

## 10. המלצת תהליך

יותר מ-session אחד על אותה תיקיית עבודה כבר גרם לבלגן (דוח 2.9, תקרית `voice_url`, drift של `call_reviews`). לפני עבודה על התיקייה הראשית: `git worktree list`, ועבודה מקבילה רק ב-worktree נפרד.
