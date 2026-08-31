# תומר: הרזיית פרומפט + Knowledge Base (שלב 1) — תוכנית מימוש

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** להריז את פרומפט המערכת של תומר ב-ElevenLabs לזהות/טון/בטיחות/לוגיקת-כלים בלבד, להעביר את כל תוכן המדיניות/מחירים/פרטי-קשר ל-4 מסמכי Knowledge Base חדשים, ולבנות סקריפט סנכרון ל-KB (בדפוס `sync-elevenlabs-agent.ts` הקיים).

**Architecture:** ElevenLabs KB עם `usage_mode: "prompt"` (דטרמיניסטי, מוזרק תמיד לקונטקסט) ו-`rag.enabled: false` — לא retrieval, קורפוס קטן. אין עדכון-במקום ב-API של ElevenLabs ל-KB documents: עריכה = יצירת מסמך חדש + מחיקת הישן + עדכון ההצבעה ב-agent config. **תיקון קריטי לעומת התוכנית המקורית:** מסמכי ה-API של ElevenLabs (`agents/update` ו-`knowledge-base`) לא מתעדים אם PATCH עושה deep-merge או full-replace על אובייקטים מקוננים כמו `conversation_config.agent.prompt`. כדי לא להסתמך על סמנטיקה לא-מתועדת, שני סקריפטי הסנכרון (agent + knowledge-base) **תמיד** יביאו (GET) את הקונפיג החי לפני PATCH וישלחו בחזרה את השדות שהם לא אמורים לגעת בהם (knowledge_base/rag מצד סקריפט הפרומפט; prompt/tools מצד סקריפט ה-KB) — כדי שהרצה של סקריפט אחד לעולם לא תמחק בטעות את מה שהשני הגדיר.

**Tech Stack:** TypeScript (Node 22, ESM, tsx), ElevenLabs Conversational AI REST API (`/v1/convai/agents/{id}`, `/v1/convai/knowledge-base`, `/v1/convai/knowledge-base/text`).

---

## רקע — עובדות שאומתו מול הפרומפט החי ב-ElevenLabs (לפני כתיבת ה-KB)

הפרומפט החי (6,433 תווים, נערך ידנית ב-28.8.2026) נבדק ישירות מול ה-API. מעבר למה שתוכנית ה-roadmap כבר זיהתה ("ד״ר שחר" מומצא, הנחיית filler-words שסותרת את כלל "אל תכריז, פשוט תשתוק"), אומתו מול המשתמש 3 פערי-עובדות אמיתיים חדשים בין הפרומפט החי לקבצים המקומיים (`tomer-system-prompt.md`, `business_info.json`) — **אושרו כנכונים ומועברים ל-KB**:

1. **כתובת:** מגדלי גינדי TLV, קומה 14 (חסר במקומי — היה רק "יצחק (זיקו) גרציאני 6, תל אביב-יפו").
2. **מחירי חיסון-בלבד:** ביקור בקליניקה שהוא לחיסון בלבד → דמי הבדיקה (150 ₪) מבוטלים. ביקור בית שהוא לחיסון בלבד → דמי הנסיעה מוזלים ל-150 ₪ (במקום 300 ₪ המלאים). חיסון משולב מפוצל למוצרים נפרדים: כלב (6-in-1) ו-חתול (4-in-1), שניהם 180 ₪. חבילת חיסון שנתית (950 ₪) מוגבלת ל"כלב מבוגר" וכוללת כלבת + משולב + זריקות תולעים דו-חודשיות + נסיעות, לא כוללת אגרת כלבת עירונית.
3. **אזור ביקורי בית:** הרשימה החיה נכונה יותר מהמקומית — כוללת **רינתיה** ו**נופך** (לא היו במקומי), **לא כוללת ראש העין** (היה במקומי, הוסר).

כל שלושת הפערים האלה מוטמעים בתוכן ה-KB למטה. "ד״ר שחר" והנחיית ה-filler-words **לא** מוטמעים בשום מקום (מוחרגים כמתוכנן).

---

## מיפוי קבצים

| קובץ | פעולה | אחריות |
|---|---|---|
| `agent/src/knowledge/kb/clinic_info.md` | חדש | כתובת/שעות/יצירת קשר/אזור שירות/חיות מטופלות/שירותים זמינים |
| `agent/src/knowledge/kb/pricing_and_visits.md` | חדש | טבלת מחירים + סוגי ביקור/משך + חלון קביעה 14 יום |
| `agent/src/knowledge/kb/policies.md` | חדש | מדיניות ביטול/איחור + קריטריון escalate-to-noa |
| `agent/src/knowledge/kb/store_and_products.md` | חדש | חנות/וואטסאפ, מידעי בלבד |
| `agent/src/knowledge/business_info.json` | עדכון | תיקון כתובת/אזור-שירות/מחירים כדי לא לסטות שוב מה-KB בעתיד |
| `agent/src/knowledge/tomer-system-prompt.md` | עדכון | הרזיה: הסרת תוכן שעבר ל-KB, הוספת פרוטוקול שקט, הוספת הנחיית "תמיד תתבסס על ה-KB" |
| `agent/scripts/sync-elevenlabs-agent.ts` | עדכון | fetch-then-merge לשימור `knowledge_base`/`rag` בכל push |
| `agent/scripts/sync-elevenlabs-knowledge-base.ts` | חדש | סנכרון 4 מסמכי ה-KB: צור-חדש + מחק-ישן + הצבע-מחדש, `--dry-run` |

---

### Task 1: `agent/src/knowledge/kb/clinic_info.md`

**Files:**
- Create: `agent/src/knowledge/kb/clinic_info.md`

- [ ] **Step 1: כתוב את הקובץ**

```markdown
# פרטי המרפאה — Get A Vet

**וטרינרית:** ד"ר נועה כבשני

**כתובת:** יצחק (זיקו) גרציאני 6, תל אביב-יפו — מגדלי גינדי TLV, קומה 14. בתיאום מראש בלבד (אין קבלת קהל ללא תור).

**שעות פעילות:**
- ראשון–חמישי: 08:00–20:00
- שישי: 08:30–13:00
- שבת: סגור

**יצירת קשר:**
- טלפון / וואטסאפ: 054-9581991 (+972549581991)
- מייל: contact@getavett.com

**אזור שירות לביקורי בית:** תל אביב, גבעתיים, רמת גן, יהוד, סביון, מזור, רינתיה, נופך, מגשימים. מחוץ לאזור הזה — רק ביקור בקליניקה.

**חיות מטופלות:** כלבים וחתולים בלבד.

**המרפאה אינה שירות חירום.** במקרה חירום וטרינרי אמיתי — מפנים לבית חולים וטרינרי הקרוב, לא קובעים תור.

**שירותים זמינים במרפאה:** בדיקות שגרתיות, חיסונים, בדיקות דם, בדיקות עיניים ואוזניים, טיפול בעור ואלרגיות, מיקרוצ'יפינג, תיעוד לנסיעה לחו"ל, ניתוחים, המתת חסד.
```

- [ ] **Step 2: ודא שהקובץ תקין (markdown נקרא, בלי תגי HTML/JS)**

```bash
cd agent && node -e "console.log(require('fs').readFileSync('src/knowledge/kb/clinic_info.md','utf-8').length)"
```
Expected: מספר תווים > 0, ללא שגיאה.

- [ ] **Step 3: Commit**

```bash
git add agent/src/knowledge/kb/clinic_info.md
git commit -m "docs(kb): add clinic_info knowledge base document"
```

---

### Task 2: `agent/src/knowledge/kb/pricing_and_visits.md`

**Files:**
- Create: `agent/src/knowledge/kb/pricing_and_visits.md`

- [ ] **Step 1: כתוב את הקובץ**

```markdown
# מחירון וסוגי ביקורים — Get A Vet

**חלון קביעה: 14 יום קדימה בלבד.** אם אין זמינות בטווח הזה, הלקוח נרשם לרשימת המתנה.

## סוגי ביקור, משך, ומחיר

| סוג ביקור | משך אפקטיבי (כולל באפר) | מחיר |
|---|---|---|
| בדיקה בקליניקה (checkup) | 40 דקות (30 בדיקה + 10 באפר) | 150 ₪. **מבוטל אם הביקור הוא לחיסון בלבד** (משלמים רק את מחיר החיסון עצמו). |
| ביקור בית (home_visit) | 90 דקות (60 ביקור + 30 באפר) | 300 ₪ דמי נסיעה + בדיקה. **אם הביקור הוא לחיסון בלבד — 150 ₪ בלבד** (במקום 300), בנוסף למחיר החיסון. |
| חיסונים (vaccination) | 30 דקות (20 + 10 באפר) | ראו טבלת חיסונים למטה. |
| ייעוץ טלפוני (phone_consultation) | 20 דקות | 200 ₪ |
| עיקור/סירוס (neutering) | 40 דקות (30 + 10 באפר) | התור ממתין לאישור ד"ר נועה בדשבורד; SMS ללקוח נשלח רק אחרי האישור. |

## מחירי חיסונים בודדים

| חיסון | מחיר |
|---|---|
| חיסון משולב לכלב (6-in-1) | 180 ₪ |
| חיסון משולב לחתול (4-in-1) | 180 ₪ |
| חיסון כלבת | 120 ₪ |
| זריקת תולעים (park worm) | 90 ₪ |

## חבילת חיסון שנתית (כלב מבוגר בלבד)

950 ₪ — כוללת: חיסון כלבת, חיסון משולב, זריקות תולעים כל חודשיים, ודמי נסיעה. **לא כוללת** אגרת כלבת עירונית (רשות מקומית, משולמת בנפרד).
```

- [ ] **Step 2: ודא שהקובץ תקין**

```bash
cd agent && node -e "console.log(require('fs').readFileSync('src/knowledge/kb/pricing_and_visits.md','utf-8').length)"
```
Expected: מספר תווים > 0.

- [ ] **Step 3: Commit**

```bash
git add agent/src/knowledge/kb/pricing_and_visits.md
git commit -m "docs(kb): add pricing_and_visits knowledge base document"
```

---

### Task 3: `agent/src/knowledge/kb/policies.md`

**Files:**
- Create: `agent/src/knowledge/kb/policies.md`

- [ ] **Step 1: כתוב את הקובץ**

```markdown
# מדיניות — Get A Vet

## ביטול / הזזת תור

- **4 שעות ומעלה לפני התור:** ביטול חינם.
- **פחות מ-4 שעות לפני התור:** התור מסומן כ"ביטול מאוחר" וניתן לחיוב מלא (סימון בלבד במערכת בשלב זה — אין סליקה אוטומטית בפיילוט).

## מתי מעבירים לנועה (escalate-to-noa)

רק לנושאים **לא-רפואיים** שאין עליהם תשובה כאן או במסמכי הידע האחרים — למשל שאלה על מקרה חריג, בקשה מיוחדת, או נושא מנהלי שלא מכוסה. כל נושא רפואי מטופל תמיד דרך תהליך הטריאז' (`triage-pet-case`), לא דרך אסקלציה לנועה.

## מקרה חירום וטרינרי

המרפאה אינה נותנת מענה חירום. אם הטריאז' מזהה חירום מפורש — מפנים את המתקשר לבית חולים וטרינרי הקרוב, לא קובעים תור ולא מנסים לטפל בטלפון.
```

- [ ] **Step 2: ודא שהקובץ תקין**

```bash
cd agent && node -e "console.log(require('fs').readFileSync('src/knowledge/kb/policies.md','utf-8').length)"
```
Expected: מספר תווים > 0.

- [ ] **Step 3: Commit**

```bash
git add agent/src/knowledge/kb/policies.md
git commit -m "docs(kb): add policies knowledge base document"
```

---

### Task 4: `agent/src/knowledge/kb/store_and_products.md`

**Files:**
- Create: `agent/src/knowledge/kb/store_and_products.md`

- [ ] **Step 1: כתוב את הקובץ**

```markdown
# חנות מוצרים — Get A Vet

- ייעוץ טלפוני כללי לגבי מוצרים (מזון, טיפולים, אביזרים) — **חינם**.
- לרכישה: מפנים לחנות המקוונת **getavettstore.com** (משלוח חינם מעל 349 ₪), או מציעים לשלוח קישור בוואטסאפ למספר 054-9581991.
- **תומר לא מנהל מלאי, הזמנות, חיוב או משלוח של החנות** — זה תמיד מופנה לחנות עצמה או לוואטסאפ. אין לתת סטטוס הזמנה, מספר מעקב, או הבטחת זמינות מלאי.
```

- [ ] **Step 2: ודא שהקובץ תקין**

```bash
cd agent && node -e "console.log(require('fs').readFileSync('src/knowledge/kb/store_and_products.md','utf-8').length)"
```
Expected: מספר תווים > 0.

- [ ] **Step 3: Commit**

```bash
git add agent/src/knowledge/kb/store_and_products.md
git commit -m "docs(kb): add store_and_products knowledge base document"
```

---

### Task 5: עדכון `agent/src/knowledge/business_info.json`

הקובץ הזה כרגע draft לא-בשימוש בקוד (לא נטען משום מקום), אבל הוא "מקור האמת" הכתוב למי שיכתוב KB עתידי — משאירים אותו מעודכן כדי לא לחזור על אותה סטייה שקרתה מול הפרומפט החי.

**Files:**
- Modify: `agent/src/knowledge/business_info.json`

- [ ] **Step 1: עדכן את הקובץ המלא**

```json
{
  "clinic_name": "Get A Vet",
  "vet_name": "ד\"ר נועה כבשני",
  "phone": "054-9581991",
  "whatsapp": "+972549581991",
  "email": "contact@getavett.com",
  "address": "יצחק (זיקו) גרציאני 6, תל אביב-יפו 6713353, מגדלי גינדי TLV, קומה 14",
  "hours": {
    "sunday_thursday": "08:00-20:00",
    "friday": "08:30-13:00",
    "saturday": "closed"
  },
  "booking_window_days": 14,
  "appointment_policy": "בתיאום מראש בלבד. ביטול חינם עד 4 שעות לפני — ביטול מאוחר יותר מחויב במלואו.",
  "visit_types": {
    "checkup": {
      "label_he": "בדיקה בקליניקה",
      "duration_min": 30,
      "buffer_min": 10,
      "effective_min": 40,
      "requires_approval": false,
      "price_ils": 150,
      "price_note": "מבוטל אם הביקור הוא לחיסון בלבד"
    },
    "home_visit": {
      "label_he": "ביקור בית",
      "duration_min": 60,
      "buffer_min": 30,
      "effective_min": 90,
      "requires_approval": false,
      "price_ils": 300,
      "price_note": "150 ₪ אם הביקור הוא לחיסון בלבד"
    },
    "vaccination": {
      "label_he": "חיסונים",
      "duration_min": 20,
      "buffer_min": 10,
      "effective_min": 30,
      "requires_approval": false
    },
    "phone_consultation": {
      "label_he": "ייעוץ טלפוני",
      "duration_min": 20,
      "buffer_min": 0,
      "effective_min": 20,
      "requires_approval": false,
      "price_ils": 200
    },
    "neutering": {
      "label_he": "עיקור/סירוס",
      "duration_min": 30,
      "buffer_min": 10,
      "effective_min": 40,
      "requires_approval": true,
      "approval_note": "תור ממתין לאישור נועה — יישלח SMS לאישור"
    }
  },
  "animals_treated": ["כלב", "חתול"],
  "is_emergency_service": false,
  "service_area": [
    "תל אביב", "גבעתיים", "רמת גן", "יהוד",
    "סביון", "מזור", "רינתיה", "נופך", "מגשימים"
  ],
  "prices_ils": {
    "home_visit_full_exam": 300,
    "home_visit_vaccination_only": 150,
    "clinic_exam": 150,
    "clinic_exam_vaccination_only": 0,
    "phone_consult_20min": 200,
    "combined_vaccine_dog": 180,
    "combined_vaccine_cat": 180,
    "rabies_vaccine": 120,
    "park_worm_injection": 90,
    "annual_vaccine_package_adult_dog": 950
  },
  "annual_vaccine_package_includes": [
    "חיסון כלבת", "חיסון משולב", "זריקות תולעים כל חודשיים", "דמי נסיעה"
  ],
  "annual_vaccine_package_excludes": ["אגרת כלבת עירונית"],
  "services_available": [
    "בדיקות שגרתיות", "חיסונים", "בדיקות דם",
    "בדיקות עיניים ואוזניים", "עור ואלרגיות",
    "מיקרוצ'יפינג", "תיעוד נסיעה לחו\"ל",
    "ניתוחים", "המתת חסד"
  ],
  "store": {
    "url": "getavettstore.com",
    "free_delivery_over_ils": 349,
    "phone_product_advice_free": true
  },
  "unknown_or_needs_confirmation": [
    "מרפאת חירום מומלצת באזור",
    "רשימת שאלות נפוצות FAQ מאושרת",
    "מחיר עיקור/סירוס"
  ]
}
```

- [ ] **Step 2: ודא JSON תקין**

```bash
cd agent && node -e "JSON.parse(require('fs').readFileSync('src/knowledge/business_info.json','utf-8')); console.log('valid json')"
```
Expected: `valid json`

- [ ] **Step 3: Commit**

```bash
git add agent/src/knowledge/business_info.json
git commit -m "docs(kb): reconcile business_info.json with verified live-prompt facts"
```

---

### Task 6: הרזיית `agent/src/knowledge/tomer-system-prompt.md`

**Files:**
- Modify: `agent/src/knowledge/tomer-system-prompt.md`

שינויים (שלושה, בקובץ קיים — ראה תוכן מלא של הקובץ הנוכחי למעלה ב"רקע"):

1. **הוספה** — בתוך סעיף "## מה שתמיד עושה, בשקט, בלי להכריז" (אחרי הבלוק "**כשמבקשים תור:**" ולפני "**אחרי triage:**"), בלוק חדש לפרוטוקול שקט/חוסר-תגובה.
2. **החלפה** — כל סעיף "## מה שאתה יודע על הקליניקה" (כולל טבלת המחירים, הכתובת, השעות, אזור השירות, מדיניות הביטול) מוחלף בבלוק קצר שמפנה למאגר הידע.
3. **ללא שינוי** — כללי הברזל, כללי פנייה ניטרלית-מגדרית, לוגיקת הכלים (טבלה + תהליכי triage/booking/reschedule), סיום שיחה.

- [ ] **Step 1: הוסף את פרוטוקול השקט**

Insert after the line ending `**אחרי triage:**` line's *preceding* paragraph — i.e. immediately before the existing `**אחרי triage:**` bullet (line 70 in the current file), insert:

```markdown
**שקט או חוסר תגובה מהלקוח:** אם הלקוח שותק, או שיש רק רעש רקע, בדוק קודם אם זו הפעם הראשונה או השנייה ברצף:
- פעם ראשונה (המשפט הקודם שלך לא היה כבר בדיקת-נוכחות): אמור פעם אחת, קצר וטבעי — "הלו... אתה שם?" או "לא קלטתי, אתה שומע אותי?" — ואז שתוק. אל תיפרד ואל תקרא ל-`end_call` בשלב הזה.
- פעם שנייה ברצף (המשפט הקודם שלך כבר היה בדיקת-נוכחות כזו, והלקוח עדיין לא הגיב): אמור "נראה שיש בעיית תקשורת... תרגיש חופשי לחזור אלינו בטלפון או בוואטסאפ, ביי!" וקרא מיד ל-`end_call`.
- לעולם אל תגיד את המילה "איתי" בפני עצמה כבדיקת-נוכחות — היא נשמעת בדיוק כמו השם איתי ועלולה להתפרש כאילו הלקוח הציג את עצמו כך. אל תניח שזה שם הלקוח אלא אם הוא הציג את עצמו בבירור בשם הזה במקום אחר בשיחה.
```

- [ ] **Step 2: החלף את סעיף "מה שאתה יודע על הקליניקה"**

Replace the entire section from `## מה שאתה יודע על הקליניקה` through the line before `## הכלים שלך` (i.e. everything currently between those two headers) with:

```markdown
## מאגר הידע (Knowledge Base)

כל פרטי המרפאה — כתובת, שעות, יצירת קשר, אזור שירות, מחירים, סוגי ביקורים ומשכם, מדיניות ביטול, וחנות המוצרים — נמצאים במאגר הידע המצורף אליך, ומוזרקים אוטומטית לשיחה. אתה לא צריך לקרוא לו כ-tool נפרד.

**לכל שאלה על מחיר, שעה, כתובת, אזור שירות או מדיניות — תמיד תתבסס על המידע במאגר הידע, ולעולם אל תמציא או תנחש.** אם משהו לא רפואי ולא מופיע שם — קרא ל-`escalate-to-noa`. כל נושא רפואי מטופל תמיד דרך `triage-pet-case`, לא דרך אסקלציה.
```

- [ ] **Step 3: הרץ typecheck (הקובץ הוא markdown, אין קומפילציה — ודא רק שהוא נטען כמחרוזת תקינה בסקריפט הסנכרון בשלב 8)**

```bash
cd agent && wc -c src/knowledge/tomer-system-prompt.md
```
Expected: פחות תווים מה-1,111 שורות המקוריות (המסמך התקצר משמעותית).

- [ ] **Step 4: Commit**

```bash
git add agent/src/knowledge/tomer-system-prompt.md
git commit -m "refactor: slim tomer-system-prompt.md, move clinic content to KB, add silence protocol"
```

---

### Task 7: `agent/scripts/sync-elevenlabs-agent.ts` — שימור `knowledge_base`/`rag` בכל push

**הבעיה:** הסקריפט הקיים בונה `patchPayload.conversation_config.agent.prompt = { prompt, tools }` ושולח PATCH. אם ה-API של ElevenLabs עושה full-replace (ולא deep-merge) על אובייקט `prompt` המקונן — הרצת הסקריפט הזה **אחרי** ש-Task 8 יצרף KB לסוכן תמחק בשקט את `knowledge_base` ואת `rag`. מסמכי ה-API לא מבהירים את סמנטיקת ה-merge, אז הפתרון הבטוח הוא לא להסתמך עליה: להביא את הקונפיג החי לפני כל PATCH ולשלוח בחזרה את `knowledge_base`/`rag` הקיימים ללא שינוי.

**Files:**
- Modify: `agent/scripts/sync-elevenlabs-agent.ts:67-99` (בלוק ה-`patchPayload`, לפני החלק `// ── Dry-run`)

- [ ] **Step 1: הוסף fetch של הקונפיג החי לפני בניית ה-payload**

Replace lines 67-68 (the `// ── Payload ──` comment and blank line right before `const patchPayload = {`) with:

```typescript
// ── Fetch current config (to preserve fields this script doesn't own) ─────────
// The ElevenLabs PATCH endpoint's merge semantics for nested objects like
// conversation_config.agent.prompt are undocumented. To avoid silently wiping
// knowledge_base/rag (owned by sync-elevenlabs-knowledge-base.ts) when this
// script replaces `prompt`, always fetch-then-merge instead of trusting the API.
const currentConfigRes = await fetch(
  `https://api.elevenlabs.io/v1/convai/agents/${ELEVENLABS_AGENT_ID}`,
  { headers: { "xi-api-key": ELEVENLABS_API_KEY } },
);
if (!currentConfigRes.ok) {
  console.error(`[sync] Failed to fetch current agent config: ${currentConfigRes.status}`);
  process.exit(1);
}
const currentConfig = await currentConfigRes.json() as {
  conversation_config?: {
    agent?: { prompt?: { knowledge_base?: unknown; rag?: unknown } };
  };
};
const existingKnowledgeBase = currentConfig.conversation_config?.agent?.prompt?.knowledge_base ?? [];
const existingRag = currentConfig.conversation_config?.agent?.prompt?.rag ?? { enabled: false };

// ── Payload ───────────────────────────────────────────────────────────────────
```

- [ ] **Step 2: כלול את השדות שנשמרו בתוך `prompt`**

In the `patchPayload` object, change:

```typescript
      prompt: {
        prompt: systemPrompt,
        tools,
      },
```

to:

```typescript
      prompt: {
        prompt: systemPrompt,
        tools,
        knowledge_base: existingKnowledgeBase,
        rag: existingRag,
      },
```

- [ ] **Step 3: הרץ dry-run וודא שאין שגיאות**

```bash
cd agent && node --env-file=.env --import tsx/esm scripts/sync-elevenlabs-agent.ts --dry-run
```
Expected: exits 0, prints the existing prompt/tools diff as before (no crash from the new fetch).

- [ ] **Step 4: Commit**

```bash
git add agent/scripts/sync-elevenlabs-agent.ts
git commit -m "fix(scripts): fetch-then-merge knowledge_base/rag in sync-elevenlabs-agent to avoid clobbering KB config"
```

---

### Task 8: `agent/scripts/sync-elevenlabs-knowledge-base.ts` (חדש)

**Files:**
- Create: `agent/scripts/sync-elevenlabs-knowledge-base.ts`

**התנהגות:**
1. קורא את 4 קבצי ה-KB מ-`agent/src/knowledge/kb/*.md`.
2. שם כל מסמך: `tomer-kb-<basename>` (לדוגמה `tomer-kb-clinic_info`) — קונבנציה יציבה לזיהוי בין הרצות.
3. מביא (GET) את קונפיג הסוכן החי, שולף את `prompt`/`tools` הקיימים (לשימור, מאותה סיבה כמו Task 7) ואת רשימת ה-`knowledge_base` הנוכחית (לזיהוי מסמכים ישנים לפי שם, למחיקה בסוף).
4. יוצר (POST) מסמך טקסט חדש לכל קובץ KB.
5. מעדכן (PATCH) את הסוכן כך ש-`prompt.knowledge_base` יצביע על 4 המסמכים החדשים, `usage_mode: "prompt"`, ו-`prompt.rag.enabled = false`; משמר `prompt.prompt`/`prompt.tools` הקיימים.
6. מוחק (DELETE, `force=true`) את המסמכים הישנים בעלי אותו שם, רק אחרי שה-PATCH הצליח.
7. `--dry-run`: מבצע רק את שלבי ה-GET, ומדפיס מה היה נוצר/נמחק/מוצבע — בלי POST/PATCH/DELETE.

- [ ] **Step 1: כתוב את הסקריפט**

```typescript
/**
 * sync-elevenlabs-knowledge-base.ts
 *
 * Syncs the 4 Tomer KB markdown docs (agent/src/knowledge/kb/*.md) to
 * ElevenLabs' Knowledge Base and points the agent's conversation_config at
 * them with usage_mode "prompt" (deterministic injection, no RAG retrieval).
 *
 * ElevenLabs has no in-place KB document update: editing = create-new +
 * re-point the agent + delete-old. This script does all three in order,
 * only deleting old docs after the agent re-point succeeds.
 *
 *   --dry-run   Show what would change; do NOT call create/patch/delete.
 *
 * Usage:
 *   cd agent
 *   node --env-file=.env --import tsx/esm scripts/sync-elevenlabs-knowledge-base.ts [--dry-run]
 */

import { readFileSync, readdirSync } from "fs";
import { fileURLToPath } from "url";
import { join, dirname, basename, extname } from "path";

const isDryRun = process.argv.includes("--dry-run");

// ── Env ───────────────────────────────────────────────────────────────────────

const ELEVENLABS_API_KEY  = process.env["ELEVENLABS_API_KEY"]  ?? "";
const ELEVENLABS_AGENT_ID = process.env["ELEVENLABS_AGENT_ID"] ?? "";

const missing: string[] = [];
if (!ELEVENLABS_API_KEY)  missing.push("ELEVENLABS_API_KEY");
if (!ELEVENLABS_AGENT_ID) missing.push("ELEVENLABS_AGENT_ID");

if (missing.length > 0) {
  console.error(`[sync-kb] Missing required env vars: ${missing.join(", ")}`);
  process.exit(1);
}

// ── Load KB source files ────────────────────────────────────────────────────

const __dir = dirname(fileURLToPath(import.meta.url));
const kbDir = join(__dir, "../src/knowledge/kb");

const kbFiles = readdirSync(kbDir)
  .filter((f) => extname(f) === ".md")
  .sort();

if (kbFiles.length === 0) {
  console.error(`[sync-kb] No .md files found in ${kbDir}`);
  process.exit(1);
}

type KbSource = { docName: string; content: string };

const kbSources: KbSource[] = kbFiles.map((file) => ({
  docName: `tomer-kb-${basename(file, ".md")}`,
  content: readFileSync(join(kbDir, file), "utf-8").trim(),
}));

// ── Fetch current agent config (preserve prompt/tools; find old KB doc ids) ──

type AgentPromptConfig = {
  prompt?: string;
  tools?: unknown;
  knowledge_base?: Array<{ type: string; name: string; id: string; usage_mode?: string }>;
  rag?: Record<string, unknown>;
};

async function fetchAgentPrompt(): Promise<AgentPromptConfig> {
  const res = await fetch(
    `https://api.elevenlabs.io/v1/convai/agents/${ELEVENLABS_AGENT_ID}`,
    { headers: { "xi-api-key": ELEVENLABS_API_KEY } },
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch agent config: ${res.status}`);
  }
  const data = await res.json() as {
    conversation_config?: { agent?: { prompt?: AgentPromptConfig } };
  };
  return data.conversation_config?.agent?.prompt ?? {};
}

const currentPrompt = await fetchAgentPrompt();
const existingKnowledgeBase = currentPrompt.knowledge_base ?? [];

// Old docs to delete: any existing knowledge_base entry whose name matches
// one of our docNames (i.e. a previous version of the same doc we're about
// to replace). Entries with unrelated names are left untouched.
const ourDocNames = new Set(kbSources.map((s) => s.docName));
const oldDocsToDelete = existingKnowledgeBase.filter((doc) => ourDocNames.has(doc.name));

// ── Dry-run ───────────────────────────────────────────────────────────────────

if (isDryRun) {
  console.log("=== DRY RUN — no changes will be sent to ElevenLabs ===\n");
  console.log(`Agent ID: ${ELEVENLABS_AGENT_ID}\n`);

  console.log("── KB DOCUMENTS TO CREATE ──────────────────────────────────────");
  for (const src of kbSources) {
    console.log(`  • ${src.docName} (${src.content.length} chars)`);
  }

  console.log("\n── EXISTING KB DOCS ON AGENT ───────────────────────────────────");
  if (existingKnowledgeBase.length === 0) {
    console.log("  (none)");
  } else {
    for (const doc of existingKnowledgeBase) {
      const willDelete = ourDocNames.has(doc.name) ? " [WILL BE REPLACED]" : "";
      console.log(`  • ${doc.name} (id: ${doc.id})${willDelete}`);
    }
  }

  console.log("\n── RAG CONFIG ───────────────────────────────────────────────────");
  console.log(`Current: ${JSON.stringify(currentPrompt.rag ?? {})}`);
  console.log(`Proposed: {"enabled":false}`);

  console.log("\n=== Run without --dry-run to apply ===");
  process.exit(0);
}

// ── Live push ─────────────────────────────────────────────────────────────────

console.log(`[sync-kb] Creating ${kbSources.length} KB documents…`);

const createdDocs: Array<{ type: "text"; name: string; id: string; usage_mode: "prompt" }> = [];

for (const src of kbSources) {
  const res = await fetch("https://api.elevenlabs.io/v1/convai/knowledge-base/text", {
    method: "POST",
    headers: {
      "xi-api-key": ELEVENLABS_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text: src.content, name: src.docName }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`[sync-kb] Failed to create doc "${src.docName}": ${res.status} ${body}`);
    process.exit(1);
  }

  const created = await res.json() as { id: string; name: string };
  createdDocs.push({ type: "text", name: created.name, id: created.id, usage_mode: "prompt" });
  console.log(`[sync-kb]   created ${created.name} (id: ${created.id})`);
}

console.log(`[sync-kb] Re-pointing agent to new KB documents…`);

const patchRes = await fetch(
  `https://api.elevenlabs.io/v1/convai/agents/${ELEVENLABS_AGENT_ID}`,
  {
    method: "PATCH",
    headers: {
      "xi-api-key": ELEVENLABS_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      conversation_config: {
        agent: {
          prompt: {
            prompt: currentPrompt.prompt,
            tools: currentPrompt.tools,
            knowledge_base: createdDocs,
            rag: { enabled: false },
          },
        },
      },
    }),
  },
);

if (!patchRes.ok) {
  const body = await patchRes.text();
  console.error(`[sync-kb] Failed to update agent: ${patchRes.status} ${body}`);
  console.error(`[sync-kb] New docs were created but NOT attached. Created ids: ${createdDocs.map((d) => d.id).join(", ")}`);
  console.error(`[sync-kb] Not deleting old docs since the agent still points at them.`);
  process.exit(1);
}

console.log(`[sync-kb] Agent updated. Deleting ${oldDocsToDelete.length} superseded document(s)…`);

for (const oldDoc of oldDocsToDelete) {
  const delRes = await fetch(
    `https://api.elevenlabs.io/v1/convai/knowledge-base/${oldDoc.id}?force=true`,
    { method: "DELETE", headers: { "xi-api-key": ELEVENLABS_API_KEY } },
  );
  if (!delRes.ok) {
    const body = await delRes.text();
    console.error(`[sync-kb]   WARNING: failed to delete superseded doc ${oldDoc.name} (${oldDoc.id}): ${delRes.status} ${body}`);
  } else {
    console.log(`[sync-kb]   deleted ${oldDoc.name} (${oldDoc.id})`);
  }
}

console.log(`[sync-kb] Done. ${createdDocs.length} documents live, usage_mode=prompt, rag.enabled=false.`);
```

- [ ] **Step 2: הרץ dry-run**

```bash
cd agent && node --env-file=.env --import tsx/esm scripts/sync-elevenlabs-knowledge-base.ts --dry-run
```
Expected: exit 0, מדפיס 4 מסמכים ל"יצירה", "(none)" תחת "EXISTING KB DOCS" (כי עדיין לא רץ live), ומציג `rag` הנוכחי מול המוצע.

- [ ] **Step 3: Commit**

```bash
git add agent/scripts/sync-elevenlabs-knowledge-base.ts
git commit -m "feat(scripts): add ElevenLabs knowledge-base sync script (create+repoint+delete, dry-run)"
```

---

### Task 9: הרצת typecheck + טסטים מלאה (regression check)

**Files:** none (verification only)

- [ ] **Step 1: typecheck**

```bash
npm run typecheck:all
```
Expected: exit 0, אין שגיאות (הקבצים החדשים הם `.md`/`.json`/סקריפטים עצמאיים — לא אמורים להשפיע על שאר ה-build).

- [ ] **Step 2: טסטים**

```bash
npm run test:all
```
Expected: כל הטסטים הקיימים ירוקים (אין קוד production שהשתנה מלבד שני הסקריפטים, שאין להם טסטים קיימים — עקבי עם `sync-elevenlabs-agent.ts` המקורי).

---

## נקודת עצירה — אחרי Task 9

לפני push חי ל-ElevenLabs (הרצת שני הסקריפטים בלי `--dry-run` על ה-agent בפרודקשן) — **לעצור ולבקש אישור מפורש**. זו נקודת ה"1ה" מהתוכנית המרכזית: dry-run לקריאה תוכן (רגיש-רפואית ופונה-ללקוח), ואז שיחות בדיקה אמיתיות (קביעת תור, רמז טריאז', שאלת אסקלציה, תרחיש שקט, שאלת מחיר/מדיניות מה-KB, שאלה בלי תשובה ב-KB) לפני שנחשב שלב 1 גמור.

---

## Self-Review

**כיסוי ה-spec:** כל 5 תתי-הסעיפים של שלב 1 ב-roadmap מכוסים — 1א (Task 6), 1ב (Tasks 1-4), 1ג (Task 8, כולל תיקון ה-merge-safety ב-Task 7 שלא היה ב-roadqmap המקורי אבל נדרש כדי לא לשבור את 1ד), 1ד (usage_mode/rag מוטמעים בקוד ה-PATCH של Task 8), 1ה (נקודת העצירה בסוף).

**סריקת placeholders:** אין TBD/TODO — כל בלוקי הקוד וה-markdown מלאים ומוכנים להעתקה ישירה.

**עקביות טיפוסים:** `AgentPromptConfig` ב-Task 8 עקבי עם השדות שנשלפים ב-Task 7 (`knowledge_base`, `rag`) ועם schema ה-API שאומת מול התיעוד החי (`type/name/id/usage_mode` לכל knowledge_base entry).
