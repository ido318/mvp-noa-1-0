# תוכנית עבודה - Tomer / Get A Vet

> קובץ Markdown להעתקה ל-Notion.
> סטטוס עדכני: Batch 1-5 בוצעו בקוד. Batch 1-4 נדחפו ל-GitHub בענף `codex/batch-1-4-checkpoint`; Batch 5 בעבודה בענף `codex/batch-5-live-calls`.

---

## מטרת העל

לבנות את Tomer כמנהל יומן ושירות קולי אמין עבור ד"ר נועה:

- תורים שתומר קובע מופיעים מיד ביומן.
- שיחות נכנסות מוצגות בלשונית שיחות עם סטטוס, תמלול והקלטה.
- ביקור רפואי נפתח רק כאשר הלקוח הגיע בפועל.
- תומר נשמע אנושי, מהיר ומכבד.
- הדשבורד מגיב מהר.
- בסוף ביקור ניתן להפיק סיכום, מרשמים, חשבונית וקישור תשלום.

---

## סטטוס כללי

- [x] Batch 1-3: תשתית booking, גזע חיה, שינוי סוג ביקור ופורמט זמן/תאריך.
- [x] Batch 4: לוודא שכל תור שתומר קובע מופיע ביומן.
- [x] Batch 5: לשונית שיחות חיה עם תמלול והקלטות.
- [ ] Batch 6: קול וזמן תגובה של תומר.
- [ ] Batch 7: פתיחת ביקור רפואי רק אחרי הגעה.
- [ ] Batch 8: מעבר בין תורים ו-no-show.
- [ ] Batch 9: טיפול באיחור לתור.
- [ ] Batch 10: הוראות הגעה למרפאה.
- [ ] Batch 11: מחירון מובנה.
- [ ] Batch 12: חשבונית, תשלום ומסמכים.
- [ ] Batch 13: ביצועי Dashboard.

---

## כבר בוצע - Batch 1-3

### תכולה

- [x] תמיכה ב-`pet_breed`.
- [x] שמירת גזע לחיה חדשה.
- [x] `lookup-customer` מחזיר חיות עם סוג וגזע.
- [x] שינוי סוג ביקור באותה שעה מעדכן את אותו תור.
- [x] עיקור/סירוס נשאר `pending_approval`.
- [x] תורים רגילים נשארים `scheduled`.
- [x] פורמט זמן ישראלי: `13:00`.
- [x] פורמט תאריך ישראלי: `20/06/2026`.

### בדיקות שבוצעו

- [x] `npm run test:all`
- [x] `npm run typecheck:all`

### הערות

- [x] בוצע commit חתום ודחיפה ל-GitHub.
- [ ] `lint` עדיין נכשל בגלל בעיות קיימות:
  - חסר `eslint.config.*` ב-agent.
  - בעיות React lint קיימות במסכי dashboard.

### Commit מוצע

```bash
git commit -m "fix: stabilize voice booking and israel datetime formatting"
```

---

## Batch 4 - תורים שתומר קובע חייבים להופיע ביומן

### מטרה

אין מצב שתומר אומר ללקוח "קבעתי תור" אבל התור לא מופיע ביומן של נועה.

### Checklist

- [x] לוודא שכל קריאת `book-appointment` יוצרת רשומה ב-`appointments`.
- [x] לוודא ש-`checkup` מופיע ביומן כ-`scheduled`.
- [x] לוודא ש-`vaccination`, כולל חיסון כלבת, מופיע ביומן כ-`scheduled`.
- [x] לוודא ש-`home_visit` מופיע ביומן כ-`scheduled`.
- [x] לוודא ש-`phone_consultation` מופיע ביומן כ-`scheduled`.
- [x] לוודא ש-`neutering` מופיע ביומן כ-`pending_approval`.
- [x] לוודא שה-API של היומן מחזיר את התורים שתומר יצר.
- [x] לוודא שהמסכים "היום" ו"יומן" מציגים את התורים האלה.
- [x] להוסיף לוג ברור כאשר יצירת תור נכשלת.
- [x] לוודא שתומר לא אומר "התור נקבע" אם Supabase החזיר שגיאה.
- [x] אם השעה נתפסה, תומר מציע שעה אחרת במקום לסכם תור שלא נוצר.

### קבצים מרכזיים

- `agent/src/lib/store.ts`
- `agent/src/server/routes/tools.ts`
- `app/lib/repositories/appointment.repository.ts`
- `app/lib/services/calendar.service.ts`
- `app/app/dashboard/page.tsx`
- `app/app/dashboard/calendar/page.tsx`

### בדיקות

- [x] Unit test ל-`bookAppointment` עבור חיסון כלבת.
- [x] Unit test ל-`bookAppointment` עבור עיקור/סירוס.
- [x] API/service test שמוודא שתור שנוצר מוחזר ביומן.
- [ ] בדיקה ידנית: שיחת תומר -> קביעת תור -> התור מופיע ביומן.

### Commit מוצע

```bash
git commit -m "fix: ensure voice bookings appear in calendar"
```

---

## Batch 5 - לשונית שיחות חיה עם תמלול והקלטות

### מטרה

לשונית "שיחות" צריכה להראות אם נכנסות שיחות עכשיו, מה הסטטוס שלהן, ולאפשר פתיחה של כל שיחה לצפייה בתמלול ובהקלטה.

### Checklist

- [x] ליצור או לעדכן רשומת `voice_calls` בתחילת שיחה ב-`/twilio/voice`.
- [x] לא להמתין רק ל-`/hooks/call-ended` כדי שהשיחה תופיע בדשבורד.
- [x] להציג סטטוס `in_progress` כאשר השיחה פעילה.
- [x] לעדכן ל-`completed` כאשר ElevenLabs שולח webhook סיום.
- [x] לשמור `elevenlabs_conversation_id`.
- [x] לשמור `transcript` מתוך webhook הסיום.
- [x] לשמור `ai_summary` מתוך webhook הסיום.
- [x] להוריד הקלטה מ-ElevenLabs.
- [x] לשמור הקלטה ב-Supabase Storage bucket `call-recordings`.
- [x] לשמור `recording_storage_path` ב-`voice_calls`.
- [x] להציג בלשונית "שיחות" רשימת שיחות עדכנית.
- [x] לאפשר לחיצה על שיחה.
- [x] לפתוח Drawer או עמוד פרטים לשיחה.
- [x] להציג סיכום AI.
- [x] להציג תמלול מלא.
- [x] להציג נגן הקלטה.
- [x] להציג הודעת מצב ברורה אם אין עדיין תמלול או הקלטה.
- [x] להוסיף polling או realtime update למסך שיחות.

### קבצים מרכזיים

- `agent/src/server/routes/twilio.ts`
- `agent/src/server/routes/hooks.ts`
- `agent/src/lib/store.ts`
- `app/app/dashboard/calls/page.tsx`
- `app/app/api/voice/calls/route.ts`
- `app/app/api/voice/calls/[callId]/recording/route.ts`
- `app/lib/repositories/voice-call.repository.ts`

### בדיקות

- [x] Unit test ליצירת voice call בתחילת שיחה.
- [x] Unit test ל-hook סיום שיחה עם transcript.
- [x] Unit test ל-hook סיום שיחה עם recording.
- [ ] בדיקה ידנית: שיחה נכנסת מופיעה כ"בשיחה".
- [ ] בדיקה ידנית: אחרי סיום שיחה רואים תמלול והקלטה.

### Commit מוצע

```bash
git commit -m "feat: show live calls with transcript and recordings"
```

---

## Batch 6 - קול וזמן תגובה של תומר

### מטרה

תומר צריך להישמע אנושי, מהיר, קצר ומכבד. לא רובוטי, לא איטי, ולא ממציא מילים.

### Checklist

- [ ] לבדוק הגדרות ElevenLabs agent.
- [ ] לבדוק voice שנבחר.
- [ ] לבדוק stability.
- [ ] לבדוק similarity.
- [ ] לבדוק style / exaggeration.
- [ ] לבדוק latency mode.
- [ ] לבדוק model.
- [ ] לבדוק endpointing.
- [ ] לבדוק interruption / barge-in.
- [ ] לבדוק turn-taking.
- [ ] לקצר prompt אם הוא גורם לדיבור ארוך מדי.
- [ ] לקצר תשובות tool כדי שתומר לא מקריא טקסטים ארוכים.
- [ ] לוודא שתומר לא חוזר מילה במילה על פלט כלים.
- [ ] לוודא שתומר עונה במשפט קצר לפני שהוא ממשיך.
- [ ] לצמצם קריאות ל-`conversation-policy` רק למצבים שדורשים זאת.
- [ ] להוסיף תסריטי בדיקה ידניים.
- [ ] למדוד זמן תגובה לפני שינוי.
- [ ] למדוד זמן תגובה אחרי שינוי.

### תסריטי בדיקה ידניים

- [ ] קביעת תור חיסון.
- [ ] שינוי סוג ביקור באותה שעה.
- [ ] לקוח מאחר לתור.
- [ ] שאלה על מגדל/קומה/הגעה.
- [ ] דגל אדום רפואי.
- [ ] לקוח מוכר עם כמה חיות.
- [ ] לקוח חדש עם חיה חדשה וגזע.

### קבצים / מערכות

- `agent/src/knowledge/tomer-system-prompt.md`
- `agent/src/services/conversation-policy.service.ts`
- `agent/src/knowledge/tomer-tools.json`
- ElevenLabs dashboard

### Commit מוצע

```bash
git commit -m "fix: improve Tomer voice latency and naturalness"
```

---

## Batch 7 - פתיחת ביקור רפואי רק אחרי הגעה

### מטרה

קביעת תור לא פותחת תיק ביקור רפואי. ביקור רפואי נפתח רק כאשר נועה מסמנת שהלקוח הגיע.

### החלטת מוצר

- תומר יוצר `appointment`.
- תומר כן יכול ליצור או לקשר `customer` ו-`pet` לצורך היומן.
- תומר לא יוצר `visit`.
- `visit` נפתח רק בלחיצה של נועה: "הלקוח הגיע / התחל ביקור".

### Checklist

- [ ] לבדוק איפה היום נוצרים `visits`.
- [ ] לוודא ש-booking לא יוצר `visit`.
- [ ] להוסיף כפתור "הלקוח הגיע / התחל ביקור" ביומן.
- [ ] הכפתור יוצר `visit` מקושר ל-`appointment`.
- [ ] אם כבר קיים visit לתור, הכפתור פותח אותו במקום ליצור חדש.
- [ ] אם התור מסומן `no_show`, לא לאפשר פתיחת visit בלי אישור נוסף.
- [ ] להציג סטטוס הגעה ברור ביומן.

### קבצים מרכזיים

- `app/app/dashboard/calendar/page.tsx`
- `app/app/dashboard/page.tsx`
- `app/app/dashboard/visits/new/page.tsx`
- `app/lib/services/visit.service.ts`
- `app/lib/repositories/visit.repository.ts`
- `app/app/api/visits/route.ts`

### בדיקות

- [ ] תור חדש לא יוצר visit.
- [ ] לחיצה על "הלקוח הגיע" יוצרת visit.
- [ ] לחיצה חוזרת לא יוצרת visit כפול.
- [ ] תור no-show לא פותח visit רגיל.

### Commit מוצע

```bash
git commit -m "feat: create visits only after arrival"
```

---

## Batch 8 - מעבר בין תורים ו-no-show

### מטרה

כאשר נועה עוברת לתור הבא, המערכת צריכה לוודא שהתור הקודם טופל: הגיע, לא הגיע, או נדחה.

### Checklist

- [ ] לזהות appointment קודם שלא נסגר.
- [ ] לפני פתיחת ביקור חדש להציג modal:
  - "האם הלקוח הקודם הגיע?"
- [ ] אם הגיע: לסיים או לפתוח ביקור בהתאם למצב.
- [ ] אם לא הגיע: לסמן appointment כ-`no_show`.
- [ ] אם נוצר visit ריק בטעות: לבטל או למחוק אותו בצורה בטוחה.
- [ ] אם הלקוח/חיה חדשים ואין היסטוריה: לבצע soft-delete רק אם אין מידע רפואי/תשלומי.
- [ ] אם הלקוח ותיק: ליצור follow-up.
- [ ] להציג no-show ביומן.

### Follow-up ללקוח ותיק

- [ ] ליצור משימת follow-up לנועה.
- [ ] בעתיד: לאפשר שיחת תומר ללקוח.
- [ ] אם הלקוח אומר שהסתדר או שהחיה מרגישה טוב: לתעד ולסגור, לא לדחוף תור בכוח.

### Commit מוצע

```bash
git commit -m "feat: add no-show resolution flow"
```

---

## Batch 9 - טיפול באיחור לתור

### מטרה

כאשר לקוח מתקשר להגיד שהוא מאחר, תומר עונה בצורה אנושית ומכבדת, ולא חוסם אותו אוטומטית.

### Checklist

- [ ] להוסיף כוונה לשיחה: לקוח מאחר לתור.
- [ ] לחפש תור פעיל קרוב לפי טלפון.
- [ ] להוסיף הערה לתור: `client_running_late`.
- [ ] תומר אומר:
  - "אין בעיה, תשתדל להגיע כמה שיותר מהר. אני מעדכן את נועה."
- [ ] אם האיחור משמעותי מאוד, להציע תיאום מחדש רק אם צריך.
- [ ] לא להגיד "לצערי לא ניתן" באיחור סביר.

### Commit מוצע

```bash
git commit -m "fix: handle late arrival calls politely"
```

---

## Batch 10 - הוראות הגעה למרפאה

### מטרה

תומר עונה מיד לשאלות כמו "איזה מגדל?" או "איזו קומה?" בלי להעביר לנועה.

### Checklist

- [ ] להוסיף ל-business info: "מגדל 2".
- [ ] להוסיף קומה כאשר תהיה ידועה.
- [ ] להוסיף דירה/כניסה כאשר תהיה ידועה.
- [ ] להוסיף ניסוח קצר לתומר:
  - "זה במגדל 2."
- [ ] לוודא שזה לא נחשב escalation.

### קבצים

- `agent/src/knowledge/business_info.json`
- `agent/src/knowledge/tomer-system-prompt.md`

### Commit מוצע

```bash
git commit -m "feat: add clinic access instructions"
```

---

## Batch 11 - מחירון מובנה

### מטרה

נועה בוחרת שירותים מתוך מחירון במקום לכתוב כל פעם ידנית. זה בסיס לחשבונית ולתשלום.

### Checklist

- [ ] ליצור טבלת `price_catalog`.
- [ ] להוסיף פריטים בסיסיים:
  - ביקור רגיל
  - ביקור בית
  - ייעוץ טלפוני
  - חיסון כלבת
  - חיסון משושה
  - תילוע
  - עיקור/סירוס
- [ ] ליצור `visit_line_items`.
- [ ] במסך ביקור להציג בחירת שירותים מרשימה.
- [ ] לחשב subtotal.
- [ ] לאפשר שינוי כמות/מחיר באישור נועה.
- [ ] להציג סכום בסיכום ביקור.
- [ ] לא לאפשר ל-AI להמציא מחירים.

### קבצים / אזורים

- `supabase/migrations/`
- `app/lib/repositories/`
- `app/lib/services/`
- `app/app/dashboard/visits/[visitId]/page.tsx`
- קומפוננטה חדשה: `visit-line-items-section.tsx`

### Commit מוצע

```bash
git commit -m "feat: add service price catalog"
```

---

## Batch 12 - חשבונית, תשלום ומסמכים

### מטרה

לאחר אישור נועה, המערכת מפיקה מסמכים מסודרים ושולחת קישור תשלום.

### Checklist

- [ ] להפיק סיכום ביקור מאושר.
- [ ] להפיק דף מרשמים נפרד.
- [ ] להפיק חשבונית מפורטת מפריטי מחירון.
- [ ] להוסיף חותמת/פרטי נועה למסמכים.
- [ ] לשלוח SMS עם קישור תשלום.
- [ ] לשמור קישור למסמכים.
- [ ] לא להפיק מסמך סופי לפני אישור נועה.

### הערה מוצרית

ב-AGENTS הוגדר שתשלומים/חשבוניות הם Phase 2. לכן Batch זה דורש אישור מפורש לפני ביצוע.

### Commit מוצע

```bash
git commit -m "feat: generate invoice payment and approved visit documents"
```

---

## Batch 13 - ביצועי Dashboard

### מטרה

כל לחיצה בדשבורד צריכה להגיב מהר. לא 10-15 שניות.

### Checklist

- [ ] למדוד זמני טעינה במסכי dashboard.
- [ ] למדוד API routes איטיים.
- [ ] לבדוק שאילתות Supabase איטיות.
- [ ] להפחית `router.refresh()` אחרי פעולות קטנות.
- [ ] לעדכן state מקומי במקום לרענן מסך שלם.
- [ ] להוסיף pagination למסכי שיחות/לקוחות/ביקורים אם צריך.
- [ ] לטפל בכשלי lint קיימים:
  - `setState` בתוך `useEffect`
  - imports לא בשימוש
  - unescaped entities
- [ ] יעד: פעולה רגילה עד שנייה.
- [ ] יעד: שינוי סטטוס / אישור תור עד 1-2 שניות.

### קבצים מרכזיים

- `app/app/dashboard/calendar/page.tsx`
- `app/app/dashboard/calls/page.tsx`
- `app/app/dashboard/clients/page.tsx`
- `app/app/dashboard/escalations/page.tsx`
- `app/app/dashboard/page.tsx`

### Commit מוצע

```bash
git commit -m "fix: improve dashboard interaction latency"
```

---

## סדר ביצוע מומלץ

1. [ ] Batch 4 - לוודא שתורים של תומר מופיעים ביומן.
2. [ ] Batch 5 - שיחות חיות, תמלול והקלטות.
3. [ ] Batch 6 - קול וזמן תגובה של תומר.
4. [ ] Batch 7 - ביקור רפואי רק אחרי הגעה.
5. [ ] Batch 8 - no-show ומעבר בין תורים.
6. [ ] Batch 9 - איחורים לתור.
7. [ ] Batch 10 - הוראות הגעה.
8. [ ] Batch 11 - מחירון מובנה.
9. [ ] Batch 12 - חשבונית, תשלום ומסמכים.
10. [ ] Batch 13 - ביצועי Dashboard.

---

## Gates לפני כל Batch

- [ ] לכתוב בדיקה נכשלת לפני שינוי קוד.
- [ ] להריץ את הבדיקה ולוודא שהיא נכשלת מהסיבה הנכונה.
- [ ] ליישם מינימום קוד.
- [ ] להריץ בדיקות ממוקדות.
- [ ] להריץ `npm run test:all`.
- [ ] להריץ `npm run typecheck:all`.
- [ ] להריץ lint רלוונטי ולדווח אם עדיין חסום על בעיות קיימות.
- [ ] להציע commit מסודר.

---

## פקודות בדיקה מרכזיות

```bash
npm run test:all
npm run typecheck:all
npm run lint --workspace=agent
npm run lint --workspace=app
```
