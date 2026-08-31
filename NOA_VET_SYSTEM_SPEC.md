# NOA Vet Practice Management System Spec

מסמך אפיון מוצר וטכני למערכת ניהול מרפאה וטרינרית עבור נועה מ-Get A Vet.

תאריך: 2026-08-31  
שפת מוצר: עברית, RTL מלא  
Stack מועדף: Next.js 16, React 19, TypeScript strict, Supabase/PostgreSQL, Tailwind CSS 4, tRPC, Vercel  
מטרת המסמך: לאפשר לסוכן פיתוח כמו Codex או Claude Code להבין את המוצר, ה-workflows, הדאטה, ה-Backend, גבולות AI ותוכנית הבנייה בשלבים.

---

## 1. Research & Competitive Analysis

### מקורות מחקר

המחקר נשען על מקורות פומביים, דפי מוצר, תיעוד נגיש, Help Center ותיאורי workflows:

- Clinica Online: https://www.clinicaonline.co.il/default.aspx
- ezyVet features: https://www.ezyvet.com/features
- ezyVet AI-Assisted Notes: https://www.ezyvet.com/ai-assisted-notes
- ezyVet Knowledge Center snippets, including appointment-clinical-record relations and billing triggers: https://docs.ezyvet.com
- Covetrus Pulse: https://covetrus.com/covetrus-platform/workflow-and-productivity-tools/covetrus-pulse/
- Covetrus Pulse Knowledge Base: https://cvet.my.site.com/pulse/s/knowledge-base
- Digitail PIMS: https://digitail.com/
- VetSoftwareHub overview of veterinary PIMS categories: https://www.vetsoftwarehub.com/

### Clinica Online

Clinica Online מייצגת רפרנס מקומי ישראלי. נקודות מרכזיות:

- מערכת ענן לניהול מרפאה וטרינרית עם זימון תורים.
- תמיכה ביומן רופא, יומן קליניקה רב מטפלים, תזכורות SMS/Email, תיקים רפואיים, בדיקות מעבדה, מרשמים, קבצים, חשבוניות, תשלומים, מלאי, רכש, הרשאות ועובדי מרפאה.
- פורטל לקוחות מאפשר קביעת תורים, צפייה בפנקס חיסונים ותוצאות מעבדה.
- מודל השימוש מתאים לשוק הישראלי: עברית, תזכורות, קשר עם לקוחות, סליקה, חשבשבת/ריווחית.

החלטות לנועה:

- ה-MVP חייב להיות עברי, RTL, Desktop-first ופרקטי למרפאה ישראלית.
- Client portal מלא אינו MVP, אבל תשתית התקשורת, תזכורות, חיסונים ומסמכים צריכה להיבנות כך שתוכל להפוך לפורטל בעתיד.
- חשבוניות, סליקה ומלאי ייבנו כ-basic billing ו-basic inventory בשלבים מוקדמים רק במידה שהם נדרשים לסגירת ביקור.

### ezyVet

ezyVet מייצגת עומק רפואי ותפעולי. נקודות מרכזיות:

- מערכת PIMS מבוססת ענן עם Scheduling, Client Communication, Invoicing & Payments, Task Automation, Business Reporting, Clinical Records, Inventory ו-integrations.
- יש חשיבות חזקה לקישור בין Appointment לבין Clinical Record. לא כל תור הוא בהכרח Clinical Record מוכן מראש; צריך תהליך ברור שממיר תור לביקור ומוודא קשר למטופל.
- Billing triggers ו-Unbilled Items מראים Best Practice: פעולות רפואיות, מוצרים ובדיקות שנוצרו במהלך ביקור צריכים להפוך לפריטי חיוב לבדיקה ולא להישכח.
- AI-Assisted Notes ב-ezyVet עובד כ-draft בלבד: מתחילים הקלטה בהסכמה, AI יוצר SOAP draft, הצוות בודק ועורך, ורק אז מוסיף ל-Clinical Record. יש incomplete notes ויכולת Review later.
- AI Patient Summary מסכם היסטוריה מתוך התיק, אך אינו מחליף שיקול דעת רפואי.

החלטות לנועה:

- Appointment אינו ביקור. `appointments` ו-`visits` יהיו ישויות נפרדות עם קשר 0..1.
- בעת Check In נפתח `visit` עם workspace קליני, ולא רק "סטטוס תור".
- כל פעולה קלינית שיכולה להיות חיובית תיצור `invoice_item` במצב `pending_review`.
- AI תמיד יוצר טיוטה או הצעה. איש צוות מאשר לפני שמידע רפואי מהותי ננעל בתיק.
- יש לתמוך ב-incomplete visit notes, drafts ו-locking של ביקור אחרי סגירה.

### Covetrus Pulse

Covetrus Pulse מייצגת תפיסת Veterinary Operating System:

- מערכת אחת לכל נקודות המגע: pre-visit, check-in, appointment, medical record, communications, prescriptions, diagnostics, payments, inventory, tasks ו-post-appointment.
- Electronic Medical Records כוללים היסטוריית תקשורת, מרשמים, תוצאות דיאגנוסטיקה, רכישות ועוד.
- יש Task Dashboard עם callbacks, to-do items, overdue/due today, filters.
- יש Treatment Board למעקב סטטוס בזמן אמת עם visual alerts.
- יש Client Communications עם online scheduling, automated reminders, texting ותמונות.
- AI מוטמע במערכת וחוסך זמן, כולל SOAP notes ו-workflows אוטומטיים.

החלטות לנועה:

- ה-Dashboard המרכזי צריך להיות clinical command center ולא CRM כללי.
- Task board ו-call follow-ups הם חלק מה-core כי הסוכן הקולי מייצר משימות.
- communication history חייבת להיות מקושרת גם ל-owner וגם ל-pet/visit כאשר יש הקשר רפואי.
- בעת פתיחת תור שנוצר משיחה, נועה רואה את סיכום השיחה, reason, urgency, owner/pet match והיסטוריה רלוונטית.

### Digitail כרפרנס נוסף

Digitail מייצגת UX מודרני ו-AI-native PIMS:

- חלוקה לפי אזורי עבודה: Reception, Exam Room, Treatment Area, Laboratory & Pharmacy, Admin Office, Pet's Home.
- Reception מאחד check-in, appointments, payments ו-messages.
- Lab & Pharmacy מאחדים lab orders, results, prescription management, inventory tracking ו-refill requests.
- Flowboard עוזר לצוות להבין איפה כל מטופל נמצא במסע.
- AI workflows כוללים SOAP dictation, medical record summaries, discharge notes ו-patient intake.

החלטות לנועה:

- במקום תפריט ארוך בלבד, הניווט יתמקד ב-workspaces: היום, יומן, ביקורים, שיחות, לקוחות, משימות, מלאי/חיוב.
- Visit Workspace יהיה מסך העבודה העיקרי של הווטרינר.
- Flowboard בסיסי ייכנס כ-MVP דרך Dashboard "היום"; Treatment Board מלא יידחה.

### Best Practices שנגזרו מההשוואה

1. Veterinary PIMS צריך להתחיל מ-Patient Journey ולא מרשימת פיצ'רים.
2. Owner ו-Pet הם שתי ישויות נפרדות; התיק הרפואי שייך ל-Pet, התקשורת והחיוב בדרך כלל ל-Owner.
3. Appointment הוא התחייבות בלוח הזמנים; Visit הוא האירוע הקליני.
4. Clinical Record חייב להיות מובנה אבל לא איטי: SOAP, vitals, diagnosis, treatment, prescription, labs, instructions.
5. כל מידע שמגיע לפני ביקור, כולל שיחה קולית, צריך להפוך ל-context ולא להיקבר ב-log.
6. AI צריך לקצר תיעוד, חיפוש וסיכום, אך לא לקבל החלטות רפואיות מחייבות.
7. Charges צריכים להיווצר מהפעולות הקליניות כדי למנוע אובדן חיובים, אבל לעבור review לפני חשבונית.
8. משימות, תזכורות ו-follow ups הם חלק מהטיפול, לא מערכת צדדית.
9. Audit ו-permissions קריטיים במערכת רפואית גם במרפאה קטנה.

---

## 2. Product Vision

המערכת של נועה היא Veterinary Practice Management System קטן, מהיר ומדויק, שמחבר את היום הקליני של המרפאה במקום אחד:

Owner -> Pet -> Appointment -> Visit -> Medical Record -> Treatment -> Follow Up -> Billing -> Communication.

המערכת אינה CRM רגיל. היא מערכת עבודה רפואית-תפעולית שבה כל תור, שיחה, משימה, מסמך, בדיקה, חיסון וחיוב מקושרים למטופל ולבעלים הנכונים.

חזון המוצר:

- נועה פותחת את היום ורואה מה דורש טיפול עכשיו.
- שיחות נכנסות מתועדות אוטומטית ומייצרות context לתורים ומשימות.
- ביקור נפתח בלחיצה אחת מתוך התור.
- תיעוד רפואי נעשה מהר, מובנה, וניתן לאישור אנושי.
- שום פעולה חשובה לא הולכת לאיבוד: follow-up, חיוב, בדיקה, מרשם, חיסון, מסמך או שיחה.
- המערכת מתאימה לעברית, ישראל, מרפאה קטנה, וחוויית עבודה בזמן אמת מול לקוח ובעל חיים.

---

## 3. Product Principles

1. Clinical first: המסך הראשי תמיד עונה "מה קורה עם המטופל ומה צריך לעשות עכשיו".
2. Few clicks: פתיחת ביקור, הוספת vital, יצירת follow-up ושליחת הודעה צריכים להיות זמינים במהירות.
3. Source of truth אחד: אין כפילות בין שיחות, תורים, ביקורים ותיקים רפואיים; יש קשרים מפורשים.
4. AI drafts, humans approve: AI מציע, מסכם ומחלץ משימות. הוא לא מאבחן, לא מאשר טיפול ולא שולח הוראה רפואית חדשה ללא אישור.
5. Audit by default: פעולות רפואיות, פיננסיות והרשאות נשמרות עם מי, מתי ומה השתנה.
6. Israel-ready: עברית, RTL, תאריכים ושעות לפי Asia/Jerusalem, SMS/WhatsApp, ובהמשך חשבוניות ישראליות.
7. Graceful incompleteness: ביקור יכול להישאר draft, note יכולה להיות incomplete, והתראות מזכירות להשלים.
8. Fast under pressure: טעינה מהירה, empty states ברורים, וללא מסכים שיווקיים בתוך כלי העבודה.

---

## 4. User Roles

### Owner / Admin

נועה או מנהלת המרפאה. יכולה לנהל צוות, הרשאות, הגדרות, מחירונים, תבניות, מלאי, חיובים, audit ו-AI settings.

### Veterinarian

מנהלת ביקורים רפואיים, מאבחנת, מאשרת טיפולים, מרשמים, סיכומי ביקור והוראות ללקוח.

### Vet Assistant / Nurse

מבצעת check-in, vitals, הכנת מטופל, משימות, תזכורות, העלאת מסמכים, וטיוטות טיפול שאינן דורשות החלטה רפואית סופית.

### Reception

מנהלת שיחות, בעלים, תורים, check-in, תשלומים בסיסיים, הודעות, מסמכים ותזכורות.

### External Owner Portal User - Phase 3

בעלים שיכול לראות חיסונים, תורים, מסמכים, תוצאות מעבדה שאושרו והודעות.

### Voice Agent

שחקן מערכת לא אנושי. יכול לזהות מתקשר, לאתר בעלים וחיה, לבדוק זמינות, לקבוע תור לפי כללים, לפתוח call record, להציע task/follow-up ולסמן דחיפות. אינו מוסמך לבצע פעולה רפואית מהותית.

---

## 5. Permissions

| Capability | Admin | Vet | Assistant | Reception | Voice Agent |
|---|---:|---:|---:|---:|---:|
| View owners/pets | yes | yes | yes | yes | limited |
| Create/update owner | yes | yes | yes | yes | limited |
| Create/update pet | yes | yes | yes | yes | limited |
| Book appointment | yes | yes | yes | yes | yes, constrained |
| Cancel/reschedule appointment | yes | yes | yes | yes | yes, constrained |
| Open visit | yes | yes | yes | no | no |
| Edit anamnesis/vitals | yes | yes | yes | no | no |
| Approve diagnosis | yes | yes | no | no | no |
| Approve treatment | yes | yes | no | no | no |
| Approve prescription | yes | yes | no | no | no |
| Send medical instructions | yes | yes | draft only | no | no |
| View invoices | yes | yes | no | yes | no |
| Edit invoice/payment | yes | no | no | yes | no |
| Manage inventory | yes | yes | limited | no | no |
| Manage settings/users | yes | no | no | no | no |
| View audit log | yes | limited own actions | no | no | no |

Authorization model:

- Every row includes `clinic_id`.
- Staff membership controls access.
- Medical approvals require role `admin` or `veterinarian`.
- Service-role access is restricted to server-only repositories, jobs and webhooks.
- Supabase RLS must be enabled on exposed tables. Policies must combine authentication with clinic membership, not only `TO authenticated`.

---

## 6. Information Architecture & Navigation

Primary navigation:

1. היום
2. יומן
3. ביקורים
4. שיחות
5. לקוחות וחיות
6. משימות
7. מעבדה
8. חיסונים ומניעה
9. מלאי
10. חיובים
11. מסמכים
12. הגדרות

Global surfaces:

- Global Search: בעלים, חיה, טלפון, תור, ביקור, אבחנה, מרשם, מסמך, שיחה.
- Quick Create: בעלים, חיה, תור, משימה, חסימת יומן, מסמך.
- Notifications: משימות באיחור, תורים שמחכים לאישור, ביקורים פתוחים, תוצאות מעבדה, חיסונים קרובים.
- Patient Context Drawer: זמין מכל מסך עם snapshot של חיה, בעלים, alerts, visits אחרונים, חיסונים, בעיות פעילות ותקשורת אחרונה.

---

## 7. Core Workflow

### Recommended Daily Workflow

1. Start Day: נועה פותחת את "היום".
2. Review schedule: תורים לפי שעה, סטטוס, חיה, בעלים, סיבת ביקור, דחיפות ומקור התור.
3. Pre-visit brief: עבור תורים שנוצרו משיחה, מופיע סיכום AI מאושר/טיוטה, transcript, urgency וסיבת פנייה.
4. Check In: Reception או Assistant מסמנים הגעה, מעדכנים בעלים/חיה אם צריך, ומוודאים consent/מסמכים.
5. Open Visit: נוצר `visit` מקושר ל-appointment, pet, owner ו-medical_record.
6. Intake: אנמנזה, vitals, complaint, current medications, allergies, history.
7. Exam: בדיקה גופנית מובנית לפי מערכות.
8. SOAP: Subjective, Objective, Assessment, Plan.
9. Actions: diagnoses, treatments, prescriptions, lab orders, vaccinations, documents.
10. Charges Review: פעולות רפואיות ומוצרים יוצרים חיובים ממתינים.
11. Client Instructions: הוראות ללקוח נכתבות או נוצרות כטיוטת AI ומאושרות.
12. Follow Up: יצירת משימות, תזכורות, חיסון עתידי, שיחת מעקב או ביקורת.
13. Billing: חשבונית בסיסית, תשלום או סימון unpaid.
14. Close Visit: ביקור ננעל, סיכום נשלח לפי אישור, audit נרשם.

### Appointment -> Visit

Appointment הוא ישות scheduling. Visit הוא ישות clinical. Appointment יכול להסתיים בלי Visit אם הלקוח לא הגיע או ביטל. Visit יכול להיווצר ללא Appointment במקרי walk-in או emergency, אך חייב להיות מקושר ל-owner ו-pet.

States:

- appointment: `scheduled`, `confirmed`, `checked_in`, `in_visit`, `completed`, `cancelled`, `no_show`, `pending_approval`
- visit: `draft`, `in_progress`, `ready_for_review`, `closed`, `reopened`

### Check In

Check In כולל:

- אימות בעלים וחיה.
- עדכון טלפון/WhatsApp.
- סימון arrived_at.
- הצגת alerts: אלרגיות, בעיות פעילות, חיסון חסר, balance פתוח, late cancellation.
- פתיחת Visit או העברה ל-waiting.

### Visit Closure

אי אפשר לסגור ביקור אם:

- חסר owner או pet.
- יש AI draft שלא אושר או נדחה.
- יש prescription ללא אישור Vet.
- יש lab order פתוח שלא סומן כ-pending/external/declined.
- יש charge items שלא עברו review, אלא אם המשתמש בחר `close_without_invoice` עם סיבה.

---

## 8. Screen Specifications

### 8.1 Dashboard: היום

מטרה: command center יומי.

משתמשים: נועה, Reception, Assistant.

איך מגיעים: ברירת מחדל אחרי התחברות.

Layout:

- Header: תאריך, מצב מרפאה, כפתורי Quick Create, Global Search.
- Left/primary: Timeline 08:00-20:00 לפי שעות פעילות.
- Right: alerts, tasks due today, pending approvals, recent calls.
- Bottom/secondary: open visits and incomplete notes.

Sections:

- Today's Appointments
- Waiting / Checked In
- In Visit
- Pending Approval
- Call Follow Ups
- Overdue Tasks

Tables/Cards:

- Appointment card: שעה, סטטוס, בעלים, חיה, סוג ביקור, דחיפות, מקור, actions.
- Task card: due, owner/pet, type, assignee, overdue badge.

Filters:

- רופא/איש צוות
- סטטוס
- דחיפות
- מקור: phone, manual, online, follow_up

Actions:

- Check In
- Open Visit
- Call Owner
- Send SMS/WhatsApp
- Reschedule
- Mark No Show
- Create Task

States:

- Empty: "אין תורים להיום" עם Quick Create תור.
- Loading: skeleton timeline.
- Error: retry + technical details collapsed.
- Success: toast קצר לאחר פעולה.

לאחר פעולה:

- Check In מעביר appointment ל-checked_in ומציג Open Visit.
- Open Visit יוצר/פותח visit workspace.
- Reschedule פותח modal עם זמינות.

### 8.2 Calendar

מטרה: ניהול תורים, זמינות וחסימות.

משתמשים: Admin, Vet, Reception, Assistant.

Layout:

- Week view RTL כברירת מחדל.
- Day view לטאבלט.
- Side panel ליצירת/עריכת תור.
- Calendar blocks מוצגים כשכבות חסומות.

Actions:

- Create Appointment
- Drag Reschedule - Phase 2
- Cancel
- Confirm
- Check Availability
- Add Calendar Block

Validation:

- אין תור מחוץ לשעות פעילות.
- אין overlap לפי duration + buffer.
- חלון קביעה של הסוכן: 14 יום קדימה בלבד, אלא אם Admin override.
- neutering נכנס כ-`pending_approval`.

לאחר יצירת תור:

- נוצר appointment.
- נשלחת תזכורת לפי policy.
- אם מקור התור הוא שיחה, נשמר קשר ל-phone_call.

### 8.3 Appointments

מטרה: רשימת תורים ניתנת לחיפוש וסינון.

Tabs:

- Upcoming
- Today
- Pending Approval
- Cancelled/No Show
- Past

Actions:

- Approve pending appointment
- Reject with reason
- Convert to Visit
- View related call
- Send reminder now

### 8.4 Owners

מטרה: ניהול בעלי חיות, תקשורת וחיובים.

Layout:

- Search/list בצד.
- Owner profile drawer/page.
- Tabs: פרטים, חיות, תורים, שיחות, הודעות, מסמכים, חיובים.

Fields:

- name, phone, alternate_phone, email, address, preferred_channel, notes, tags.

Validation:

- טלפון ישראלי מנורמל ל-E.164.
- מניעת כפילויות לפי phone/email עם merge flow.

Actions:

- Add Pet
- Book Appointment
- Send Message
- Merge Duplicate
- Create Task

### 8.5 Pets

מטרה: כרטיס בעל חיים ותיק רפואי.

Layout:

- Header: שם, מין, גזע, גיל, משקל אחרון, owner, alerts.
- Tabs: Overview, Medical Record, Visits, Vaccines, Labs, Prescriptions, Documents, Communications.

Fields:

- name, species, breed, sex, neutered, birthdate/estimated_age, microchip, color, allergies, chronic_conditions, status.

Actions:

- Start Visit
- Add Weight
- Add Alert
- Add Vaccine
- Add Document
- Create Follow Up

### 8.6 Medical Record

מטרה: היסטוריה רפואית כרונולוגית של Pet.

Layout:

- Timeline reverse chronological.
- Filters: visit type, diagnosis, prescription, lab, vaccine, document, communication.
- Side summary: active problems, allergies, current meds, overdue preventive care.

Record types:

- Visit summaries
- SOAP notes
- Diagnoses
- Treatments
- Prescriptions
- Vitals
- Lab results
- Vaccinations
- Documents
- Owner communications

Actions:

- Search within record
- Generate AI patient summary
- Open source visit
- Print/export selected records - Phase 2

AI:

- Summary is draft/supporting view.
- Must link back to source records when possible.
- Must show generation timestamp and reviewer if saved.

### 8.7 Visit Workspace

מטרה: מסך העבודה המרכזי בזמן ביקור.

משתמשים: Vet, Assistant.

Layout:

- Sticky patient header: owner, pet, age, weight, alerts, visit status.
- Left: visit navigation sections.
- Center: active clinical form.
- Right: patient context and source call/pre-visit brief.
- Footer/sticky actions: Save Draft, Ready for Review, Close Visit.

Sections:

1. Reason & Pre-Visit
2. Anamnesis
3. Vitals
4. Physical Examination
5. SOAP
6. Diagnoses
7. Treatments
8. Prescriptions
9. Vaccinations
10. Labs/Diagnostics
11. Client Instructions
12. Charges
13. Follow Up

Buttons:

- Add from Template
- AI Draft SOAP
- AI Draft Client Instructions
- Add Diagnosis
- Add Treatment
- Add Prescription
- Order Lab
- Add Vaccine
- Create Task
- Close Visit

Validation:

- Required minimal close fields: reason, at least one clinical note/SOAP section, owner instructions or explicit "none", billing review state.
- Vitals validate ranges but allow override with reason.
- Prescription requires Vet approval.

States:

- Empty: section-specific prompt.
- Loading: local skeleton, never block whole workspace if only one panel loads.
- Error: preserve unsaved local state and offer retry.
- Success: autosave indicator.

### 8.8 Anamnesis

Purpose:

- תיעוד תלונה עיקרית והיסטוריה כפי שנמסרה על ידי הבעלים.

Fields:

- chief_complaint
- onset
- duration
- progression
- appetite
- drinking
- urination
- defecation
- vomiting/diarrhea/coughing/limping
- current_medications
- known_allergies
- environment/exposure
- owner_concerns

Actions:

- Pull from call summary
- AI clean-up wording
- Save draft

AI boundaries:

- AI רשאי לנסח מחדש את דברי הבעלים.
- AI לא רשאי להוסיף עובדות שלא נאמרו.

### 8.9 Vitals

Fields:

- weight_kg
- temperature_c
- heart_rate_bpm
- respiratory_rate_bpm
- mucous_membrane
- capillary_refill_time
- body_condition_score
- pain_score
- hydration_status

Validation:

- טווחים לפי species.
- חריגה מציגה critical alert אך לא חוסמת שמירה.
- משקל חדש מעדכן latest weight ב-Pet summary.

### 8.10 Physical Examination

Structure:

- General appearance
- Eyes/ears/nose/throat
- Cardiovascular
- Respiratory
- Gastrointestinal
- Musculoskeletal
- Skin/coat
- Neurological
- Urogenital
- Lymph nodes
- Oral/dental

UX:

- Normal/Abnormal toggle לכל מערכת.
- שדה notes נפתח רק כשמסומן abnormal או לפי בחירה.
- Templates לבדיקות שכיחות.

### 8.11 SOAP

Subjective:

- תלונה והיסטוריה מהבעלים.

Objective:

- vitals, physical exam, labs/imaging findings.

Assessment:

- בעיות, אבחנות מבדלות, אבחנות מאושרות.

Plan:

- טיפול, בדיקות, מרשמים, הוראות, follow-up.

Rules:

- SOAP can be AI-drafted.
- Vet must approve before close.
- Approved SOAP creates immutable clinical note version.

### 8.12 Diagnoses

Fields:

- diagnosis_name
- status: suspected, differential, confirmed, ruled_out, resolved
- severity
- notes
- linked_visit_id
- linked_problem_id

Actions:

- Add diagnosis
- Convert to active problem
- Resolve problem

AI:

- AI may suggest problem labels from clinician notes.
- AI cannot mark confirmed diagnosis.

### 8.13 Treatments

Fields:

- treatment_type
- product/procedure
- dose
- route
- frequency
- performed_by
- performed_at
- notes
- billable flag

Workflow:

- Treatment can create invoice_item pending review.
- Product treatment can create inventory_transaction.
- Controlled medication tracking is Phase 3 unless required legally before launch.

### 8.14 Prescriptions

Fields:

- medication
- strength
- dosage
- route
- frequency
- duration
- quantity
- repeats/refills
- instructions_he
- prescribing_vet
- approval_status

Rules:

- Draft may be created by Vet/AI.
- Only Vet/Admin can approve.
- Approved prescription can generate client instructions and billing item.
- Refill request creates task for Vet approval.

### 8.15 Vaccinations & Preventive Care

Fields:

- vaccine_name
- batch_number
- manufacturer
- administered_at
- due_at
- pet_weight_at_time
- administered_by
- reminder_policy

Workflow:

- Giving vaccine updates preventive schedule.
- Reminder is created automatically.
- Owner can receive reminder by SMS/WhatsApp/email according to preference.

### 8.16 Laboratory & Diagnostics

Lab order:

- visit_id, pet_id, owner_id
- lab_type: in_house, external
- status: ordered, sample_collected, sent, resulted, reviewed, cancelled
- tests requested
- due/expected time

Lab result:

- structured values where possible
- PDF/image attachment
- abnormal flag
- reviewed_by Vet
- linked diagnosis/treatment optional

Workflow:

- Lab order can create pending invoice item.
- Result appears in Medical Record only when reviewed or explicitly marked visible.

### 8.17 Documents

Types:

- consent_form
- lab_pdf
- imaging
- discharge_summary
- invoice_pdf
- external_record
- vaccination_certificate

Storage:

- Supabase Storage private bucket.
- Signed URLs from server.
- Documents linked to clinic, owner, pet, visit and optionally invoice/lab.

### 8.18 Tasks

מטרה: לוודא ששיחות, בדיקות, מעקבים ומשימות צוות לא הולכים לאיבוד.

Fields:

- title
- type: callback, lab_review, prescription_refill, follow_up, admin, billing, inventory
- status: open, in_progress, done, cancelled
- priority
- due_at
- assignee_id
- owner_id/pet_id/visit_id
- source_type/source_id

Views:

- My Tasks
- Due Today
- Overdue
- By Patient
- From Calls

### 8.19 Follow Ups

Types:

- medical_recheck
- phone_callback
- vaccination_due
- lab_result_review
- post_treatment_check
- medication_refill

Workflow:

- Created during visit close or from call.
- Can generate appointment suggestion, reminder, task or communication.
- Follow-up can be closed with outcome.

### 8.20 Reminders

Channels:

- SMS
- WhatsApp - Phase 2
- Email - Phase 2

Trigger types:

- appointment reminder
- arrival reminder
- vaccination due
- follow-up due
- unpaid invoice - Phase 2

Rules:

- Reminder templates are controlled.
- Medical content requires approval.
- System logs delivery status and failures.

### 8.21 Client Communications

Channels:

- phone
- SMS
- WhatsApp
- email
- in-person note

Communication record:

- linked owner
- optional pet
- optional visit
- direction
- channel
- content summary
- attachments
- staff/system actor

Actions:

- Send message from template
- Log call
- Attach to visit
- Create follow-up task

### 8.22 Phone Calls & Voice Agent

Incoming Call workflow:

1. Twilio receives call.
2. Voice Agent answers in Hebrew.
3. Caller identification by normalized phone.
4. Owner matching.
5. Pet identification if multiple pets.
6. Reason for call.
7. Urgency classification.
8. Availability check if appointment needed.
9. Booking, waitlist, escalation or callback task.
10. Transcript and recording saved.
11. AI summary created.
12. CRM activity and appointment/task links created.

When Noa opens the appointment:

- Visit Pre-Brief shows reason, urgency, transcript summary, pet match confidence, caller notes and source call.
- If urgent, red alert appears at top of appointment and visit workspace.

Voice Agent constraints:

- May book only allowed visit types within configured window.
- May not diagnose.
- May not provide new medical instructions beyond approved scripts.
- Must escalate emergency/red flags.
- Must create task when uncertain.

### 8.23 Inventory

MVP scope:

- Basic item catalog.
- Stock on hand.
- Manual adjustment.
- Automatic decrement from approved treatment/prescription/vaccine where configured.

Phase 2/3:

- suppliers
- purchase orders
- batch/expiry
- controlled medication logs
- reorder rules

### 8.24 Basic Billing

MVP scope:

- Invoice draft from visit charges.
- Manual line items.
- Mark paid/unpaid.
- Payment method: cash, credit_external, bit, bank_transfer, other.
- No full Israeli tax integration in MVP unless required before live use.

Workflow:

- Medical actions create `invoice_items.pending_review`.
- Reception/Admin reviews and finalizes invoice.
- Payment creates audit log.

### 8.25 Notifications

Types:

- appointment_pending_approval
- visit_note_incomplete
- lab_result_needs_review
- overdue_task
- urgent_call
- stock_low
- failed_sms

UX:

- Bell menu.
- Dashboard blocks.
- Patient-level alerts.

### 8.26 Global Search

Search targets:

- owners
- pets
- phone numbers
- appointments
- visits
- diagnoses
- prescriptions
- lab results
- documents
- call summaries

UX:

- Keyboard shortcut: `/` or Cmd+K.
- Results grouped by type.
- Recent records first.
- Hebrew tolerant search and phone normalization.

### 8.27 Audit Log

Tracks:

- medical changes
- visit close/reopen
- prescription approval
- invoice/payment changes
- role changes
- AI draft approval/rejection
- webhook-created actions

Fields:

- actor_type, actor_id, action, entity_type, entity_id, before, after, ip, user_agent, created_at.

### 8.28 Settings

Sections:

- Clinic profile
- Staff & roles
- Appointment types
- Working hours
- Calendar blocks
- Reminder templates
- SMS/WhatsApp settings
- Voice Agent settings
- AI settings
- Billing settings
- Inventory settings
- Audit/export

---

## 9. Database Schema

### Global conventions

All clinic-owned tables include:

- `id uuid primary key default gen_random_uuid()`
- `clinic_id uuid not null references clinics(id)`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- `created_by uuid null references staff(id)`
- `updated_by uuid null references staff(id)`
- `deleted_at timestamptz null` when soft delete is required

Recommended enums:

- `staff_role`: admin, veterinarian, assistant, reception
- `appointment_status`: scheduled, confirmed, checked_in, in_visit, completed, cancelled, no_show, pending_approval
- `visit_status`: draft, in_progress, ready_for_review, closed, reopened
- `communication_channel`: phone, sms, whatsapp, email, in_person, system
- `task_status`: open, in_progress, done, cancelled
- `task_priority`: low, normal, high, urgent
- `ai_artifact_status`: draft, approved, rejected, superseded
- `invoice_status`: draft, pending_review, issued, paid, void, refunded
- `payment_status`: pending, succeeded, failed, refunded

### `users`

Purpose: identity bridge to Supabase Auth.

Columns:

- `id uuid primary key` references `auth.users(id)`
- `email text not null`
- `display_name text`
- `app_metadata jsonb not null default '{}'`
- `created_at timestamptz`
- `updated_at timestamptz`

Indexes:

- unique `email`

Audit:

- role changes audited through `staff` and `audit_logs`.

### `staff`

Purpose: clinic staff membership and permissions.

Columns:

- global columns
- `user_id uuid not null references users(id)`
- `role staff_role not null`
- `active boolean not null default true`
- `license_number text`
- `phone text`

Indexes:

- unique `(clinic_id, user_id)`
- `(clinic_id, role)`

### `owners`

Purpose: pet owners/clients.

Columns:

- global columns
- `full_name text not null`
- `phone_e164 text not null`
- `alternate_phone_e164 text`
- `email text`
- `address text`
- `preferred_channel communication_channel default 'phone'`
- `notes text`
- `tags text[] default '{}'`

Indexes:

- unique `(clinic_id, phone_e164)` where `deleted_at is null`
- `(clinic_id, full_name)`

Constraints:

- phone normalized to E.164.

### `pets`

Purpose: animal patients.

Columns:

- global columns
- `owner_id uuid not null references owners(id)`
- `name text not null`
- `species text not null`
- `breed text`
- `sex text`
- `neutered boolean`
- `birthdate date`
- `estimated_age text`
- `microchip text`
- `color text`
- `status text not null default 'active'`
- `allergies text[] default '{}'`
- `chronic_conditions text[] default '{}'`
- `latest_weight_kg numeric(6,2)`

Indexes:

- `(clinic_id, owner_id)`
- `(clinic_id, name)`
- unique `(clinic_id, microchip)` where `microchip is not null`

### `appointments`

Purpose: scheduled time block.

Columns:

- global columns
- `owner_id uuid not null references owners(id)`
- `pet_id uuid not null references pets(id)`
- `visit_id uuid null`
- `status appointment_status not null default 'scheduled'`
- `visit_type text not null`
- `starts_at timestamptz not null`
- `ends_at timestamptz not null`
- `duration_minutes int not null`
- `reason text`
- `source text not null default 'manual'`
- `source_phone_call_id uuid null references phone_calls(id)`
- `assigned_staff_id uuid references staff(id)`
- `urgency text default 'routine'`
- `checked_in_at timestamptz`
- `cancelled_at timestamptz`
- `cancel_reason text`

Indexes:

- `(clinic_id, starts_at)`
- `(clinic_id, pet_id, starts_at desc)`
- exclusion/no-overlap constraint by clinic/resource/time where status is active.

### `visits`

Purpose: clinical encounter.

Columns:

- global columns
- `appointment_id uuid null references appointments(id)`
- `owner_id uuid not null references owners(id)`
- `pet_id uuid not null references pets(id)`
- `medical_record_id uuid not null references medical_records(id)`
- `status visit_status not null default 'draft'`
- `reason text`
- `visit_type text`
- `started_at timestamptz`
- `closed_at timestamptz`
- `closed_by uuid references staff(id)`
- `reopened_reason text`
- `source_phone_call_id uuid references phone_calls(id)`

Indexes:

- `(clinic_id, pet_id, started_at desc)`
- unique `(clinic_id, appointment_id)` where `appointment_id is not null`

### `medical_records`

Purpose: longitudinal medical record per pet.

Columns:

- global columns
- `pet_id uuid not null references pets(id)`
- `summary text`
- `active_problem_list jsonb not null default '[]'`
- `alerts jsonb not null default '[]'`

Indexes:

- unique `(clinic_id, pet_id)`

### `clinical_notes`

Purpose: SOAP and structured clinical documentation.

Columns:

- global columns
- `visit_id uuid not null references visits(id)`
- `pet_id uuid not null references pets(id)`
- `note_type text not null` -- soap, anamnesis, exam, instruction, general
- `subjective text`
- `objective text`
- `assessment text`
- `plan text`
- `content jsonb not null default '{}'`
- `status text not null default 'draft'`
- `approved_by uuid references staff(id)`
- `approved_at timestamptz`
- `version int not null default 1`

Indexes:

- `(clinic_id, visit_id)`
- `(clinic_id, pet_id, created_at desc)`

### `vitals`

Purpose: structured vital measurements.

Columns:

- global columns
- `visit_id uuid references visits(id)`
- `pet_id uuid not null references pets(id)`
- `weight_kg numeric(6,2)`
- `temperature_c numeric(4,1)`
- `heart_rate_bpm int`
- `respiratory_rate_bpm int`
- `body_condition_score numeric(3,1)`
- `pain_score int`
- `hydration_status text`
- `measured_at timestamptz not null default now()`

Indexes:

- `(clinic_id, pet_id, measured_at desc)`

### `diagnoses`

Purpose: diagnoses and problem list entries.

Columns:

- global columns
- `visit_id uuid references visits(id)`
- `pet_id uuid not null references pets(id)`
- `name text not null`
- `status text not null`
- `severity text`
- `notes text`
- `is_active_problem boolean not null default false`
- `resolved_at timestamptz`
- `approved_by uuid references staff(id)`

Indexes:

- `(clinic_id, pet_id, status)`

### `treatments`

Purpose: procedures/treatments performed or planned.

Columns:

- global columns
- `visit_id uuid not null references visits(id)`
- `pet_id uuid not null references pets(id)`
- `treatment_name text not null`
- `treatment_type text not null`
- `inventory_item_id uuid references inventory_items(id)`
- `dose text`
- `route text`
- `performed_at timestamptz`
- `performed_by uuid references staff(id)`
- `billable boolean not null default true`
- `notes text`

Indexes:

- `(clinic_id, visit_id)`

### `prescriptions`

Purpose: approved or draft prescriptions.

Columns:

- global columns
- `visit_id uuid references visits(id)`
- `pet_id uuid not null references pets(id)`
- `owner_id uuid not null references owners(id)`
- `status text not null default 'draft'`
- `prescribing_staff_id uuid references staff(id)`
- `approved_by uuid references staff(id)`
- `approved_at timestamptz`
- `instructions_he text`

Indexes:

- `(clinic_id, pet_id, created_at desc)`

### `prescription_items`

Purpose: medication lines inside prescription.

Columns:

- `id uuid primary key default gen_random_uuid()`
- `prescription_id uuid not null references prescriptions(id) on delete cascade`
- `inventory_item_id uuid references inventory_items(id)`
- `medication_name text not null`
- `strength text`
- `dosage text not null`
- `route text`
- `frequency text`
- `duration text`
- `quantity numeric(10,2)`
- `refills int default 0`
- `created_at timestamptz default now()`

### `vaccinations`

Purpose: administered vaccines and due schedule.

Columns:

- global columns
- `visit_id uuid references visits(id)`
- `pet_id uuid not null references pets(id)`
- `vaccine_name text not null`
- `manufacturer text`
- `batch_number text`
- `administered_at timestamptz`
- `due_at timestamptz`
- `administered_by uuid references staff(id)`
- `inventory_item_id uuid references inventory_items(id)`
- `reminder_id uuid references reminders(id)`

Indexes:

- `(clinic_id, pet_id, administered_at desc)`
- `(clinic_id, due_at)`

### `lab_orders`

Purpose: diagnostic orders.

Columns:

- global columns
- `visit_id uuid references visits(id)`
- `pet_id uuid not null references pets(id)`
- `owner_id uuid not null references owners(id)`
- `status text not null default 'ordered'`
- `lab_type text not null`
- `tests jsonb not null default '[]'`
- `ordered_by uuid references staff(id)`
- `ordered_at timestamptz default now()`
- `expected_at timestamptz`

Indexes:

- `(clinic_id, status, ordered_at desc)`

### `lab_results`

Purpose: result values/files linked to lab order and patient.

Columns:

- global columns
- `lab_order_id uuid references lab_orders(id)`
- `visit_id uuid references visits(id)`
- `pet_id uuid not null references pets(id)`
- `result_data jsonb not null default '{}'`
- `summary text`
- `abnormal boolean`
- `document_id uuid references documents(id)`
- `reviewed_by uuid references staff(id)`
- `reviewed_at timestamptz`

Indexes:

- `(clinic_id, pet_id, created_at desc)`
- `(clinic_id, reviewed_at)` where `reviewed_at is null`

### `documents`

Purpose: private files and generated PDFs.

Columns:

- global columns
- `owner_id uuid references owners(id)`
- `pet_id uuid references pets(id)`
- `visit_id uuid references visits(id)`
- `document_type text not null`
- `title text not null`
- `storage_bucket text not null`
- `storage_path text not null`
- `mime_type text`
- `size_bytes bigint`
- `uploaded_by uuid references staff(id)`

Indexes:

- `(clinic_id, pet_id, created_at desc)`

### `tasks`

Purpose: callbacks, follow-ups and operational work.

Columns:

- global columns
- `title text not null`
- `description text`
- `type text not null`
- `status task_status not null default 'open'`
- `priority task_priority not null default 'normal'`
- `due_at timestamptz`
- `assignee_id uuid references staff(id)`
- `owner_id uuid references owners(id)`
- `pet_id uuid references pets(id)`
- `visit_id uuid references visits(id)`
- `source_type text`
- `source_id uuid`
- `completed_at timestamptz`

Indexes:

- `(clinic_id, status, due_at)`
- `(clinic_id, assignee_id, status)`

### `follow_ups`

Purpose: medical and operational follow-up commitments.

Columns:

- global columns
- `owner_id uuid not null references owners(id)`
- `pet_id uuid not null references pets(id)`
- `visit_id uuid references visits(id)`
- `type text not null`
- `status text not null default 'open'`
- `due_at timestamptz not null`
- `instructions text`
- `task_id uuid references tasks(id)`
- `appointment_id uuid references appointments(id)`
- `outcome text`

Indexes:

- `(clinic_id, due_at, status)`

### `communications`

Purpose: all owner communication history.

Columns:

- global columns
- `owner_id uuid not null references owners(id)`
- `pet_id uuid references pets(id)`
- `visit_id uuid references visits(id)`
- `channel communication_channel not null`
- `direction text not null`
- `subject text`
- `body text`
- `summary text`
- `status text`
- `sent_at timestamptz`
- `external_id text`

Indexes:

- `(clinic_id, owner_id, created_at desc)`
- `(clinic_id, pet_id, created_at desc)`

### `phone_calls`

Purpose: inbound/outbound call records.

Columns:

- global columns
- `owner_id uuid references owners(id)`
- `pet_id uuid references pets(id)`
- `appointment_id uuid references appointments(id)`
- `visit_id uuid references visits(id)`
- `direction text not null`
- `from_phone_e164 text`
- `to_phone_e164 text`
- `status text`
- `started_at timestamptz`
- `ended_at timestamptz`
- `duration_seconds int`
- `recording_storage_path text`
- `urgency text`
- `reason text`
- `agent_confidence numeric(4,3)`
- `external_call_id text`

Indexes:

- `(clinic_id, started_at desc)`
- `(clinic_id, from_phone_e164)`

### `call_transcripts`

Purpose: transcript text and structured utterances.

Columns:

- global columns
- `phone_call_id uuid not null references phone_calls(id)`
- `language text default 'he'`
- `transcript_text text`
- `utterances jsonb not null default '[]'`
- `redacted boolean not null default false`

Indexes:

- unique `(clinic_id, phone_call_id)`

### `ai_summaries`

Purpose: AI artifacts for calls, patients, visits and instructions.

Columns:

- global columns
- `entity_type text not null`
- `entity_id uuid not null`
- `summary_type text not null`
- `status ai_artifact_status not null default 'draft'`
- `content text not null`
- `structured_content jsonb not null default '{}'`
- `model text`
- `prompt_version text`
- `source_refs jsonb not null default '[]'`
- `reviewed_by uuid references staff(id)`
- `reviewed_at timestamptz`
- `rejected_reason text`

Indexes:

- `(clinic_id, entity_type, entity_id)`
- `(clinic_id, status, created_at desc)`

### `reminders`

Purpose: scheduled reminders.

Columns:

- global columns
- `owner_id uuid references owners(id)`
- `pet_id uuid references pets(id)`
- `appointment_id uuid references appointments(id)`
- `follow_up_id uuid references follow_ups(id)`
- `type text not null`
- `channel communication_channel not null`
- `scheduled_at timestamptz not null`
- `status text not null default 'pending'`
- `template_key text`
- `payload jsonb not null default '{}'`
- `sent_at timestamptz`
- `failed_reason text`

Indexes:

- `(clinic_id, status, scheduled_at)`

### `inventory_items`

Purpose: products, medications and services that affect stock/billing.

Columns:

- global columns
- `sku text`
- `name text not null`
- `category text not null`
- `unit text`
- `stock_quantity numeric(12,2) default 0`
- `reorder_level numeric(12,2)`
- `cost_price numeric(12,2)`
- `sell_price numeric(12,2)`
- `track_stock boolean not null default true`
- `active boolean not null default true`

Indexes:

- `(clinic_id, name)`
- unique `(clinic_id, sku)` where `sku is not null`

### `inventory_transactions`

Purpose: stock movements.

Columns:

- global columns
- `inventory_item_id uuid not null references inventory_items(id)`
- `type text not null` -- adjustment, treatment_use, prescription_dispense, vaccine_use, purchase
- `quantity_delta numeric(12,2) not null`
- `reason text`
- `visit_id uuid references visits(id)`
- `invoice_item_id uuid references invoice_items(id)`

Indexes:

- `(clinic_id, inventory_item_id, created_at desc)`

### `invoices`

Purpose: basic billing document.

Columns:

- global columns
- `owner_id uuid not null references owners(id)`
- `visit_id uuid references visits(id)`
- `status invoice_status not null default 'draft'`
- `invoice_number text`
- `subtotal numeric(12,2) not null default 0`
- `tax_amount numeric(12,2) not null default 0`
- `total numeric(12,2) not null default 0`
- `issued_at timestamptz`
- `paid_at timestamptz`

Indexes:

- `(clinic_id, owner_id, created_at desc)`
- unique `(clinic_id, invoice_number)` where `invoice_number is not null`

### `invoice_items`

Purpose: billable lines, many created from clinical actions.

Columns:

- global columns
- `invoice_id uuid references invoices(id)`
- `visit_id uuid references visits(id)`
- `source_type text`
- `source_id uuid`
- `description text not null`
- `quantity numeric(10,2) not null default 1`
- `unit_price numeric(12,2) not null default 0`
- `total numeric(12,2) not null default 0`
- `review_status text not null default 'pending_review'`

Indexes:

- `(clinic_id, visit_id, review_status)`

### `payments`

Purpose: payment records.

Columns:

- global columns
- `invoice_id uuid not null references invoices(id)`
- `owner_id uuid not null references owners(id)`
- `amount numeric(12,2) not null`
- `method text not null`
- `status payment_status not null default 'pending'`
- `paid_at timestamptz`
- `external_id text`
- `notes text`

Indexes:

- `(clinic_id, invoice_id)`

### `audit_logs`

Purpose: immutable audit trail.

Columns:

- `id uuid primary key default gen_random_uuid()`
- `clinic_id uuid not null references clinics(id)`
- `actor_type text not null`
- `actor_id uuid`
- `action text not null`
- `entity_type text not null`
- `entity_id uuid not null`
- `before jsonb`
- `after jsonb`
- `ip inet`
- `user_agent text`
- `created_at timestamptz not null default now()`

Indexes:

- `(clinic_id, entity_type, entity_id, created_at desc)`
- `(clinic_id, actor_id, created_at desc)`

---

## 10. Relationships

- Clinic 1:N Staff
- Clinic 1:N Owners
- Owner 1:N Pets
- Pet 1:1 Medical Record
- Pet 1:N Appointments
- Owner 1:N Appointments
- Appointment 0..1:1 Visit
- Pet 1:N Visits
- Visit 1:N Clinical Notes
- Visit 1:N Vitals
- Visit 1:N Diagnoses
- Visit 1:N Treatments
- Visit 1:N Prescriptions
- Prescription 1:N Prescription Items
- Pet 1:N Vaccinations
- Visit 1:N Lab Orders
- Lab Order 0..N Lab Results
- Pet 1:N Documents
- Owner 1:N Communications
- Phone Call 0..1 Appointment
- Phone Call 0..1 Visit
- Phone Call 1:1 Call Transcript
- Any supported entity 1:N AI Summaries
- Visit 1:N Invoice Items
- Owner 1:N Invoices
- Invoice 1:N Invoice Items
- Invoice 1:N Payments
- Pet/Owner/Visit 1:N Tasks
- Follow Up 0..1 Task
- Follow Up 0..1 Appointment

Important modeling choices:

- Medical history belongs to Pet.
- Billing and communication are owner-facing but can be linked to Pet/Visit.
- Phone calls are first-class records, not only communications, because they include transcript, recording, urgency and agent metadata.
- AI summaries are polymorphic artifacts with explicit status and reviewer.
- Inventory transactions are append-only; stock is derived or updated through controlled service logic.

---

## 11. Backend Architecture

### Application layers

UI -> tRPC Router/API Route -> Service -> Repository -> Supabase/PostgreSQL

Rules:

- UI never talks directly to service-role Supabase.
- Services enforce business rules.
- Repositories are thin data access wrappers.
- Runtime validation with Zod at every API boundary.
- Every mutation writes audit logs for medical/financial/security entities.

### Modules

#### Auth Module

- Supabase Auth session handling.
- `requireAuth`.
- Staff membership lookup.
- Role checks.

APIs:

- `auth.me`
- `staff.list`
- `staff.invite`
- `staff.updateRole`

#### Owner/Pet Module

Services:

- OwnerService
- PetService
- DuplicateDetectionService

tRPC:

- `owners.search`
- `owners.get`
- `owners.create`
- `owners.update`
- `owners.merge`
- `pets.get`
- `pets.create`
- `pets.update`
- `pets.timeline`

#### Calendar/Appointments Module

Services:

- CalendarService
- AppointmentService
- AvailabilityService

tRPC:

- `calendar.week`
- `appointments.create`
- `appointments.update`
- `appointments.checkIn`
- `appointments.cancel`
- `appointments.reschedule`
- `appointments.approvePending`
- `calendarBlocks.create`

Realtime:

- appointment status changes.
- checked-in and in-visit updates.

#### Visit/Medical Record Module

Services:

- VisitService
- MedicalRecordService
- ClinicalNoteService
- VisitClosureService

tRPC:

- `visits.openFromAppointment`
- `visits.createWalkIn`
- `visits.getWorkspace`
- `visits.saveSection`
- `visits.readyForReview`
- `visits.close`
- `medicalRecord.timeline`
- `medicalRecord.search`

Autosave:

- Debounced saves per section.
- Conflict detection with `updated_at` and version.

#### Clinical Actions Module

Services:

- DiagnosisService
- TreatmentService
- PrescriptionService
- VaccinationService
- LabService

tRPC:

- `diagnoses.add`
- `treatments.add`
- `prescriptions.createDraft`
- `prescriptions.approve`
- `vaccinations.record`
- `labOrders.create`
- `labResults.review`

#### Billing Module

Services:

- ChargeCaptureService
- InvoiceService
- PaymentService

tRPC:

- `charges.forVisit`
- `charges.review`
- `invoices.createFromVisit`
- `invoices.issue`
- `payments.record`

#### Communications Module

Services:

- CommunicationService
- SMSService
- WhatsAppService - Phase 2
- ReminderService

tRPC:

- `communications.timeline`
- `communications.sendSms`
- `communications.logManual`
- `reminders.create`
- `reminders.cancel`

#### Voice Agent Module

Existing/recommended Hono endpoints:

- `POST /twilio/voice`
- `POST /hooks/call-ended`
- `POST /tools/lookup-customer`
- `POST /tools/check-availability`
- `POST /tools/book-appointment`
- `POST /tools/escalate-to-noa`
- `POST /tools/join-waitlist`
- `POST /tools/triage-pet-case`

Additional recommended APIs:

- `POST /tools/create-follow-up-task`
- `POST /tools/update-call-context`

Rules:

- Tool responses stay `{ result: string }`.
- Webhooks are idempotent by external call id.
- Post-call processing is fire-and-forget when possible.

#### AI Module

Services:

- AiSummaryService
- AiVisitDraftService
- AiTaskExtractionService
- AiSearchService
- AiSafetyPolicyService

APIs:

- `ai.generatePreVisitBrief`
- `ai.draftSoap`
- `ai.draftClientInstructions`
- `ai.extractTasksFromCall`
- `ai.patientSummary`
- `ai.approveArtifact`
- `ai.rejectArtifact`

Storage:

- `ai_summaries`
- source refs to visits, calls, transcripts and medical record entries.

#### Inventory Module

Services:

- InventoryItemService
- InventoryTransactionService
- StockReconciliationService

tRPC:

- `inventory.list`
- `inventory.create`
- `inventory.adjust`
- `inventory.lowStock`

### Background Jobs

Use Redis + BullMQ only when Vercel/Supabase cron and DB-backed queues are not enough.

MVP jobs:

- Process SMS reminders every 15 minutes.
- Process call-ended enrichment.
- Generate AI call summaries.
- Create vaccination due reminders.
- Detect incomplete visits at end of day.

Phase 2 jobs:

- WhatsApp delivery reconciliation.
- Lab integration polling.
- Inventory reorder suggestions.
- AI search index refresh if pgvector/vector search is used.

### Webhooks

- ElevenLabs post-call webhook.
- Twilio call status.
- Twilio SMS status.
- Future: WhatsApp delivery status.
- Future: lab provider result webhook.
- Future: payment provider webhook.

### Cron Jobs

- `process-sms-notifications`: every 15 minutes.
- `generate-vaccination-reminders`: daily 07:00 Asia/Jerusalem.
- `visit-completion-audit`: daily 21:00.
- `inventory-low-stock-check`: daily 06:00 Phase 2.

### Realtime Events

Supabase Realtime channels:

- `clinic:{clinic_id}:appointments`
- `clinic:{clinic_id}:tasks`
- `clinic:{clinic_id}:visits`
- `clinic:{clinic_id}:calls`

Use for dashboard updates, but do not rely on realtime as source of truth.

### File Storage

Buckets:

- `call-recordings` private
- `documents` private
- `lab-results` private

Access:

- Signed URLs generated by server.
- Audit each download for medical documents and recordings.

### Authentication & Authorization

- Supabase Auth.
- Server-side session validation.
- Staff membership required for clinic access.
- RLS on every exposed table.
- Admin repositories only for server-only jobs/webhooks after validating clinic ownership/membership or signed webhook source.

### Audit Logging

Each service mutation accepts actor context:

- user staff actor
- voice_agent actor
- system_job actor
- external_webhook actor

Medical and financial changes must include before/after where reasonable.

---

## 12. AI Layer

### Approved AI Capabilities

1. AI Pre-Visit Brief
   - Summarizes recent visits, active problems, allergies, current meds, due vaccines, open tasks and latest call.

2. Call Summary
   - Summarizes incoming call, reason, urgency, requested action and caller sentiment.

3. Draft SOAP
   - Converts clinician notes/transcript into SOAP draft.

4. Draft Visit Summary
   - Creates short summary for owner after Vet approval.

5. Draft Client Instructions
   - Rewrites Vet-approved plan into clear Hebrew instructions.

6. Follow-Up Suggestions
   - Suggests callback/recheck/reminder from plan.

7. Task Extraction
   - Extracts operational tasks from calls, visit notes and lab results.

8. Medical Record Search
   - Finds relevant historical snippets and links to source records.

9. Charge Capture Suggestions
   - Suggests billable items from visit actions/transcript as pending review.

### AI Prohibited Actions

AI must not independently:

- diagnose
- confirm diagnosis
- approve treatment
- create binding prescription
- change material medical record data
- send new medical instructions
- override urgency red flags
- delete or hide source records
- finalize invoice based only on inferred charges

### Human Approval Rules

Requires Vet/Admin approval:

- Diagnosis confirmation
- Prescription approval
- Treatment plan approval
- Client medical instructions
- Visit close
- AI-generated SOAP insertion into official clinical note

Requires Reception/Admin approval:

- invoice issue
- payment correction
- owner merge

### AI Artifact Lifecycle

`draft -> approved | rejected -> superseded`

Each artifact stores:

- model
- prompt_version
- source_refs
- generated_at
- reviewed_by
- reviewed_at
- rejection reason if rejected

---

## 13. UX Requirements

### Language and Layout

- Hebrew interface.
- RTL by default.
- Dates and times in Israel format.
- Medical codes/English terms allowed where standard.

### Performance

- Dashboard initial useful render under 2 seconds on normal connection.
- Visit Workspace section save under 500ms perceived latency with optimistic/autosave.
- Global Search returns top results under 500ms for common queries.

### Clinical Hierarchy

Patient header always shows:

- pet name
- owner
- species/breed
- age
- latest weight
- allergies/critical alerts
- active problems

Critical alerts:

- visually prominent
- never hidden inside tabs
- included in pre-visit and visit workspace

### Desktop First, Tablet Friendly

- Desktop: split panes.
- Tablet: collapsible right context panel.
- Mobile: only basic lookup/urgent actions Phase 2.

### Keyboard

- Global Search shortcut.
- Save draft shortcut.
- Move between visit sections.
- Quick add vital/task.

---

## 14. MVP / Phase 2 / Phase 3

### MVP

Goal: מערכת שנועה יכולה לעבוד איתה בפועל ביומיום עם שיחות, תורים, ביקורים ותיעוד רפואי בסיסי.

Includes:

- Auth/staff/roles.
- Owners and pets.
- Calendar and appointments.
- Check-in.
- Visit Workspace with anamnesis, vitals, exam, SOAP, diagnoses, treatments, prescriptions draft/approval.
- Medical record timeline.
- Voice Agent integration: calls, transcript, summary, appointment/task linkage.
- Tasks and follow-ups.
- Vaccinations basic reminders.
- Lab orders/results manual entry.
- Documents upload.
- Basic billing from visit charges.
- Basic inventory item tracking for vaccines/medications used.
- Audit log.
- AI drafts and summaries with human approval.

Why MVP:

- This covers the actual clinical day from phone call to visit close.
- It avoids building client portal, deep accounting, advanced procurement and integrations before the clinic has a working operational core.

### Phase 2

Includes:

- WhatsApp integration.
- Client portal light.
- Payment provider integration.
- Israeli invoice provider integration.
- Advanced calendar drag/drop.
- Treatment board/flowboard.
- Lab provider integrations.
- Better duplicate merge.
- Advanced templates.
- Owner-facing vaccination certificates.

Why Phase 2:

- These improve automation and owner experience after core workflows are stable.

### Phase 3

Includes:

- Multi-branch support.
- Full inventory procurement, suppliers, batch/expiry, controlled drug logs.
- Advanced reporting/BI.
- Care plans/subscriptions.
- Mobile app for pet owners.
- AI semantic search/vector search.
- Advanced role policies and external collaborators.

Why Phase 3:

- These are valuable but increase operational, legal and integration complexity.

---

## 15. Implementation Plan

### Phase 0: Foundation

Build:

- Confirm repo structure.
- Strict TypeScript baseline.
- Shared UI shell, RTL, design tokens.
- Auth guard and service factory pattern.
- Base tRPC setup if not already present.

Tables:

- clinics, users, staff, audit_logs if missing or aligned.

APIs:

- `auth.me`
- `staff.current`

Components:

- AppShell, Sidebar, Header, Button, Badge, Modal, Drawer, Toast, EmptyState, Skeleton.

Screens:

- Login
- Dashboard shell

Dependencies:

- Supabase env.
- Existing Next.js app.

Acceptance Criteria:

- User can log in and see protected shell.
- RTL works globally.
- Unauthorized access redirects.

Tests:

- Auth guard unit tests.
- Basic route protection tests.

Definition of Done:

- Lint, typecheck, unit tests pass.
- No secrets committed.

### Phase 1: Database Core

Build:

- Schema migrations for normalized PIMS entities.
- RLS policies by clinic membership.
- Updated_at triggers.
- Audit helper.

Tables:

- owners, pets, medical_records, appointments, visits, clinical_notes, vitals, tasks, communications, phone_calls, call_transcripts, ai_summaries.

APIs:

- none or thin repository tests first.

Components/Screens:

- none.

Dependencies:

- Supabase CLI/project access.

Acceptance Criteria:

- Tables migrate cleanly.
- RLS prevents cross-clinic access.
- Admin/service paths are explicit.

Tests:

- Repository tests.
- RLS policy tests where available.

Definition of Done:

- Migration applied locally.
- Security review of RLS.

### Phase 2: Owners + Pets

Build:

- Owner search/create/edit.
- Pet create/edit.
- Duplicate warning by phone.
- Pet overview and medical record shell.

Tables:

- owners, pets, medical_records, communications.

APIs:

- `owners.search/create/update/get`
- `pets.create/update/get`

Components:

- OwnerSearch, OwnerProfile, PetCard, PetHeader, PatientContextDrawer.

Screens:

- לקוחות וחיות
- Pet profile

Acceptance Criteria:

- Create owner and pet in under one minute.
- Search by Hebrew name and phone.
- Pet profile always links back to owner.

Tests:

- Validators.
- Service/repository tests.
- UI happy-path tests.

### Phase 3: Calendar + Appointments

Build:

- Week/day calendar.
- Appointment creation.
- Availability calculation.
- Status transitions.
- Pending approval for neutering.

Tables:

- appointments, calendar_blocks, reminders.

APIs:

- `calendar.week`
- `appointments.create/reschedule/cancel/checkIn/approvePending`
- `availability.check`

Components:

- WeekCalendar, AppointmentCard, AppointmentModal, AvailabilityPicker, CalendarBlockForm.

Screens:

- יומן
- Appointment details drawer

Acceptance Criteria:

- No overlapping active appointments.
- Appointment status transitions are audited.
- Voice-agent-compatible availability rules exist.

Tests:

- Slot generation.
- Business hours.
- Overlap prevention.
- Pending approval flow.

### Phase 4: Medical Record

Build:

- Medical record timeline.
- Filters and search.
- Visit summary cards.
- Vitals history.

Tables:

- visits, clinical_notes, vitals, diagnoses, treatments, prescriptions, vaccinations, lab_results, documents.

APIs:

- `medicalRecord.timeline`
- `medicalRecord.search`

Components:

- MedicalTimeline, RecordFilterBar, ActiveProblems, AlertBanner, VitalsTrend.

Screens:

- Pet Medical Record tab.

Acceptance Criteria:

- Timeline shows all record types correctly.
- Record entries link to source visit.

Tests:

- Timeline query ordering.
- Filter logic.

### Phase 5: Visit Workspace

Build:

- Open visit from appointment.
- Anamnesis, vitals, physical exam, SOAP.
- Autosave drafts.
- Close visit validation.

Tables:

- visits, clinical_notes, vitals, diagnoses, treatments.

APIs:

- `visits.openFromAppointment`
- `visits.getWorkspace`
- `visits.saveSection`
- `visits.close`

Components:

- VisitWorkspace, VisitSectionNav, AnamnesisForm, VitalsForm, ExamForm, SoapEditor, CloseVisitModal.

Screens:

- Visit Workspace.

Acceptance Criteria:

- Appointment can become visit.
- Visit can be saved incomplete.
- Visit cannot close with blocking unresolved required items.

Tests:

- Visit state transitions.
- Autosave service.
- Close validation.

### Phase 6: Prescriptions + Vaccinations + Labs

Build:

- Prescription draft/approval.
- Vaccination recording and due reminders.
- Lab order and result review.

Tables:

- prescriptions, prescription_items, vaccinations, lab_orders, lab_results, reminders.

APIs:

- `prescriptions.createDraft/approve`
- `vaccinations.record`
- `labOrders.create`
- `labResults.review`

Components:

- PrescriptionForm, VaccineForm, LabOrderForm, LabResultReview.

Screens:

- Visit sections.
- מעבדה
- חיסונים ומניעה

Acceptance Criteria:

- Only Vet/Admin approves prescription.
- Vaccine creates future reminder.
- Lab result requires review before marked complete.

Tests:

- Permission tests.
- Reminder creation.
- Lab status transitions.

### Phase 7: Tasks + Follow Ups

Build:

- Task dashboard.
- Follow-up creation from visit and calls.
- Due/overdue views.

Tables:

- tasks, follow_ups, reminders.

APIs:

- `tasks.list/create/update/complete`
- `followUps.create/complete`

Components:

- TaskBoard, TaskDrawer, FollowUpForm, DueBadge.

Screens:

- משימות
- Dashboard widgets

Acceptance Criteria:

- User can create follow-up during visit close.
- Call-generated tasks appear in "From Calls".

Tests:

- Due date logic.
- Status transitions.

### Phase 8: Voice Agent Integration

Build:

- Phone call linkage to owner/pet/appointment/visit.
- Call transcript and AI summary surfaces.
- Pre-visit brief in appointment and visit workspace.

Tables:

- phone_calls, call_transcripts, ai_summaries, tasks, appointments.

APIs:

- webhook upsert call.
- `calls.list/get/link`
- `ai.generateCallSummary`

Components:

- CallDrawer, TranscriptView, PreVisitBriefCard, UrgencyBadge.

Screens:

- שיחות
- Dashboard recent calls
- Appointment/Visit context

Acceptance Criteria:

- Incoming call creates call record.
- Call can create appointment or task.
- Opening appointment shows call context.

Tests:

- Webhook idempotency.
- Signature validation.
- Call-to-appointment relation.

### Phase 9: AI Layer

Build:

- AI artifact lifecycle.
- Draft SOAP.
- Patient summary.
- Client instruction draft.
- Task extraction.
- Approval/rejection UI.

Tables:

- ai_summaries, audit_logs.

APIs:

- `ai.patientSummary`
- `ai.draftSoap`
- `ai.draftClientInstructions`
- `ai.extractTasks`
- `ai.approveArtifact`
- `ai.rejectArtifact`

Components:

- AiDraftPanel, ApprovalControls, SourceRefsList, AiSafetyNotice.

Screens:

- Visit Workspace.
- Medical Record.
- Calls.

Acceptance Criteria:

- AI output is never official without approval.
- Approved artifact records reviewer.
- Rejected artifact stores reason.

Tests:

- Safety policy tests.
- Approval permission tests.
- Prompt/output parser tests.

### Phase 10: Inventory + Basic Billing

Build:

- Inventory item catalog.
- Inventory transactions from treatments/vaccines/prescriptions.
- Visit charge capture.
- Invoice draft and payment record.

Tables:

- inventory_items, inventory_transactions, invoices, invoice_items, payments.

APIs:

- `inventory.list/create/adjust`
- `charges.forVisit/review`
- `invoices.createFromVisit/issue`
- `payments.record`

Components:

- InventoryTable, StockAdjustModal, VisitChargesPanel, InvoiceDraft, PaymentForm.

Screens:

- מלאי
- חיובים
- Visit Charges section

Acceptance Criteria:

- Treatment can create pending invoice item.
- User reviews charges before invoice issue.
- Stock decrement is auditable.

Tests:

- Charge capture.
- Inventory transaction append-only.
- Invoice totals.

---

## 16. Non-Functional Requirements

Security:

- RLS on all exposed tables.
- Service role never exposed to browser.
- Signed webhooks verified.
- Audit sensitive reads/downloads where required.

Reliability:

- Webhooks idempotent.
- Jobs retry with dead-letter/failure state.
- No data loss on partial AI failure.

Privacy:

- Call recordings and documents in private buckets.
- Redaction support for transcripts.
- Role-based access to medical data.

Observability:

- Structured logs for webhooks/jobs.
- Error tracking.
- Audit event search.

Backups:

- Supabase backups according to production plan.
- Export path for owner/pet medical records Phase 2.

---

## 17. Open Questions Before Build

1. האם המערכת אמורה להחליף את כל התוכנה הקיימת של נועה או להתחיל ככלי פנימי סביב שיחות/יומן/ביקורים?
2. האם נדרש חשבונית מס/קבלה ישראלית ב-MVP או מספיק רישום חיוב פנימי?
3. האם מרשמים צריכים להיות מסמך PDF חתום כבר ב-MVP?
4. האם יש צורך ב-WhatsApp כבר בהשקה או ש-SMS מספיק?
5. האם יש ציוד מעבדה או ספק מעבדה מסוים שיש להשתלב איתו?
6. האם נועה עובדת לבד או עם צוות קבוע והרשאות שונות כבר ביום הראשון?
7. האם יש תהליך משפטי/אתי נדרש להקלטת שיחות וביקורים?

---

## 18. Build Priority Summary

הסדר המומלץ לבנייה:

1. Database + permissions
2. Owners/Pets
3. Calendar/Appointments
4. Visit Workspace בסיסי
5. Medical Record timeline
6. Voice Agent context into appointments
7. Tasks/Follow-ups
8. Prescriptions/Vaccinations/Labs
9. AI drafts with approval
10. Billing/Inventory בסיסי

הסיבה: קודם בונים את ה-source of truth ואת המסע הקליני הבסיסי, אחר כך מחברים אוטומציה, AI, חיוב ומלאי. זה מקטין סיכון ומביא מהר יותר למערכת שנועה יכולה לעבוד איתה בפועל.
