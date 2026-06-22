# VOXLY Vet — מסכים, קומפוננטות ואינטראקציות

המשך ל‑`README.md`. כאן: פירוט כל מסך, הקומפוננטות החוזרות, האינטראקציות, ה‑state ונתוני הדמו.

---

## App Shell (`app.jsx`)
פריסה: `display:flex; height:100vh; overflow:hidden`. **ב‑RTL הסרגל בצד ימין** — במבנה ה‑flex התוכן (`main`) ראשון והסרגל (`aside`) אחרון, וה‑RTL מציב את הסרגל מימין אוטומטית.

- **Sidebar** (`--side-w` 248px, רקע לבן, `border-inline-start`): לוגו למעלה → ניווט → כרטיס משתמש (ד״ר נועה כבשני, "וטרינרית ראשית") למטה.
  - פריטי ניווט: היום `today`, יומן `calendar`, שיחות `calls`, אסקלציות `escalations`, לקוחות `clients`, חיות מחמד `pets`, תיקים רפואיים `records`, הגדרות `settings`.
  - פריט פעיל: רקע `--teal-50`, טקסט `--teal-700`, משקל 700, ופס אינדיקטור (`3×22px`, רדיוס 99) ב‑`inset-inline-end:-14px`.
  - badge אדום (`--red-500`) על "אסקלציות" עם מספר האסקלציות הפתוחות.
- **Header** (`--header-h` 68px): חיפוש גלובלי (input עם אייקון search, רוחב מקס׳ 440px) משמאל; מימין — שם המרפאה + "מגדלי גינדי TLV · תל אביב", מפריד אנכי, ופעמון התראות עם badge מספר אסקלציות פתוחות (לחיצה → מסך אסקלציות).
- **Routing:** state פשוט `route` (אין router אמיתי). מעבר מסך מאפס `selClient` וסוגר drawers. `main` עם `overflow-y:auto`.

---

## מסך 1 — "היום" (`today.jsx`) — מסך הבית, החשוב ביותר
**Layout:** כותרת עליונה (ברכה + תאריך עברי + 3 אריחי סטטיסטיקה) ואז `grid` של שתי עמודות: `1fr 360px` (gap 22px). שמאל = ציר זמן, ימין = עמודת סיכום (`flex-column`, gap 16).

### ציר זמן יומי (`Timeline` / `ApptCard`)
- ציר אנכי **08:00–19:00**, גובה שעה `HOUR_PX = 86`. מיקום כרטיס מחושב: `(toMin(start) - 8*60) * (86/60)`. גובה = `dur * 86/60 - 6` (מינ׳ 44px).
- כל שעה: קו עליון `--line-2`, תווית שעה (`HH:00`, tabular‑nums) ב‑gutter ברוחב 54px (RTL → מימין, `right:-54px`).
- **קו "עכשיו"** (זמן דמו `13:20`): נקודה אדומה `--red-500` + קו אופקי, `z-index:5`.
- כרטיס תור: רקע לבן, `border-inline-start: 4px solid <typeColor>`, רדיוס 13. תוכן: אווטאר חיה → שם חיה + שם לקוח → (אם לא compact) הערה → צד: שעה + (אם `loc==="home"`) **אייקון בית** `--teal-600` + pill סוג. `compact` כש‑`dur<=30`. hover: `translateX(-3px)` + צל md. לחיצה → כרטיס לקוח.

### עמודת סיכום
1. **`EscalationsHeroCard`** — הכרטיס הכי בולט. גבול `--red-100`, צל אדמדם, פס עליון גרדיאנט `linear-gradient(90deg,var(--red-500),var(--amber-500))`. אייקון אזהרה בתוך עיגול עם `pulseRing`. מציג מספר אסקלציות פתוחות + כרטיס האסקלציה **הכי דחופה** (badge "הכי דחוף", `UrgencyMeter`, שם חיה+לקוח, שעה). כפתור danger "טפל באסקלציות" → מסך אסקלציות.
2. **`CallsTodayCard`** — אווטאר תומר + כותרת "שיחות שתומר ענה היום" + מספר כולל (`--teal-700`). רשימת 3 שיחות אחרונות (שעה, שם לקוח/"מתקשר לא מזוהה", `CallStatus`), לחיצה פותחת drawer שיחה. כפתור תחתון "לכל השיחות" → מסך שיחות.
3. **`StatTile` ×3** בכותרת: תורים היום / שיחות / לקוחות חדשים. אייקון בריבוע צבעוני, מספר 25px/800, תווית. tones: teal/amber/violet.

**Loading:** `loading=true` למשך ~780ms בהתחלה → שלד (skeleton) של הציר + שני SkeletonCard.

---

## מסך 2 — יומן (`calendar.jsx`)
**תצוגת שבוע** בסגנון Cal.com. ימים א׳–ש׳ (`DAYS`, 07–13.06.2026), היום = אינדקס 4 (חמישי, מודגש `--teal-50`).
- **Grid:** `gridTemplateColumns:"54px repeat(7,1fr)"` — gutter שעות + 7 ימים. שעות **08:00–19:00**, גובה שעה `CAL_HOUR_PX = 58`.
- **RTL drag חשוב:** העמודות מסודרות כך שיום 0 (ראשון) מימין. חישוב עמודה בגרירה: `col = floor((rect.right - clientX)/colW)` — שימו לב ל‑`rect.right` בגלל RTL.
- **בלוק תור:** רקע `typeColor.bg`, `border-inline-start:3px solid fg`, רדיוס 8. אייקון חיה + שם; אם גובה>40 גם `start · סוג`.
- **גרירה לקביעה מחדש:** `pointerdown` על בלוק → `pointermove` מעדכן יום+שעה (snap ל‑15 דק׳: `round(yMin/15)*15`), מוגבל ל‑08:00–(19:00−dur). בזמן גרירה: `scale(1.02)` + צל lg + `z-index:50`. `pointerup` → toast "התור עודכן ✓ נשלחה הודעת אישור ללקוח".
- **לחיצה על תא ריק** → פותח מודאל תור חדש עם יום+שעה preset (cursor:`copy`, hover רקע ירקרק עדין).
- **כפתור "+ תור חדש"** ומחוון שבוע (חצים + "השבוע") בכותרת. מקרא צבעים (legend) מתחת לכותרת.
- **`NewApptModal`:** select לקוח (משנה אוטומטית את רשימת החיות), select חיה, select סוג ביקור, select יום, input time, בורר משך (30/45/60/90 כפתורים). "קבע תור" → מוסיף ל‑state + toast. Esc/קליק‑רקע סוגר.

---

## מסך 3 — שיחות (`calls.jsx`)
**טבלה** (`CallsScreen`) + **drawer פרטים** (`CallDrawer`, נפתח מצד **שמאל** ב‑RTL).
- פילטרים (segmented): הכל / הושלמו / הוסלמו / נכשלו / פעילות. חיפוש לפי שם/טלפון/נושא.
- עמודות: שעה (tabular, bold) · מתקשר (טלפון, ltr) · לקוח מזוהה (אווטאר+שם, או "לא מזוהה" עמום) · משך · נושא · סטטוס (`CallStatus`) · נענה ע״י (צ'יפ תומר) · חץ. שורה: hover רקע `--surface-2`, לחיצה → drawer.
- **`CallDrawer`** (רוחב 460): כותרת (אייקון שיחה נכנסת + שעה) · בלוק מתקשר (אווטאר/אייקון user אם לא מזוהה + טלפון + סטטוס) · 3 אריחי מטא (משך/נושא/סנטימנט) · **כרטיס סיכום AI** (רקע קורל `#FDEFEF`, גבול `#F8DADB`, צ'יפ תומר + תגית "סיכום AI" עם sparkle) · **תמליל** בועות (תומר משמאל קורל `#FDEFEF`, מתקשר מימין `--surface-2`). תחתית: "כרטיס לקוח" + "השמע הקלטה". שיחה שנכשלה (`missed`) → empty state בתמליל.

### `CallStatus` (badge עם נקודה)
| status | טקסט | fg | bg |
|---|---|---|---|
| `done` | הושלמה | `#2F7D5B` | `#E9F5EF` |
| `missed` | נכשלה | `#867667` | `#F2EDE7` |
| `escalated` | הוסלמה | `#B91C1C` | `#FEF2F2` |
| `active` | בתהליך | `#C2410C` | `#FFF3EB` (נקודה עם `pulseRing`) |

---

## מסך 4 — אסקלציות (`escalations.jsx`)
רשימת כרטיסים (`EscalationCard`) **ממוינת לפי דחיפות יורדת**. מופרד ל"פתוחות" ו"טופלו היום".
- כרטיס: אייקון אזהרה בריבוע צבוע לפי `urgencyColor`. **דחיפות ≥8 = קריטי:** גבול `--red-500`, צל אדמדם, פס אנכי `inset-inline-start`, badge "קריטי", `pulseRing` על האייקון.
- תוכן: סיבת ההסלמה (bold 16) + שם חיה/לקוח/סוג + שעה · `UrgencyMeter` בצד · פסקת פירוט (רקע `--surface-2`).
- פעולות (פתוח): "טופל" → פותח שדה הערות (textarea) + "סמן כטופל"/"ביטול". "צפה בשיחה" (אם `callId`) → drawer. "כרטיס לקוח".
- סימון כטופל → `status:"resolved"`, הכרטיס דוהה ל‑opacity .62 + toast. אם אין פתוחות → empty state "אין אסקלציות פתוחות 🐾".

---

## מסך 5 — כרטיס לקוח (`client.jsx`)
**`ClientsScreen`** (רשת כרטיסים) → לחיצה → **`ClientProfile`**.
- כרטיס לקוח ברשימה: אווטאר ראשי‑תיבות + שם + טלפון + חץ; שורת חיות (אווטרים חופפים `-10px` + שמות) + עיר. hover מרים. כפתור "לקוח חדש" וחיפוש בכותרת.
- **פרופיל:** grid `320px 1fr`. שמאל = כרטיס זהות (אווטאר 72, שם, "לקוח/ה מאז YYYY", כפתורי התקשר/הודעה, ושורות פרטים: טלפון/אימייל/עיר עם `InfoRow`). ימין = חיות מחמד (`PetCard` לכל חיה: אווטאר, שם, סוג·גזע, אריחי מין/גיל/משקל) + כרטיס טאבים: **היסטוריית ביקורים** / **שיחות עם תומר** / **תיעוד רפואי** (טיים‑ליין אנכי `Timeline2` / רשימת שיחות / empty states). היסטוריית הביקורים נגזרת משמות החיות האמיתיים של הלקוח.
- כפתור "חזרה ללקוחות" (אייקון `chevR` — חץ ימינה ב‑RTL).
- **מסכי `pets`/`records`/`settings`:** `pets` ממומש (רשת כל החיות). `records`/`settings` הם placeholders (`Placeholder` + empty state) — מחוץ לסקופ הנוכחי.

---

## קומפוננטות חוזרות (`ui.jsx`, `icons.jsx`)
- **`AnimalAvatar`** — עיגול עם רקע בגוון החיה (`pet.color + "1A"`) ואייקון החיה. **`PersonAvatar`** — ראשי תיבות על גרדיאנט כתום בהיר. **`TomerChip`** — אווטאר קורל עם אייקון גל קול (+שם אופציונלי).
- **`Card`** — רקע surface, גבול `--line`, רדיוס lg, צל sm; prop `hover` מוסיף הרמה.
- **`Badge`** / **`TypePill`** (pill לסוג ביקור) / **`CallStatus`**.
- **`UrgencyMeter`** — 10 מקטעים (7×18, רדיוס 3); הראשונים `value` בצבע `bar` לפי דרגה, השאר `--line`. ליד: `N/10`.
- **`Btn`** — variants: `primary` (כתום `--teal-600`+צל), `ghost`, `soft`, `danger`, `dangerSoft`. sizes sm/md/lg. hover brightness, active scale.
- **`EmptyState`** — עיגול אייקון עם `pawIn`, כותרת+תת. ידידותי, עם אימוג'י כפתור 🐾 במקומות נבחרים.
- **`SkeletonRow` / `SkeletonCard`** — `.skeleton` עם `shimmer`.
- **`ToastProvider` / `useToast()`** — toasts בתחתית **שמאל** (RTL), רקע `--ink` כהה, אייקון בעיגול teal/amber, `toastIn`, נעלם אחרי ~3.4s.
- **`Modal`** — overlay מטושטש, `scaleIn`, Esc/קליק‑רקע סוגר, כותרת+תת+כפתור X.
- **`Drawer`** — נכנס מ‑**שמאל** (`translateX(-104%)` → 0) ב‑RTL, overlay, Esc סוגר.
- **אייקונים** (`icons.jsx`): סט קו 24×24, `currentColor`, `stroke-width` ~1.8. כולל אייקוני חיות (`AnimalIcon`: dog/cat ועוד שלא בשימוש כעת) ו‑UI (today/calendar/calls/escalation/clients/pets/records/settings/search/bell/home/phone/mail/pin/clock/sparkle/wave ...). **חצים כיווניים:** `chevR`/`chevL` כבר מותאמים ל‑RTL — `chevR` = "קדימה" בעברית.

---

## State Management
state מקומי (React `useState`) בלבד בפרוטוטייפ. בפרודקשן מומלץ:
- **שרת/דאטה:** appointments (יום + שבוע), calls, escalations, clients, pets, medical records — דרך API/React Query.
- **UI state:** `route` (→ router אמיתי), `selectedClient`, drawer/modal פתוח, פילטר שיחות, מצב גרירה ביומן, loading/skeleton.
- **מוטציות עם feedback:** קביעת/הזזת תור, סימון אסקלציה כטופלה — כל אחת מפעילה toast. שמרו על אופטימיות UI.

## Interactions & Behavior — תקציר
- ניווט בין מסכים דרך הסרגל; פעמון/כרטיס אסקלציה → מסך אסקלציות; כרטיס שיחה → drawer; כרטיס לקוח/חיה → פרופיל.
- גרירת תורים ביומן (pointer events, snap 15 דק׳, RTL‑aware).
- מודאל תור חדש; שדה הערות באסקלציה; פילטרים+חיפוש בשיחות/לקוחות.
- כל האנימציות עם `--ease`; כבוד ל‑`prefers-reduced-motion`.

## פורמטים (i18n / l10n)
- **RTL מלא**, עברית. תאריכים בפורמט ישראלי (`DD.MM.YYYY` או "יום רביעי, 11 ביוני 2026"). **שעון 24 שעות** תמיד.
- טלפונים `05X-XXXXXXX` ב‑`direction:ltr; text-align:right`. אימייל גם ltr.
- מספרים: `tabular-nums` בטבלאות וצירי זמן.

## נתוני דמו (`data.jsx`)
מקור אמת יחיד: `CLIENTS` (8 לקוחות, כל אחד עם `pets`), `APPTS_TODAY` (9 תורים, שדה `loc:"home"|"clinic"`), `WEEK_APPTS` (20 תורים שבועיים), `CALLS` (9 שיחות תומר), `ESCALATIONS` (5, ממוינות לפי `urgency`), `MEDICAL`. מילונים: `SPECIES` (dog/cat — **כלבים וחתולים בלבד**), `VISIT_TYPES`. עזרי lookup: `petById`, `clientById`. בפרודקשן — להחליף בקריאות API; לשמר את הצורה (shape) של האובייקטים.

## קבצי הרפרנס (`reference_prototype/`)
`index.html` (טוקנים + bootstrap) · `data.jsx` · `icons.jsx` · `ui.jsx` · `today.jsx` · `calendar.jsx` · `calls.jsx` · `escalations.jsx` · `client.jsx` · `app.jsx` · `assets/getavet-logo.png`.
פתחו את `index.html` בדפדפן כדי לראות את הפרוטוטייפ החי לפני המימוש.
