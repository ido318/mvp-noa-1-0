# עריכת ניסוח SMS מ-`/dashboard/settings` — Design Spec

**תאריך:** 2026-09-15
**סטטוס:** מאושר ע"י המשתמש (ראה שיחת brainstorming)

## רקע ומוטיבציה

שמונה תבניות ה-SMS (`packages/shared/src/sms-templates.ts`) קבועות בקוד — כל שינוי ניסוח דורש developer + PR + deploy, ואישור נועה מראש (CLAUDE.md). בנוסף, טריגר ב-Postgres (`appointments_notify_dashboard_change()`, `supabase/migrations/20260612000015_notifications.sql`) מחזיק **העתק שלישי, עצמאי** של ניסוח `reschedule_update`/`cancellation_update` ב-SQL קשיח (`format(...)`) — כבר סוטה מהמקור (מציין תמיד את כתובת הקליניקה, גם לביקורי בית). המשתמש ביקש לתת לנועה יכולת לערוך את הניסוח בעצמה מהדשבורד, בלי developer.

## היקף

1. שדה חדש `smsTemplates` בתוך `clinics.settings` (jsonb קיים) — override אופציונלי לכל אחת משמונה התבניות.
2. פונקציית רינדור משותפת ב-`@tomer/shared` עם placeholders בסגנון `{{key}}`, שמחליפה את הרינדור הפנימי של `smsTemplates` הקיים — כדי שברירת המחדל וה-override ישתמשו באותו מנגנון בדיוק.
3. **תיקון פער הטריגר**: מעבירים את שליחת ה-SMS לדחייה/ביטול-מהדשבורד מה-SQL ל-TS (`appointment.service.ts`), כדי שעריכת נועה תשפיע גם על התרחישים האלה. הטריגר נשאר רק ל-bookkeeping.
4. ולידציה שחוסמת שמירה אם placeholder נדרש נמחק/נשבר.
5. הרשאה: owner/admin בלבד (תואם את `canManageSettings` הקיים).
6. תיעוד: **ללא קוד נוסף** — `ClinicSettingsService.updateSettings()` הקיים כבר כותב ל-`audit_logs` עם `beforePayload`/`afterPayload` = כל אובייקט ה-settings, אז שינוי בתוך `smsTemplates` מתועד אוטומטית ברגע שהוא חלק מה-payload הזה.
7. UI: מרחיב את בלוק `CLIENT_SMS` הקיים ב-`/dashboard/settings/page.tsx`.

---

## חלק 1: מודל הנתונים

### `app/types/domain/clinic.ts`

```typescript
export type SmsTemplateKey =
  | "booking_confirmation"
  | "morning_reminder"
  | "arrival_reminder"
  | "post_visit_followup"
  | "reschedule_update"
  | "cancellation_update"
  | "client_cancellation_confirmation"
  | "vaccination_reminder";

export type ClinicSettings = {
  businessHours: ClinicBusinessHourEntry[];
  visitPrices: ClinicVisitPriceEntry[];
  contact: ClinicContactInfo;
  smsTemplates: Partial<Record<SmsTemplateKey, string>>; // absent key = default wording
};
```

`smsTemplates` הוא `Partial<Record<...>>` (לא `Record<..., string | null>`) — מפתח חסר = ברירת מחדל. אין ערך `null` מפורש; "איפוס לברירת מחדל" ב-UI פשוט מוחק את המפתח מהאובייקט.

### `app/lib/clinic-settings-defaults.ts`

`DEFAULT_CLINIC_SETTINGS.smsTemplates = {}` (אובייקט ריק — כל התבניות משתמשות בברירת המחדל הקשיחה). `withClinicSettingsDefaults` מוסיף `smsTemplates: stored?.smsTemplates ?? {}`.

---

## חלק 2: פונקציית רינדור משותפת + placeholders

### `packages/shared/src/sms-templates.ts` — שינוי מבני

כרגע כל תבנית היא פונקציית TS שמחזירה template literal (`` `שלום ${d.customerName}...` ``). זה משתנה לשני חלקים:

1. **מחרוזת-תבנית עם placeholders** לכל אחת משמונה התבניות (הניסוח הקיים בדיוק, רק עם `{{customerName}}` במקום `${d.customerName}`):

```typescript
export const DEFAULT_SMS_TEMPLATE_TEXT: Record<SmsTemplateKey, string> = {
  booking_confirmation:
    'שלום {{customerName}}, כאן תומר ממרפאת Get A Vet של ד"ר נועה כבשני.\n' +
    'התור של {{petName}} נקבע בהצלחה ✅\n' +
    '📅 {{dayName}}, {{date}} | 🕒 {{time}} | 📍 {{location}}\n' +
    '🩺 {{visitType}} | 💳 {{price}}\n' +
    'לשינוי או ביטול (חינם עד 4 שעות לפני התור) — חייגו אלינו.\n' +
    'מאחלים ל{{petName}} בריאות שלמה 🐾',
  // ...שאר שבע התבניות, אותו דפוס...
};

export const SMS_TEMPLATE_REQUIRED_FIELDS: Record<SmsTemplateKey, (keyof SmsTemplateData)[]> = {
  booking_confirmation: ["dayName", "date", "time", "location", "visitType", "price"],
  morning_reminder: ["time", "location", "visitType"],
  arrival_reminder: ["time", "location", "visitType"],
  post_visit_followup: [],
  reschedule_update: ["oldDate", "newDate", "newTime", "location"],
  cancellation_update: ["oldDate"],
  client_cancellation_confirmation: ["oldDate"],
  vaccination_reminder: ["vaccineName", "petName"],
};
```

(`customerName`/`petName` תמיד נחשבים "נוכחים בטקסט" ברירת המחדל, אך לא ברשימת "נדרש" — הם תמיד מסופקים ע"י הקוד הקורא, לא חלק מהבדיקה מול טקסט ערוך.)

2. **פונקציית רינדור אחת**:

```typescript
export function renderSmsTemplate(templateText: string, data: SmsTemplateData): string {
  return templateText.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    const value = (data as Record<string, unknown>)[key];
    return value === undefined || value === null ? "" : String(value);
  });
}

/** Placeholders actually referenced by a template's text — used both to validate a custom
 * override (does it still contain every required field?) and to render it. */
export function extractPlaceholders(templateText: string): Set<string> {
  const matches = templateText.matchAll(/\{\{(\w+)\}\}/g);
  return new Set(Array.from(matches, (m) => m[1]));
}
```

3. **`smsTemplates` הקיים משוכתב** להשתמש ברינדור + בדיקת השדות הנדרשים על בסיס `DEFAULT_SMS_TEMPLATE_TEXT`, לא על ניסוח קשיח:

```typescript
export const smsTemplates = Object.fromEntries(
  (Object.keys(DEFAULT_SMS_TEMPLATE_TEXT) as SmsTemplateKey[]).map((key) => [
    key,
    (d: SmsTemplateData) => {
      requireFields(d, SMS_TEMPLATE_REQUIRED_FIELDS[key], key);
      return renderSmsTemplate(DEFAULT_SMS_TEMPLATE_TEXT[key], d);
    },
  ]),
) as Record<SmsTemplateKey, (d: SmsTemplateData) => string>;
```

**חשוב:** זה שינוי מבני של `smsTemplates` (מפונקציות נפרדות עם טיפוסי `Require<...>` שונים לכל אחת, לאובייקט גנרי). כל קוד קורא (`agent/src/lib/notifications.ts`, `app/lib/services/dashboard-notifications.service.ts`, `agent/src/lib/vaccinationReminders.ts`) ממשיך לעבוד ללא שינוי כי החתימה החיצונית (`smsTemplates.booking_confirmation(data)` וכו') זהה — רק המימוש הפנימי משתנה. **`app/tests/unit/sms-template-parity.test.ts` חייב להמשיך לעבור ללא שינוי** — הוא הרשת ביטחון שהניסוח בפועל (ברירת מחדל) לא זז.

### פונקציה נוספת: רינדור עם override של קליניקה

```typescript
export function resolveSmsTemplate(
  key: SmsTemplateKey,
  customText: string | undefined,
  data: SmsTemplateData,
): string {
  const text = customText ?? DEFAULT_SMS_TEMPLATE_TEXT[key];
  return renderSmsTemplate(text, data);
}
```

זו הפונקציה ש-`app/`'s enqueue call-sites (`dashboard-notifications.service.ts`, ה-enqueue החדש ב-`appointment.service.ts`, ובמידת הצורך `agent/src/lib/notifications.ts`) יקראו לה עם `clinicSettings.smsTemplates?.[key]` — **לא** דרך `smsTemplates.xxx(data)` הישן, בכל מקום שצריך לכבד override של קליניקה. מקומות ש**אינם** תלויי-קליניקה-ספציפית (כרגע אין כאלה בפועל — מרפאה אחת בפיילוט) ימשיכו להשתמש ב-`smsTemplates.xxx(data)` הישן אם נוח יותר, אך מומלץ לעבור את כולם ל-`resolveSmsTemplate` כדי שהתכונה תהיה שימושית בכל מקום מהיום הראשון.

---

## חלק 3: תיקון פער הטריגר

### מיגרציה חדשה: `CREATE OR REPLACE FUNCTION public.appointments_notify_dashboard_change()`

מסירה משתי הענפים (ביטול, דחייה) את בלוקי ה-`INSERT INTO notifications_log ... format(...)` — **משאירה** את:
- הבדיקה `IF NEW.changed_via IS DISTINCT FROM 'dashboard' THEN RETURN NEW; END IF;`
- ענף הביטול: `UPDATE notifications_log SET status='skipped' WHERE ... status='pending'` (סימון התראות ישנות כלא-רלוונטיות) — **נשאר**, כי זה עדיין תפקיד נכון לטריגר (bookkeeping אוטומטי, לא תלוי ניסוח).
- ענף הדחייה: עדכון `scheduled_for`/`body` (regex patch לשעה) על `morning_reminder` ו-`post_visit_followup` הממתינים — **נשאר** (זה גם bookkeeping, לא יצירת הודעה חדשה).
- **מוסר**: שני בלוקי ה-`INSERT ... reschedule_update`/`cancellation_update` שיוצרים הודעה חדשה עם ניסוח קשיח.

### `app/lib/services/appointment.service.ts` — שני מקומות חדשים

**ב-method העדכון שמשנה `scheduled_at`** (השיטה שמכילה כרגע את ה-`updateVersioned` עם `changed_via: "dashboard"` בסביבות שורה 210): אחרי `await this.appointmentRepository.updateVersioned(...)` המצליח ולפני/אחרי כתיבת ה-audit הקיימת, מוסיפים קריאה לשירות enqueue חדש (ראו למטה) — **רק אם** `input.scheduledAt` ניתן וסטה מ-`existing.value.scheduledAt` (דחייה אמיתית, לא רק שינוי `notes`/`reason`).

**ב-`changeStatus`**: אחרי ה-`updateVersioned` המצליח, **רק אם** `input.status === "cancelled"` (ולא `late_cancellation` — זה תרחיש נפרד עם `client_cancellation_confirmation`, לא `cancellation_update`; אין צורך לשנות התנהגות קיימת מעבר למה שמתועד כאן), מוסיפים אותה קריאת enqueue עם `type: "cancellation_update"`.

### שירות enqueue חדש: `app/lib/services/appointment-notifications.service.ts`

קובץ חדש, לא מתווסף ל-`dashboard-notifications.service.ts` הקיים (ששייך ל-flow אישור/דחייה של `pending_approval`, תחום אחריות שונה) — שומר על גבולות ברורים בין שני תרחישי ה-SMS השונים.

```typescript
import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError, err, ok, type Result } from "@/lib/errors/app-error";
import { resolveSmsTemplate, formatAppointmentDateTime } from "@tomer/shared";
import type { SmsTemplateKey } from "@/types/domain/clinic";

export class AppointmentNotificationsService {
  constructor(private readonly client: SupabaseClient) {}

  /** Enqueues the dashboard-initiated reschedule/cancellation SMS, respecting any clinic
   * override — replaces what appointments_notify_dashboard_change() used to hardcode in SQL. */
  async enqueueDashboardChangeNotification(p: {
    clinicId: string;
    customerId: string;
    appointmentId: string;
    phone: string;
    customerName: string;
    petName: string;
    templateKey: Extract<SmsTemplateKey, "reschedule_update" | "cancellation_update">;
    customTemplateText: string | undefined;
    oldScheduledAt: string;
    newScheduledAt?: string; // required only for reschedule_update
  }): Promise<Result<void>> {
    const { date: oldDate } = formatAppointmentDateTime(p.oldScheduledAt);
    const newDateTime = p.newScheduledAt ? formatAppointmentDateTime(p.newScheduledAt) : null;

    const body = resolveSmsTemplate(p.templateKey, p.customTemplateText, {
      customerName: p.customerName,
      petName: p.petName,
      oldDate,
      newDate: newDateTime?.date,
      newTime: newDateTime?.time,
      location: "CLINIC_LOCATION", // TODO see note below
    });

    const { error } = await this.client.from("notifications_log").insert({
      clinic_id: p.clinicId,
      customer_id: p.customerId,
      appointment_id: p.appointmentId,
      phone: p.phone,
      status: "pending",
      type: p.templateKey,
      body,
      scheduled_for: new Date().toISOString(),
    });
    if (error) return err(AppError.externalProvider("Failed to enqueue dashboard change notification", error));
    return ok(undefined);
  }
}
```

**נקודה שדורשת החלטת המימוש (לא כאן, בזמן הכתיבה בפועל):** ה-SQL הישן תמיד שלח `CLINIC_LOCATION` בלי קשר לסוג הביקור — זה **הבאג המתועד**. ב-TS יש גישה ל-`appointment.appointmentType`, אז אפשר סוף־סוף לתקן ולשלוח `HOME_VISIT_LOCATION` לביקורי בית — **אבל** זה שינוי התנהגות אמיתי (לא רק "מזיזים קוד"), אז יש להחליט: מתקנים את הבאג כחלק מהעברת הלוגיקה (הזדמנות טבעית), או משמרים את ההתנהגות הקיימת בכוונה (תמיד כתובת קליניקה) עד שנועה תאשר את התיקון בנפרד? **המלצה: לתקן** — זו בדיוק הסיבה שגילינו את זה, וזה fix של בעיה מתועדת, לא feature חדש. ה-`patternSummary` שיוזכר ב-commit יבהיר את זה.

`AppointmentNotificationsService` מתווסף ל-`factory.ts` ומוזרק ל-`AppointmentService` (constructor injection, כמו `auditService` הקיים).

---

## חלק 4: ולידציה

### `app/lib/validators/clinic-settings.ts`

```typescript
import { SMS_TEMPLATE_REQUIRED_FIELDS, extractPlaceholders, type SmsTemplateKey } from "@tomer/shared";

const SMS_TEMPLATE_KEYS = Object.keys(SMS_TEMPLATE_REQUIRED_FIELDS) as SmsTemplateKey[];

const smsTemplatesSchema = z
  .record(z.string(), z.string().trim().min(1).max(2000))
  .refine(
    (obj) => Object.keys(obj).every((key) => (SMS_TEMPLATE_KEYS as string[]).includes(key)),
    { message: "מפתח תבנית לא מוכר" },
  )
  .superRefine((obj, ctx) => {
    for (const [key, text] of Object.entries(obj)) {
      const required = SMS_TEMPLATE_REQUIRED_FIELDS[key as SmsTemplateKey] ?? [];
      const present = extractPlaceholders(text);
      const missing = required.filter((field) => !present.has(field));
      if (missing.length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `חסרים שדות חובה בתבנית "${key}": ${missing.join(", ")}`,
          path: [key],
        });
      }
    }
  });

export const updateClinicSettingsSchema = z.object({
  businessHours: z.array(businessHourEntrySchema).min(1).max(MAX_BUSINESS_HOURS_ROWS).optional(),
  visitPrices: z.array(visitPriceEntrySchema).min(1).max(MAX_VISIT_PRICE_ROWS).optional(),
  contact: contactSchema.partial().optional(),
  smsTemplates: smsTemplatesSchema.optional(),
});
```

זו הבדיקה ש"חוסמת שמירה" אם placeholder נדרש נמחק — קורית בשכבת ה-API route, לפני שהשירות בכלל נקרא, אז השגיאה חוזרת ל-UI עם ההודעה המדויקת (איזו תבנית, אילו שדות).

### `app/lib/services/clinic-settings.service.ts`

`updateSettings()` — שינוי יחיד: מוסיפים `smsTemplates: { ...current.smsTemplates, ...input.smsTemplates }` לתוך האובייקט שנבנה לפני `withClinicSettingsDefaults(...)`. ה-merge הוא per-key (לא מחליף את כל האובייקט) — כך שעריכת תבנית אחת לא מוחקת overrides קיימים בתבניות אחרות. **איפוס תבנית בודדת לברירת מחדל** (מחיקת מפתח) קורה ב-**client side** לפני השליחה: ה-UI שולח `smsTemplates` בלי אותו מפתח, וה-merge `{...current, ...input}` בשרת **לא ימחק** אותו אוטומטית (spread לא מוחק מפתחות חסרים) — לכן צריך טיפול מפורש: אם ה-UI רוצה לאפס מפתח, השרת חייב תמיכה ב-`smsTemplates[key] = null`-כאיתות-מחיקה, **או** ה-endpoint מקבל תמיד את כל אובייקט ה-`smsTemplates` המלא (לא partial merge) ומחליף לגמרי. **החלטת מימוש:** העדיפו את האפשרות השנייה — `smsTemplates` ב-`updateClinicSettingsSchema` הוא **תמיד guaranteed מלא** מה-client (לא partial merge בצד שרת) — ה-UI תמיד שולח את כל האובייקט (עם/בלי כל מפתח, מותאם למה שבאמת רוצים לשמור), והשרת מחליף את `smsTemplates` כולו בכל PATCH, בדיוק כמו ש-`businessHours`/`visitPrices` כבר מתנהגים היום (מערך שלם, לא partial-merge של פריטים בודדים).

---

## חלק 5: UI — `/dashboard/settings`

### `app/app/dashboard/settings/page.tsx`

`CLIENT_SMS` (כרגע `{label, when}[]` תצוגה בלבד) מקבל שדה שלישי `key: SmsTemplateKey`. כל שורה מקבלת כפתור "ערוך" שפותח `Drawer`/`Modal` (הרכיב הקיים בקודקס — לבדוק בזמן המימוש אם `Drawer` או `Modal` הוא המתאים כאן, לפי מוסכמות הדף) עם:
- `textarea` עם הטקסט הנוכחי (`clinicSettings.smsTemplates[key] ?? DEFAULT_SMS_TEMPLATE_TEXT[key]` — ברירת המחדל מיובאת מ-`@tomer/shared`, לא משוכפלת ב-UI).
- רשימת "משתנים זמינים" מתחת (מ-`SMS_TEMPLATE_REQUIRED_FIELDS[key]`, מוצג כ-`{{fieldName}}` עם תווית עברית קצרה לכל שדה — צריך מיפוי `FIELD_LABELS` חדש קטן ב-UI).
- כפתור "שמור" (PATCH ל-`/api/settings` עם `smsTemplates` המלא) וכפתור "אפס לברירת מחדל" (מוחק את המפתח מהאובייקט המקומי לפני השמירה).
- הודעת שגיאה מוצגת אם ה-API מחזיר 400 עם הודעת הולידציה (השדות החסרים).

זהו UI חדש (drawer/modal) — לא קיים כרגע עורך טקסט בדף הזה, רק תצוגה. הרכיב יבנה לפי אותם design tokens שכל שאר הדף (Card, Field, Btn) כבר משתמש בהם.

---

## סיכום קבצים

| קובץ | פעולה |
|---|---|
| `packages/shared/src/sms-templates.ts` | שכתוב מבני: `DEFAULT_SMS_TEMPLATE_TEXT`, `SMS_TEMPLATE_REQUIRED_FIELDS`, `renderSmsTemplate`, `extractPlaceholders`, `resolveSmsTemplate`; `smsTemplates` נגזר מהם |
| `app/types/domain/clinic.ts` | `SmsTemplateKey`, `ClinicSettings.smsTemplates` |
| `app/lib/clinic-settings-defaults.ts` | `smsTemplates: {}` בברירת המחדל |
| `app/lib/validators/clinic-settings.ts` | `smsTemplatesSchema` עם ולידציית placeholders |
| `app/lib/services/clinic-settings.service.ts` | merge מלא (לא partial) של `smsTemplates` |
| `supabase/migrations/<ts>_remove_hardcoded_dashboard_sms.sql` | `CREATE OR REPLACE FUNCTION appointments_notify_dashboard_change()` בלי בלוקי ה-INSERT הישנים |
| `app/lib/services/appointment-notifications.service.ts` | חדש — `enqueueDashboardChangeNotification` |
| `app/lib/services/appointment.service.ts` | שתי נקודות קריאה חדשות (reschedule, cancel) |
| `app/lib/services/factory.ts` | הזרקת `AppointmentNotificationsService` ל-`AppointmentService` |
| `app/app/dashboard/settings/page.tsx` | UI עריכה חדש ל-`CLIENT_SMS` |
| `app/tests/unit/sms-template-parity.test.ts` | ללא שינוי בציפיות — חייב להמשיך לעבור |

## שאלה פתוחה שהועברה למימוש (לא לתכנון)

תיקון הבאג (כתובת קליניקה קבועה לביקורי בית) כחלק מהעברת הלוגיקה ל-TS, מומלץ אך יאושר סופית מול נועה לפני merge ל-main (באותה רוח כמו כל שינוי ניסוח SMS אחר) — התוכנית מסמנת את זה כ-fix מתועד, לא כברירת מחדל שקטה.
