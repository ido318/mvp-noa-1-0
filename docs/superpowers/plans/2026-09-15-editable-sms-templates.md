# עריכת ניסוח SMS מ-Settings — תוכנית מימוש

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** לאפשר לנועה לערוך את ניסוח שמונת תבניות ה-SMS מ-`/dashboard/settings`, כולל תיקון פער היסטורי שבו טריגר ב-Postgres שלח ניסוח SMS קשיח-בקוד עצמאי לגמרי מהתבניות ב-TS.

**Architecture:** תבניות ה-SMS הופכות מ-template literals ל-מחרוזות עם placeholders (`{{key}}`) + פונקציית רינדור משותפת ב-`@tomer/shared`. `clinics.settings.smsTemplates` שומר override אופציונלי לכל תבנית. הטריגר ב-DB מאבד את שליחת ה-SMS (נשאר רק ל-bookkeeping); הלוגיקה עוברת ל-TS ב-`app/`. **כל שמונה** נקודות הקריאה הקיימות (3 ב-`app/`, ~5 ב-`agent/`) מתעדכנות לכבד override של קליניקה, לא רק שתי הראשונות.

**Tech Stack:** TypeScript, Zod, Supabase Postgres (jsonb + trigger), Vitest, Next.js.

**Spec:** `docs/superpowers/specs/2026-09-15-editable-sms-templates-design.md`

**Worktree:** `/Users/idoamsalem/mvp-noa-1-0/.worktrees/editable-sms-templates`, branch `feat/editable-sms-templates` (מ-`origin/main`).

**סטייה אחת מהמפרט המקורי, שאושרה ע"י המשתמש בזמן כתיבת התוכנית:** המפרט תכנן שירות `app/lib/services/appointment-notifications.service.ts` חדש. בפועל `app/lib/services/appointment.service.ts` **כבר** מקבל `DashboardNotificationsService` דרך ה-constructor שלו (`private readonly dashboardNotifications?: DashboardNotificationsService`, מוזרק ב-`factory.ts`) — אבל אף שיטה בקובץ לא קוראת לו בפועל. Task 6-7 מוסיפים מתודה לשירות הקיים במקום ליצור קובץ חדש — פחות קוד, אותה אחריות. גם ההיקף הורחב (באישור המשתמש): **כל שמונה** התבניות מקבלות תמיכת override, לא רק שתיים.

---

## מיפוי קבצים

| קובץ | פעולה |
|---|---|
| `packages/shared/src/sms-templates.ts` | שכתוב מבני |
| `packages/shared/tests/sms-templates.test.ts` | חדש (בדיקות ל-renderSmsTemplate/extractPlaceholders/resolveSmsTemplate) |
| `app/types/domain/clinic.ts` | עדכון (`SmsTemplateKey`, `ClinicSettings.smsTemplates`) |
| `app/lib/clinic-settings-defaults.ts` | עדכון |
| `app/lib/validators/clinic-settings.ts` | עדכון (`smsTemplatesSchema`) |
| `app/lib/services/clinic-settings.service.ts` | עדכון (full-replace ל-smsTemplates) |
| `supabase/migrations/<ts>_remove_hardcoded_dashboard_sms.sql` | חדש |
| `app/lib/services/dashboard-notifications.service.ts` | עדכון (helper override + מתודה חדשה + 3 מתודות קיימות) |
| `app/lib/services/appointment.service.ts` | עדכון (2 נקודות קריאה חדשות) |
| `agent/src/lib/notifications.ts` | עדכון (helper override + 3 מתודות) |
| `agent/src/lib/vaccinationReminders.ts` | עדכון |
| `app/app/dashboard/settings/page.tsx` | עדכון (UI עריכה) |
| טסטים מתאימים בכל שכבה | חדש/עדכון |

---

### Task 1: שכתוב `packages/shared/src/sms-templates.ts` למנוע placeholders

**Files:**
- Modify: `packages/shared/src/sms-templates.ts`
- Test: `packages/shared/tests/sms-templates.test.ts` (חדש)

- [ ] **Step 1: קרא את הקובץ הנוכחי במלואו**

הקובץ (הועבר כבר לתוכן מלא בתכנון) מכיל: `SmsTemplateData` interface, `CLINIC_LOCATION`/`HOME_VISIT_LOCATION`, טיפוסי `Require<...>` פר-תבנית, `requireFields`, ואובייקט `smsTemplates` עם שמונה פונקציות מבוססות template literal.

- [ ] **Step 2: כתוב טסט כושל**

Create `packages/shared/tests/sms-templates.test.ts` (בדוק קודם אם יש כבר תיקיית `tests/` ב-`packages/shared` — אם לא, צור אותה; ודא ש-`packages/shared/package.json`'s `test` script וה-`vitest.config` (אם יש) כבר סורקים `tests/**/*.test.ts`, אחרת הוסף קונפיגורציה מינימלית תואמת למוסכמות `app/`/`agent/` הקיימות):

```typescript
import { describe, expect, it } from "vitest";
import {
  DEFAULT_SMS_TEMPLATE_TEXT,
  SMS_TEMPLATE_REQUIRED_FIELDS,
  renderSmsTemplate,
  extractPlaceholders,
  resolveSmsTemplate,
  smsTemplates,
} from "../src/sms-templates";

describe("renderSmsTemplate", () => {
  it("replaces {{key}} placeholders with matching data fields", () => {
    const result = renderSmsTemplate("שלום {{customerName}}, {{petName}} מחכה לך", {
      customerName: "דנה",
      petName: "מיקה",
    });
    expect(result).toBe("שלום דנה, מיקה מחכה לך");
  });

  it("replaces a missing/undefined field with an empty string rather than leaving the placeholder", () => {
    const result = renderSmsTemplate("מועד: {{newTime}}", { customerName: "דנה", petName: "מיקה" });
    expect(result).toBe("מועד: ");
  });
});

describe("extractPlaceholders", () => {
  it("returns the set of distinct {{key}} names referenced in a template", () => {
    const result = extractPlaceholders("{{customerName}} {{petName}} {{customerName}}");
    expect(result).toEqual(new Set(["customerName", "petName"]));
  });

  it("returns an empty set for a template with no placeholders", () => {
    expect(extractPlaceholders("טקסט קבוע בלי משתנים")).toEqual(new Set());
  });
});

describe("resolveSmsTemplate", () => {
  it("uses the default template text when no custom text is given", () => {
    const result = resolveSmsTemplate("post_visit_followup", undefined, {
      customerName: "דנה",
      petName: "מיקה",
    });
    expect(result).toBe(
      renderSmsTemplate(DEFAULT_SMS_TEMPLATE_TEXT.post_visit_followup, { customerName: "דנה", petName: "מיקה" }),
    );
  });

  it("uses the custom text when given, over the default", () => {
    const result = resolveSmsTemplate("post_visit_followup", "תודה {{customerName}}!", {
      customerName: "דנה",
      petName: "מיקה",
    });
    expect(result).toBe("תודה דנה!");
  });
});

describe("smsTemplates (backward-compatible external API)", () => {
  it("booking_confirmation still throws when a required field is missing", () => {
    expect(() =>
      smsTemplates.booking_confirmation({
        customerName: "דנה",
        petName: "מיקה",
      } as never),
    ).toThrow(/missing required fields/);
  });

  it("booking_confirmation renders identically to the old hardcoded template literal", () => {
    const data = {
      customerName: "דנה כהן",
      petName: "מיקה",
      dayName: "יום שלישי",
      date: "17.6.2026",
      time: "16:30",
      location: 'הקליניקה, גרציאני 6 ת"א',
      visitType: "בדיקה",
      price: "150 ₪",
    };
    expect(smsTemplates.booking_confirmation(data)).toBe(
      `שלום ${data.customerName}, כאן תומר ממרפאת Get A Vet של ד"ר נועה כבשני.\n` +
      `התור של ${data.petName} נקבע בהצלחה ✅\n` +
      `📅 ${data.dayName}, ${data.date} | 🕒 ${data.time} | 📍 ${data.location}\n` +
      `🩺 ${data.visitType} | 💳 ${data.price}\n` +
      `לשינוי או ביטול (חינם עד 4 שעות לפני התור) — חייגו אלינו.\n` +
      `מאחלים ל${data.petName} בריאות שלמה 🐾`,
    );
  });

  it("post_visit_followup (no required fields) still works with only customerName/petName", () => {
    expect(smsTemplates.post_visit_followup({ customerName: "דנה", petName: "מיקה" })).toContain("דנה");
  });
});
```

- [ ] **Step 3: הרץ, ודא כישלון**

```bash
cd /Users/idoamsalem/mvp-noa-1-0/.worktrees/editable-sms-templates/packages/shared
npx vitest run tests/sms-templates.test.ts
```
Expected: FAIL — `DEFAULT_SMS_TEMPLATE_TEXT`, `renderSmsTemplate` וכו' לא קיימים עדיין.

- [ ] **Step 4: שכתב את `packages/shared/src/sms-templates.ts`**

```typescript
// The 8 approved Hebrew SMS templates for Tomer — wording frozen, do not
// change without Noa's approval, UNLESS changed through the /dashboard/settings
// UI (owner/admin only), which is exactly the sanctioned way to change it now.
// Single source of truth for both agent/ (sends via the notification
// processor) and app/ (dashboard approve/reject/reschedule flows).

export interface SmsTemplateData {
  customerName: string;
  petName: string;
  dayName?: string;
  date?: string;
  time?: string;
  location?: string;
  visitType?: string;
  price?: string;
  oldDate?: string;
  newDate?: string;
  newTime?: string;
  vaccineName?: string;
}

export const CLINIC_LOCATION = 'הקליניקה, גרציאני 6 ת"א';
export const HOME_VISIT_LOCATION = "ביקור בית בכתובתכם";

export type SmsTemplateKey =
  | "booking_confirmation"
  | "morning_reminder"
  | "arrival_reminder"
  | "post_visit_followup"
  | "reschedule_update"
  | "cancellation_update"
  | "client_cancellation_confirmation"
  | "vaccination_reminder";

type Require<T, K extends keyof T> = T & Required<Pick<T, K>>;

export type BookingConfirmationData = Require<SmsTemplateData, "dayName" | "date" | "time" | "location" | "visitType" | "price">;
export type MorningReminderData     = Require<SmsTemplateData, "time" | "location" | "visitType">;
export type RescheduleUpdateData    = Require<SmsTemplateData, "oldDate" | "newDate" | "newTime" | "location">;
export type CancellationUpdateData  = Require<SmsTemplateData, "oldDate">;
export type VaccinationReminderData = Require<SmsTemplateData, "vaccineName" | "petName">;

/** The default, factory wording for each template — {{key}} placeholders, byte-identical
 * in rendered output to the pre-refactor hardcoded template literals. */
export const DEFAULT_SMS_TEMPLATE_TEXT: Record<SmsTemplateKey, string> = {
  booking_confirmation:
    'שלום {{customerName}}, כאן תומר ממרפאת Get A Vet של ד"ר נועה כבשני.\n' +
    'התור של {{petName}} נקבע בהצלחה ✅\n' +
    '📅 {{dayName}}, {{date}} | 🕒 {{time}} | 📍 {{location}}\n' +
    '🩺 {{visitType}} | 💳 {{price}}\n' +
    'לשינוי או ביטול (חינם עד 4 שעות לפני התור) — חייגו אלינו.\n' +
    'מאחלים ל{{petName}} בריאות שלמה 🐾',

  morning_reminder:
    'בוקר טוב {{customerName}} ☀️ תזכורת מ-Get A Vet:\n' +
    'היום 🕒 {{time}} | {{visitType}} ל{{petName}} | 📍 {{location}}\n' +
    'אם משהו השתנה — חייגו אלינו בהקדם האפשרי.\n' +
    'מחכים לכם, תומר וד"ר נועה 🐾',

  arrival_reminder:
    'שלום {{customerName}}, כאן תומר מ-Get A Vet ⏰\n' +
    'מזכירים: התור של {{petName}} היום בשעה {{time}} | {{visitType}} | 📍 {{location}}\n' +
    'אם לא תוכלו להגיע — חייגו אלינו בהקדם.\n' +
    'נתראה בקרוב 🐾',

  post_visit_followup:
    'שלום {{customerName}}, כאן תומר מ-Get A Vet 🐾\n' +
    'רצינו לשאול מה שלום {{petName}} אחרי הביקור אצל ד"ר נועה — האם המצב משתפר?\n' +
    'אם יש שאלות, החמרה או כל דבר אחר — אנחנו זמינים בטלפון.\n' +
    'החלמה מהירה ל{{petName}} ❤️',

  reschedule_update:
    'שלום {{customerName}}, עדכון מ-Get A Vet:\n' +
    'בשל אילוץ רפואי, התור של {{petName}} מיום {{oldDate}} עודכן:\n' +
    '📅 מועד חדש: {{newDate}} | 🕒 {{newTime}} | 📍 {{location}}\n' +
    'המועד לא מתאים? חייגו אלינו ונמצא זמן אחר.\n' +
    'מתנצלים על אי הנוחות 🙏 תומר, Get A Vet',

  cancellation_update:
    'שלום {{customerName}}, עדכון מ-Get A Vet:\n' +
    'בשל אילוץ רפואי, התור של {{petName}} מיום {{oldDate}} בוטל.\n' +
    'נשמח לתאם מועד חדש — חייגו אלינו ונמצא זמן שנוח לכם.\n' +
    'מתנצלים על אי הנוחות 🙏 תומר, Get A Vet',

  client_cancellation_confirmation:
    'שלום {{customerName}}, מאשרים: התור של {{petName}} מיום {{oldDate}} בוטל לבקשתכם.\n' +
    'נשמח לראותכם שוב — לקביעת תור חדש חייגו אלינו בכל עת.\n' +
    'תומר, Get A Vet 🐾',

  vaccination_reminder:
    'שלום {{customerName}}, כאן תומר מ-Get A Vet 💉\n' +
    'הגיע הזמן לחיסון הבא של {{petName}} ({{vaccineName}}) — מומלץ לתאם בקרוב לשמירה על הבריאות.\n' +
    'לתיאום תור נוח — חייגו אלינו בכל עת.\n' +
    'בריאות ל{{petName}} 🐾 תומר, Get A Vet',
};

/** Placeholders each template's DEFAULT wording requires — used to validate a custom
 * override (does the edited text still reference every field the caller will supply?)
 * and, before that, to throw before sending a malformed SMS built from missing data. */
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

function requireFields<T extends SmsTemplateData>(d: T, fields: (keyof T)[], template: string): void {
  const missing = fields.filter((f) => d[f] === undefined || d[f] === "");
  if (missing.length > 0) {
    throw new Error(`smsTemplates.${template}: missing required fields: ${missing.join(", ")}`);
  }
}

/** Replaces every {{key}} in `templateText` with the matching field of `data`,
 * or an empty string if that field is missing. */
export function renderSmsTemplate(templateText: string, data: SmsTemplateData): string {
  return templateText.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    const value = (data as Record<string, unknown>)[key];
    return value === undefined || value === null ? "" : String(value);
  });
}

/** The distinct {{key}} names referenced anywhere in a template's text. */
export function extractPlaceholders(templateText: string): Set<string> {
  const matches = templateText.matchAll(/\{\{(\w+)\}\}/g);
  return new Set(Array.from(matches, (m) => m[1] as string));
}

/** Renders `key`'s template using `customText` if given, else the default wording. */
export function resolveSmsTemplate(
  key: SmsTemplateKey,
  customText: string | undefined,
  data: SmsTemplateData,
): string {
  const text = customText ?? DEFAULT_SMS_TEMPLATE_TEXT[key];
  return renderSmsTemplate(text, data);
}

/** Backward-compatible external API: smsTemplates.xxx(data) throws on missing
 * required fields, then renders the DEFAULT wording. Existing call sites that
 * don't yet pass a clinic override keep working unchanged via this object. */
export const smsTemplates = Object.fromEntries(
  (Object.keys(DEFAULT_SMS_TEMPLATE_TEXT) as SmsTemplateKey[]).map((key) => [
    key,
    (d: SmsTemplateData) => {
      requireFields(d, SMS_TEMPLATE_REQUIRED_FIELDS[key], key);
      return renderSmsTemplate(DEFAULT_SMS_TEMPLATE_TEXT[key], d);
    },
  ]),
) as {
  booking_confirmation: (d: BookingConfirmationData) => string;
  morning_reminder: (d: MorningReminderData) => string;
  arrival_reminder: (d: MorningReminderData) => string;
  post_visit_followup: (d: SmsTemplateData) => string;
  reschedule_update: (d: RescheduleUpdateData) => string;
  cancellation_update: (d: CancellationUpdateData) => string;
  client_cancellation_confirmation: (d: CancellationUpdateData) => string;
  vaccination_reminder: (d: VaccinationReminderData) => string;
};
```

- [ ] **Step 5: הרץ את הטסטים וודא שהם עוברים**

```bash
npx vitest run tests/sms-templates.test.ts
```
Expected: כל הטסטים עוברים.

- [ ] **Step 6: הרץ את `app/tests/unit/sms-template-parity.test.ts` — חייב לעבור בלי שינוי**

```bash
cd /Users/idoamsalem/mvp-noa-1-0/.worktrees/editable-sms-templates/app
npm run build --prefix ../packages/shared
npx vitest run tests/unit/sms-template-parity.test.ts
```
Expected: 5/5 PASS ללא שינוי לקובץ הטסט עצמו. אם נכשל — זה אומר שהרינדור לא זהה בייט-לבייט לניסוח הישן; חזור ל-`DEFAULT_SMS_TEMPLATE_TEXT` ותקן.

- [ ] **Step 7: typecheck + full suite של שני ה-workspaces**

```bash
cd /Users/idoamsalem/mvp-noa-1-0/.worktrees/editable-sms-templates
npm run typecheck:all
npm run test:all
```
Expected: שניהם נקיים.

- [ ] **Step 8: Commit**

```bash
cd /Users/idoamsalem/mvp-noa-1-0/.worktrees/editable-sms-templates
git add packages/shared/src/sms-templates.ts packages/shared/tests/sms-templates.test.ts
git commit -m "feat(shared): restructure SMS templates into a placeholder-based render engine"
```

---

### Task 2: `SmsTemplateKey` + `ClinicSettings.smsTemplates` + defaults

**Files:**
- Modify: `app/types/domain/clinic.ts`
- Modify: `app/lib/clinic-settings-defaults.ts`

- [ ] **Step 1: עדכן `app/types/domain/clinic.ts`**

```typescript
import type { SmsTemplateKey } from "@tomer/shared";

export type ClinicRole = "owner" | "admin" | "staff" | "veterinarian";

export type ClinicBusinessHourEntry = { day: string; hours: string };
export type ClinicVisitPriceEntry = { label: string; detail: string };
export type ClinicContactInfo = { address: string; whatsapp: string; email: string };

export type ClinicSettings = {
  businessHours: ClinicBusinessHourEntry[];
  visitPrices: ClinicVisitPriceEntry[];
  contact: ClinicContactInfo;
  smsTemplates: Partial<Record<SmsTemplateKey, string>>;
};

export type Clinic = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  settings: ClinicSettings;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type ClinicMembership = {
  id: string;
  clinicId: string;
  userId: string;
  role: ClinicRole;
  createdAt: string;
  updatedAt: string;
};

export type ClinicMembershipWithClinic = ClinicMembership & {
  clinic: Pick<Clinic, "id" | "name" | "slug">;
};
```

- [ ] **Step 2: עדכן `app/lib/clinic-settings-defaults.ts`**

```typescript
import type { ClinicSettings } from "@/types/domain/clinic";

export const DEFAULT_CLINIC_SETTINGS: ClinicSettings = {
  businessHours: [
    { day: "ראשון–חמישי", hours: "08:00–20:00" },
    { day: "שישי", hours: "08:30–13:00" },
    { day: "שבת", hours: "סגור" },
  ],
  visitPrices: [
    { label: "בדיקה בקליניקה", detail: "150 ₪ · 40 דק׳ כולל באפר" },
    { label: "ביקור בית", detail: "300 ₪ · 60 דק׳ (אזורי שירות)" },
    { label: "חיסונים", detail: "150 ₪ אגרה + עלות החיסון" },
    { label: "ייעוץ טלפוני", detail: "200 ₪ · 20 דק׳" },
    { label: "עיקור/סירוס", detail: "ממתין לאישור נועה" },
  ],
  contact: {
    address: "יצחק (זיקו) גרציאני 6, תל אביב-יפו",
    whatsapp: "+972 54-958-1991",
    email: "contact@getavett.com",
  },
  smsTemplates: {},
};

export function withClinicSettingsDefaults(
  stored: Partial<ClinicSettings> | null | undefined,
): ClinicSettings {
  return {
    businessHours: stored?.businessHours ?? DEFAULT_CLINIC_SETTINGS.businessHours,
    visitPrices: stored?.visitPrices ?? DEFAULT_CLINIC_SETTINGS.visitPrices,
    contact: {
      ...DEFAULT_CLINIC_SETTINGS.contact,
      ...stored?.contact,
    },
    smsTemplates: stored?.smsTemplates ?? DEFAULT_CLINIC_SETTINGS.smsTemplates,
  };
}
```

- [ ] **Step 3: typecheck**

```bash
cd /Users/idoamsalem/mvp-noa-1-0/.worktrees/editable-sms-templates/app
npx tsc --noEmit
```
כל שגיאה שתופיע תהיה fixture קיים שבונה `ClinicSettings` ידנית וחסר לו `smsTemplates` — הוסף `smsTemplates: {}` לכל כזה.

- [ ] **Step 4: הרץ את חבילת הטסטים**

```bash
npx vitest run
```
Expected: אין רגרסיה.

- [ ] **Step 5: Commit**

```bash
cd /Users/idoamsalem/mvp-noa-1-0/.worktrees/editable-sms-templates
git add app/types/domain/clinic.ts app/lib/clinic-settings-defaults.ts
git commit -m "feat: add smsTemplates field to ClinicSettings"
```

(אם Step 3 חייב לעדכן fixtures בטסטים קיימים, `git add` אותם גם — אותו commit.)

---

### Task 3: ולידציית placeholders ב-`updateClinicSettingsSchema`

**Files:**
- Modify: `app/lib/validators/clinic-settings.ts`
- Test: `app/tests/unit/clinic-settings-validator.test.ts` (חדש)

- [ ] **Step 1: כתוב טסט כושל**

```typescript
import { describe, expect, it } from "vitest";
import { updateClinicSettingsSchema } from "@/lib/validators/clinic-settings";

describe("updateClinicSettingsSchema — smsTemplates", () => {
  it("accepts a valid override that keeps every required placeholder", () => {
    const result = updateClinicSettingsSchema.safeParse({
      smsTemplates: {
        cancellation_update: "ביטלנו את התור מיום {{oldDate}}, {{customerName}}. מצטערים!",
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects an override missing a required placeholder", () => {
    const result = updateClinicSettingsSchema.safeParse({
      smsTemplates: {
        cancellation_update: "ביטלנו את התור, {{customerName}}. מצטערים!",
      },
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues[0]?.message).toContain("oldDate");
  });

  it("rejects an unrecognized template key", () => {
    const result = updateClinicSettingsSchema.safeParse({
      smsTemplates: { not_a_real_template: "טקסט" },
    });
    expect(result.success).toBe(false);
  });

  it("allows a template with no required fields (post_visit_followup) to be any non-empty text", () => {
    const result = updateClinicSettingsSchema.safeParse({
      smsTemplates: { post_visit_followup: "תודה שביקרתם, {{customerName}}!" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty-string template", () => {
    const result = updateClinicSettingsSchema.safeParse({
      smsTemplates: { post_visit_followup: "" },
    });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: הרץ, ודא כישלון**

```bash
cd /Users/idoamsalem/mvp-noa-1-0/.worktrees/editable-sms-templates/app
npx vitest run tests/unit/clinic-settings-validator.test.ts
```
Expected: FAIL — `smsTemplates` לא מוכר ע"י ה-schema, טסטים על ולידציה נכשלים.

- [ ] **Step 3: עדכן `app/lib/validators/clinic-settings.ts`**

```typescript
import { z } from "zod";
import { SMS_TEMPLATE_REQUIRED_FIELDS, extractPlaceholders, type SmsTemplateKey } from "@tomer/shared";

export const MAX_BUSINESS_HOURS_ROWS = 10;
export const MAX_VISIT_PRICE_ROWS = 20;

const businessHourEntrySchema = z.object({
  day: z.string().trim().min(1).max(60),
  hours: z.string().trim().min(1).max(60),
});

const visitPriceEntrySchema = z.object({
  label: z.string().trim().min(1).max(80),
  detail: z.string().trim().min(1).max(120),
});

const contactSchema = z.object({
  address: z.string().trim().max(200),
  whatsapp: z.string().trim().max(40),
  email: z.string().trim().max(120),
});

const SMS_TEMPLATE_KEYS = Object.keys(SMS_TEMPLATE_REQUIRED_FIELDS) as SmsTemplateKey[];

const smsTemplatesSchema = z
  .record(z.string(), z.string().trim().min(1).max(2000))
  .superRefine((obj, ctx) => {
    for (const key of Object.keys(obj)) {
      if (!(SMS_TEMPLATE_KEYS as string[]).includes(key)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `מפתח תבנית לא מוכר: ${key}`, path: [key] });
      }
    }
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

export type UpdateClinicSettingsInput = z.infer<typeof updateClinicSettingsSchema>;
```

- [ ] **Step 4: הרץ את הטסטים וודא שהם עוברים**

```bash
npx vitest run tests/unit/clinic-settings-validator.test.ts
```
Expected: 5/5 PASS.

- [ ] **Step 5: typecheck + full suite**

```bash
npx tsc --noEmit
npx vitest run
```

- [ ] **Step 6: Commit**

```bash
cd /Users/idoamsalem/mvp-noa-1-0/.worktrees/editable-sms-templates
git add app/lib/validators/clinic-settings.ts app/tests/unit/clinic-settings-validator.test.ts
git commit -m "feat: validate SMS template overrides against required placeholders"
```

---

### Task 4: `ClinicSettingsService` — full-replace ל-`smsTemplates`

**Files:**
- Modify: `app/lib/services/clinic-settings.service.ts`
- Test: `app/tests/unit/clinic-settings.service.test.ts` (עדכון אם קיים, אחרת חדש)

- [ ] **Step 1: קרא את הקובץ הנוכחי במלואו + את קובץ הטסט הקיים אם יש**

```bash
cd /Users/idoamsalem/mvp-noa-1-0/.worktrees/editable-sms-templates/app
find tests/unit -iname "*clinic-settings*"
```

- [ ] **Step 2: הוסף/עדכן טסט**

הוסף (לקובץ הקיים אם נמצא, אחרת צור `app/tests/unit/clinic-settings.service.test.ts` בהתאם למוסכמות הטסטים הקיימות בפרויקט — `vi.hoisted`, mock repos):

```typescript
  it("replaces smsTemplates wholesale (not a per-key merge) when input.smsTemplates is given", async () => {
    const clinicRepository = {
      findById: vi.fn().mockResolvedValue(ok({
        id: "clinic-1",
        settings: {
          businessHours: [], visitPrices: [], contact: { address: "", whatsapp: "", email: "" },
          smsTemplates: { booking_confirmation: "old text {{customerName}}" },
        },
      })),
      updateSettings: vi.fn().mockImplementation((_id, settings) => Promise.resolve(ok({ id: "clinic-1", settings }))),
    };
    const auditService = { logAction: vi.fn().mockResolvedValue(ok({})) };
    const service = new ClinicSettingsService(clinicRepository as never, auditService as never);
    const actor = {
      userId: "user-1",
      defaultClinicId: "clinic-1",
      clinicIds: ["clinic-1"],
      memberships: [{ clinicId: "clinic-1", role: "owner" }],
    };

    const result = await service.updateSettings(actor as never, {
      smsTemplates: { cancellation_update: "new text {{oldDate}}" },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // booking_confirmation override is GONE — full replace, not merged with the old object.
    expect(result.value.smsTemplates).toEqual({ cancellation_update: "new text {{oldDate}}" });
  });

  it("keeps the existing smsTemplates unchanged when input.smsTemplates is omitted", async () => {
    const existing = { booking_confirmation: "old text {{customerName}}" };
    const clinicRepository = {
      findById: vi.fn().mockResolvedValue(ok({
        id: "clinic-1",
        settings: {
          businessHours: [], visitPrices: [], contact: { address: "", whatsapp: "", email: "" },
          smsTemplates: existing,
        },
      })),
      updateSettings: vi.fn().mockImplementation((_id, settings) => Promise.resolve(ok({ id: "clinic-1", settings }))),
    };
    const auditService = { logAction: vi.fn().mockResolvedValue(ok({})) };
    const service = new ClinicSettingsService(clinicRepository as never, auditService as never);
    const actor = {
      userId: "user-1",
      defaultClinicId: "clinic-1",
      clinicIds: ["clinic-1"],
      memberships: [{ clinicId: "clinic-1", role: "owner" }],
    };

    const result = await service.updateSettings(actor as never, { contact: { address: "כתובת חדשה" } });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.smsTemplates).toEqual(existing);
  });
```

Adjust the actor/repo mock shapes to match the REAL `ServiceActor`/`ClinicRepository` interfaces if they differ from this assumption — read `app/lib/services/service-context.ts` and `app/lib/repositories/clinic.repository.ts` first.

- [ ] **Step 3: הרץ, ודא כישלון**

```bash
npx vitest run tests/unit/clinic-settings.service.test.ts
```
Expected: FAIL — `smsTemplates` לא נשמר בכלל היום (השירות לא מכיר בשדה).

- [ ] **Step 4: עדכן `updateSettings` ב-`app/lib/services/clinic-settings.service.ts`**

מצא את הבלוק:
```typescript
    const current = clinicResult.value.settings;
    const merged = withClinicSettingsDefaults({
      businessHours: input.businessHours ?? current.businessHours,
      visitPrices: input.visitPrices ?? current.visitPrices,
      contact: { ...current.contact, ...input.contact },
    });
```
והחלף ב:
```typescript
    const current = clinicResult.value.settings;
    const merged = withClinicSettingsDefaults({
      businessHours: input.businessHours ?? current.businessHours,
      visitPrices: input.visitPrices ?? current.visitPrices,
      contact: { ...current.contact, ...input.contact },
      // Full replace, not a per-key merge — matches how businessHours/visitPrices
      // already behave (a whole new array, not merged item-by-item). The settings
      // UI always sends the complete smsTemplates object it wants to persist.
      smsTemplates: input.smsTemplates ?? current.smsTemplates,
    });
```

- [ ] **Step 5: הרץ את הטסטים וודא שהם עוברים**

```bash
npx vitest run tests/unit/clinic-settings.service.test.ts
```

- [ ] **Step 6: typecheck + full suite**

```bash
npx tsc --noEmit
npx vitest run
```

- [ ] **Step 7: Commit**

```bash
cd /Users/idoamsalem/mvp-noa-1-0/.worktrees/editable-sms-templates
git add app/lib/services/clinic-settings.service.ts app/tests/unit/clinic-settings.service.test.ts
git commit -m "feat: persist smsTemplates overrides via ClinicSettingsService"
```

(תיעוד ב-`audit_logs` פועל אוטומטית — `logAction` הקיים כבר שולח `beforePayload`/`afterPayload` עם כל אובייקט ה-settings, כולל `smsTemplates`. אין קוד נוסף לתעד.)

---

### Task 5: מיגרציה — הסרת ניסוח ה-SMS הקשיח מהטריגר

**Files:**
- Create: `supabase/migrations/20260915120000_remove_hardcoded_dashboard_sms.sql`

- [ ] **Step 1: קרא את המיגרציה המקורית במלואה**

```bash
cd /Users/idoamsalem/mvp-noa-1-0/.worktrees/editable-sms-templates
sed -n '108,254p' supabase/migrations/20260612000015_notifications.sql
```

אשר שהתוכן תואם למה שכבר נקרא בזמן התכנון (פונקציית `appointments_notify_dashboard_change()` עם ענפי ביטול ודחייה, כל אחד עם `INSERT INTO notifications_log ... format(...)`).

- [ ] **Step 2: כתוב את המיגרציה**

```sql
-- Removes the hardcoded, independently-drifted SQL copy of the reschedule/
-- cancellation SMS wording from appointments_notify_dashboard_change().
-- That wording is now owned entirely by TS (app/lib/services/appointment.service.ts
-- via DashboardNotificationsService.enqueueDashboardChangeNotification), which
-- respects a per-clinic override from clinics.settings.smsTemplates — something
-- SQL had no way to do. The trigger keeps its bookkeeping (skipping stale
-- pending notifications on cancel, patching scheduled_for/time on reschedule),
-- it just no longer creates the reschedule_update/cancellation_update row itself.
CREATE OR REPLACE FUNCTION public.appointments_notify_dashboard_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_morning   timestamptz;
  v_new_followup  timestamptz;
BEGIN
  IF NEW.changed_via IS DISTINCT FROM 'dashboard' THEN
    RETURN NEW;
  END IF;

  -- ── Cancellation ────────────────────────────────────────────
  IF NEW.status IN ('cancelled', 'late_cancellation')
     AND OLD.status NOT IN ('cancelled', 'late_cancellation', 'completed') THEN

    -- Skip all pending future notifications for this appointment.
    -- The cancellation_update SMS itself is now enqueued from TS.
    UPDATE public.notifications_log
       SET status = 'skipped', updated_at = now()
     WHERE appointment_id = NEW.id AND status = 'pending';

    RETURN NEW;
  END IF;

  -- ── Reschedule (same appointment, new scheduled_at) ─────────
  IF NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at
     AND NEW.status IN ('scheduled', 'confirmed', 'pending_approval') THEN

    v_new_morning := (
      date_trunc('day', NEW.scheduled_at AT TIME ZONE 'Asia/Jerusalem')
      + interval '8 hours'
    ) AT TIME ZONE 'Asia/Jerusalem';

    v_new_followup := NEW.scheduled_at
                       + make_interval(mins => NEW.duration_minutes)
                       + interval '24 hours';

    UPDATE public.notifications_log
       SET scheduled_for = v_new_morning,
           body          = regexp_replace(
                             body,
                             '🕒 \d{2}:\d{2}',
                             '🕒 ' || to_char(NEW.scheduled_at AT TIME ZONE 'Asia/Jerusalem', 'HH24:MI')
                           ),
           updated_at    = now()
     WHERE appointment_id = NEW.id
       AND type = 'morning_reminder'
       AND status = 'pending';

    UPDATE public.notifications_log
       SET scheduled_for = v_new_followup,
           updated_at    = now()
     WHERE appointment_id = NEW.id
       AND type = 'post_visit_followup'
       AND status = 'pending';

    -- reschedule_update SMS itself is now enqueued from TS, not here.
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.appointments_notify_dashboard_change() IS
  'Bookkeeping-only trigger for changed_via=dashboard appointment updates: skips '
  'stale pending notifications on cancel, patches scheduled_for/time on reschedule. '
  'Does NOT create the reschedule_update/cancellation_update SMS row itself — that '
  'moved to app/lib/services/appointment.service.ts (via DashboardNotificationsService), '
  'so it can respect a per-clinic wording override from clinics.settings.smsTemplates.';
```

הבחנה חשובה: הפונקציה החדשה **הסירה** גם את שליפת `v_customer_name`/`v_pet_name`/`v_phone` (לא נחוצים יותר, כי אין יותר `INSERT` שמשתמש בהם בתוך הטריגר) — ודא בזמן ההשוואה מול המקור שאין עוד שימוש בהם בקוד שנשאר לפני שמוחקים את ה-`DECLARE`/`SELECT` שלהם.

- [ ] **Step 3: אל תחיל את המיגרציה על שום מסד נתונים — ראה Task 13**

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260915120000_remove_hardcoded_dashboard_sms.sql
git commit -m "feat(db): strip hardcoded SMS wording from appointments_notify_dashboard_change()"
```

---

### Task 6: `DashboardNotificationsService` — helper override + מתודה חדשה לדחייה/ביטול-מהדשבורד

**Files:**
- Modify: `app/lib/services/dashboard-notifications.service.ts`
- Test: `app/tests/unit/dashboard-notifications.service.test.ts` (עדכון אם קיים, אחרת חדש)

- [ ] **Step 1: קרא את הקובץ במלואו (הועבר כבר בתכנון — 3 מתודות קיימות, constructor עם `client: SupabaseClient`)**

בדוק אם קיים כבר קובץ טסט לשירות הזה:
```bash
cd /Users/idoamsalem/mvp-noa-1-0/.worktrees/editable-sms-templates/app
find tests/unit -iname "*dashboard-notifications*"
```

- [ ] **Step 2: כתוב טסטים כושלים**

הוסף (לקובץ הקיים, או צור חדש בהתאם למוסכמות שנמצאו):

```typescript
describe("DashboardNotificationsService — clinic template overrides", () => {
  it("getSmsTemplateOverrides fetches clinics.settings.smsTemplates for the given clinic", async () => {
    const single = vi.fn().mockResolvedValue({
      data: { settings: { smsTemplates: { cancellation_update: "override {{oldDate}}" } } },
      error: null,
    });
    const client = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single,
      }),
    };
    const service = new DashboardNotificationsService(client as never);

    const overrides = await service.getSmsTemplateOverrides("clinic-1");

    expect(overrides).toEqual({ cancellation_update: "override {{oldDate}}" });
  });

  it("getSmsTemplateOverrides returns {} when the clinic has no overrides or the query fails", async () => {
    const single = vi.fn().mockResolvedValue({ data: null, error: { message: "not found" } });
    const client = {
      from: vi.fn().mockReturnValue({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single }),
    };
    const service = new DashboardNotificationsService(client as never);

    const overrides = await service.getSmsTemplateOverrides("clinic-1");

    expect(overrides).toEqual({});
  });

  it("enqueueDashboardChangeNotification renders reschedule_update using the clinic's override when present", async () => {
    const single = vi.fn().mockResolvedValue({
      data: { settings: { smsTemplates: { reschedule_update: "עדכון קצר: {{newDate}} {{newTime}}" } } },
      error: null,
    });
    const insert = vi.fn().mockResolvedValue({ error: null });
    const client = {
      from: vi.fn((table: string) =>
        table === "clinics"
          ? { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single }
          : { insert },
      ),
    };
    const service = new DashboardNotificationsService(client as never);

    const result = await service.enqueueDashboardChangeNotification({
      clinicId: "clinic-1",
      customerId: "cust-1",
      appointmentId: "appt-1",
      phone: "+972500000000",
      customerName: "דנה",
      petName: "מיקה",
      templateKey: "reschedule_update",
      oldScheduledAt: "2027-01-15T10:00:00.000Z",
      newScheduledAt: "2027-01-20T12:00:00.000Z",
      location: "הקליניקה, גרציאני 6 ת\"א",
    });

    expect(result.ok).toBe(true);
    const [row] = insert.mock.calls[0] as [{ body: string; type: string }];
    expect(row.type).toBe("reschedule_update");
    expect(row.body).toContain("עדכון קצר:");
    expect(row.body).not.toContain("{{"); // fully rendered, no leftover placeholders
  });

  it("enqueueDashboardChangeNotification falls back to the default wording when there's no override", async () => {
    const single = vi.fn().mockResolvedValue({ data: { settings: { smsTemplates: {} } }, error: null });
    const insert = vi.fn().mockResolvedValue({ error: null });
    const client = {
      from: vi.fn((table: string) =>
        table === "clinics"
          ? { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single }
          : { insert },
      ),
    };
    const service = new DashboardNotificationsService(client as never);

    const result = await service.enqueueDashboardChangeNotification({
      clinicId: "clinic-1",
      customerId: "cust-1",
      appointmentId: "appt-1",
      phone: "+972500000000",
      customerName: "דנה",
      petName: "מיקה",
      templateKey: "cancellation_update",
      oldScheduledAt: "2027-01-15T10:00:00.000Z",
      location: "הקליניקה, גרציאני 6 ת\"א",
    });

    expect(result.ok).toBe(true);
    const [row] = insert.mock.calls[0] as [{ body: string }];
    expect(row.body).toContain("בשל אילוץ רפואי"); // default cancellation_update wording
  });
});
```

- [ ] **Step 3: הרץ, ודא כישלון**

```bash
npx vitest run tests/unit/dashboard-notifications.service.test.ts
```
Expected: FAIL — `getSmsTemplateOverrides`/`enqueueDashboardChangeNotification` לא קיימים.

- [ ] **Step 4: הוסף ל-`app/lib/services/dashboard-notifications.service.ts`**

עדכן את בלוק ה-imports:
```typescript
import {
  smsTemplates,
  resolveSmsTemplate,
  formatAppointmentDateTime,
  israelDateIso,
  israelDateAtHour,
  CLINIC_LOCATION,
  HOME_VISIT_LOCATION,
  type SmsTemplateKey,
} from "@tomer/shared";
```

הוסף type חדש (ליד `RejectNotificationParams` הקיים):
```typescript
export interface DashboardChangeNotificationParams {
  clinicId: string;
  customerId: string;
  appointmentId: string;
  phone: string;
  customerName: string;
  petName: string;
  templateKey: Extract<SmsTemplateKey, "reschedule_update" | "cancellation_update">;
  oldScheduledAt: string;
  newScheduledAt?: string; // required only when templateKey === "reschedule_update"
  location: string;
}
```

הוסף שתי מתודות למחלקה, אחרי `enqueueRejectionNotification`:
```typescript
  /** Reads clinics.settings.smsTemplates for one clinic. Empty object (not an
   * error) if the clinic has no overrides or the row can't be read — the
   * caller always has the hardcoded default to fall back to. */
  async getSmsTemplateOverrides(clinicId: string): Promise<Partial<Record<SmsTemplateKey, string>>> {
    const { data, error } = await this.client
      .from("clinics")
      .select("settings")
      .eq("id", clinicId)
      .single();
    if (error || !data) return {};
    return (data.settings?.smsTemplates as Partial<Record<SmsTemplateKey, string>> | undefined) ?? {};
  }

  /**
   * Enqueues the dashboard-initiated reschedule/cancellation SMS, respecting
   * any clinic override — replaces what appointments_notify_dashboard_change()
   * used to hardcode in SQL (see 20260915120000_remove_hardcoded_dashboard_sms.sql).
   */
  async enqueueDashboardChangeNotification(p: DashboardChangeNotificationParams): Promise<Result<void>> {
    const overrides = await this.getSmsTemplateOverrides(p.clinicId);
    const { date: oldDate } = formatAppointmentDateTime(p.oldScheduledAt);
    const newDateTime = p.newScheduledAt ? formatAppointmentDateTime(p.newScheduledAt) : null;

    const body = resolveSmsTemplate(p.templateKey, overrides[p.templateKey], {
      customerName: p.customerName,
      petName: p.petName,
      oldDate,
      newDate: newDateTime?.date,
      newTime: newDateTime?.time,
      location: p.location,
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
```

`CLINIC_LOCATION`/`HOME_VISIT_LOCATION` נשארים מיובאים (בשימוש ע"י `enqueueApprovalNotifications` הקיימת) — `location` עצמו מגיע כפרמטר מוכן מהקורא (`appointment.service.ts`, ראה Task 7) ולא מחושב כאן, כדי שלוגיקת "איזה location" תהיה במקום אחד.

- [ ] **Step 5: הרץ את הטסטים וודא שהם עוברים**

```bash
npx vitest run tests/unit/dashboard-notifications.service.test.ts
```

- [ ] **Step 6: typecheck + full suite**

```bash
npx tsc --noEmit
npx vitest run
```

- [ ] **Step 7: Commit**

```bash
cd /Users/idoamsalem/mvp-noa-1-0/.worktrees/editable-sms-templates
git add app/lib/services/dashboard-notifications.service.ts app/tests/unit/dashboard-notifications.service.test.ts
git commit -m "feat: add clinic-aware dashboard-change SMS enqueue to DashboardNotificationsService"
```

---

### Task 7: חיבור ל-`appointment.service.ts` — דחייה + ביטול-מהדשבורד (כולל תיקון באג ה-location)

**Files:**
- Modify: `app/lib/services/appointment.service.ts`
- Test: `app/tests/unit/appointment.service.test.ts` (עדכון — קובץ קיים, מוצא בזמן המימוש)

**נקודת החלטה מתועדת (לא שקטה):** ה-SQL הישן תמיד שלח `CLINIC_LOCATION`, גם לביקורי בית — זה הבאג שגילינו. עכשיו, ב-TS, יש גישה ל-`appointment.appointmentType`, אז המימוש למטה **מתקן** את זה (`location = appointmentType === "home_visit" ? HOME_VISIT_LOCATION : CLINIC_LOCATION`). זהו שינוי התנהגות אמיתי בניסוח SMS ללקוחות אמיתיים — Task 13 (deploy) חוסם עליו אישור מפורש מנועה לפני merge, בדיוק כמו כל שינוי ניסוח אחר.

- [ ] **Step 1: קרא את שתי המתודות הרלוונטיות במלואן**

```bash
cd /Users/idoamsalem/mvp-noa-1-0/.worktrees/editable-sms-templates/app
grep -n "async update\|async changeStatus" lib/services/appointment.service.ts
```
קרא את שתי המתודות במלואן (זו שמעדכנת `scheduled_at` עם `changed_via: "dashboard"`, וזו שמטפלת ב-`changeStatus`), ואת קובץ הטסט הקיים `app/tests/unit/appointment.service.test.ts` (או שם דומה שנמצא) כדי להכיר את מוסכמות ה-mock (`AppointmentRepository`, `DashboardNotificationsService` — ייתכן שכבר יש mock קיים לו שרק לא בשימוש).

- [ ] **Step 2: הוסף טסטים**

```typescript
describe("AppointmentService — dashboard change notification", () => {
  it("enqueues reschedule_update with home-visit location when a home_visit appointment's scheduled_at changes", async () => {
    const existingAppointment = {
      id: "appt-1", clinicId: "clinic-1", customerId: "cust-1", petId: "pet-1",
      customerName: "דנה", customerPhone: "+972500000000", petName: "מיקה",
      appointmentType: "home_visit", status: "confirmed", source: "front_desk",
      scheduledAt: "2027-01-15T10:00:00.000Z", durationMinutes: 90,
      reason: null, notes: null, version: 1,
      cancelledAt: null, cancelledByUserId: null, cancellationReason: null, createdByUserId: null,
    };
    const appointmentRepository = {
      findById: vi.fn().mockResolvedValue(ok(existingAppointment)),
      findActiveOverlaps: vi.fn().mockResolvedValue(ok([])),
      updateVersioned: vi.fn().mockResolvedValue(ok({ ...existingAppointment, scheduledAt: "2027-01-20T12:00:00.000Z", version: 2 })),
    };
    const dashboardNotifications = { enqueueDashboardChangeNotification: vi.fn().mockResolvedValue(ok(undefined)) };
    const auditService = { logAction: vi.fn().mockResolvedValue(ok({})) };
    const service = new AppointmentService(
      appointmentRepository as never, {} as never, {} as never, auditService as never, dashboardNotifications as never,
    );
    const actor = { userId: "user-1", defaultClinicId: "clinic-1", clinicIds: ["clinic-1"], memberships: [] };

    await service.updateAppointment(actor as never, "appt-1", 1, { scheduledAt: "2027-01-20T12:00:00.000Z" } as never);

    expect(dashboardNotifications.enqueueDashboardChangeNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        templateKey: "reschedule_update",
        location: "ביקור בית בכתובתכם",
        newScheduledAt: "2027-01-20T12:00:00.000Z",
      }),
    );
  });

  it("does NOT enqueue a reschedule notification when scheduled_at doesn't actually change", async () => {
    const existingAppointment = {
      id: "appt-1", clinicId: "clinic-1", customerId: "cust-1", petId: "pet-1",
      customerName: "דנה", customerPhone: "+972500000000", petName: "מיקה",
      appointmentType: "checkup", status: "confirmed", source: "front_desk",
      scheduledAt: "2027-01-15T10:00:00.000Z", durationMinutes: 40,
      reason: null, notes: "note", version: 1,
      cancelledAt: null, cancelledByUserId: null, cancellationReason: null, createdByUserId: null,
    };
    const appointmentRepository = {
      findById: vi.fn().mockResolvedValue(ok(existingAppointment)),
      findActiveOverlaps: vi.fn().mockResolvedValue(ok([])),
      updateVersioned: vi.fn().mockResolvedValue(ok({ ...existingAppointment, notes: "updated note", version: 2 })),
    };
    const dashboardNotifications = { enqueueDashboardChangeNotification: vi.fn().mockResolvedValue(ok(undefined)) };
    const auditService = { logAction: vi.fn().mockResolvedValue(ok({})) };
    const service = new AppointmentService(
      appointmentRepository as never, {} as never, {} as never, auditService as never, dashboardNotifications as never,
    );
    const actor = { userId: "user-1", defaultClinicId: "clinic-1", clinicIds: ["clinic-1"], memberships: [] };

    await service.updateAppointment(actor as never, "appt-1", 1, { notes: "updated note" } as never);

    expect(dashboardNotifications.enqueueDashboardChangeNotification).not.toHaveBeenCalled();
  });

  it("enqueues cancellation_update with clinic location when a checkup appointment is cancelled", async () => {
    const existingAppointment = {
      id: "appt-1", clinicId: "clinic-1", customerId: "cust-1", petId: "pet-1",
      customerName: "דנה", customerPhone: "+972500000000", petName: "מיקה",
      appointmentType: "checkup", status: "confirmed", source: "front_desk",
      scheduledAt: "2027-01-15T10:00:00.000Z", durationMinutes: 40,
      reason: null, notes: null, version: 1,
      cancelledAt: null, cancelledByUserId: null, cancellationReason: null, createdByUserId: null,
    };
    const appointmentRepository = {
      findById: vi.fn().mockResolvedValue(ok(existingAppointment)),
      updateVersioned: vi.fn().mockResolvedValue(ok({ ...existingAppointment, status: "cancelled", version: 2 })),
    };
    const dashboardNotifications = { enqueueDashboardChangeNotification: vi.fn().mockResolvedValue(ok(undefined)) };
    const auditService = { logAction: vi.fn().mockResolvedValue(ok({})) };
    const service = new AppointmentService(
      appointmentRepository as never, {} as never, {} as never, auditService as never, dashboardNotifications as never,
    );
    const actor = { userId: "user-1", defaultClinicId: "clinic-1", clinicIds: ["clinic-1"], memberships: [] };

    await service.changeStatus(actor as never, "appt-1", 1, { status: "cancelled" } as never);

    expect(dashboardNotifications.enqueueDashboardChangeNotification).toHaveBeenCalledWith(
      expect.objectContaining({ templateKey: "cancellation_update", location: 'הקליניקה, גרציאני 6 ת"א' }),
    );
  });

  it("does not blow up the appointment update when enqueueDashboardChangeNotification is unavailable (dashboardNotifications not injected)", async () => {
    const existingAppointment = {
      id: "appt-1", clinicId: "clinic-1", customerId: "cust-1", petId: "pet-1",
      customerName: "דנה", customerPhone: "+972500000000", petName: "מיקה",
      appointmentType: "checkup", status: "confirmed", source: "front_desk",
      scheduledAt: "2027-01-15T10:00:00.000Z", durationMinutes: 40,
      reason: null, notes: null, version: 1,
      cancelledAt: null, cancelledByUserId: null, cancellationReason: null, createdByUserId: null,
    };
    const appointmentRepository = {
      findById: vi.fn().mockResolvedValue(ok(existingAppointment)),
      findActiveOverlaps: vi.fn().mockResolvedValue(ok([])),
      updateVersioned: vi.fn().mockResolvedValue(ok({ ...existingAppointment, scheduledAt: "2027-01-20T12:00:00.000Z", version: 2 })),
    };
    const auditService = { logAction: vi.fn().mockResolvedValue(ok({})) };
    // No dashboardNotifications argument at all.
    const service = new AppointmentService(appointmentRepository as never, {} as never, {} as never, auditService as never);
    const actor = { userId: "user-1", defaultClinicId: "clinic-1", clinicIds: ["clinic-1"], memberships: [] };

    const result = await service.updateAppointment(actor as never, "appt-1", 1, { scheduledAt: "2027-01-20T12:00:00.000Z" } as never);

    expect(result.ok).toBe(true);
  });
});
```

Adjust the exact method name (`updateAppointment` is an assumption based on Task planning — read the real method name from the file in Step 1) and constructor argument order to match reality.

- [ ] **Step 3: הרץ, ודא כישלון**

```bash
npx vitest run tests/unit/appointment.service.test.ts
```
Expected: FAIL — `enqueueDashboardChangeNotification` never gets called (no such call site exists yet).

- [ ] **Step 4: עדכן `app/lib/services/appointment.service.ts`**

הוסף ל-imports:
```typescript
import { CLINIC_LOCATION, HOME_VISIT_LOCATION } from "@tomer/shared";
```

במתודת העדכון שמשנה `scheduled_at` (אחרי ה-`updateVersioned` המצליח, לפני כתיבת ה-audit או אחריה — לא משנה סדר כי שתיהן עצמאיות, אבל שים את זה **אחרי** ה-audit הקיים כדי לשמור את סדר ה-side-effects הגלוי בקובץ):

```typescript
    if (updated.value.scheduledAt !== existing.value.scheduledAt) {
      await this.dashboardNotifications?.enqueueDashboardChangeNotification({
        clinicId: updated.value.clinicId,
        customerId: updated.value.customerId,
        appointmentId: updated.value.id,
        phone: updated.value.customerPhone ?? "",
        customerName: updated.value.customerName ?? "",
        petName: updated.value.petName ?? "",
        templateKey: "reschedule_update",
        oldScheduledAt: existing.value.scheduledAt,
        newScheduledAt: updated.value.scheduledAt,
        location: updated.value.appointmentType === "home_visit" ? HOME_VISIT_LOCATION : CLINIC_LOCATION,
      });
    }
```

ב-`changeStatus`, בענף שבו `input.status === "cancelled"` (אחרי ה-`updateVersioned` המצליח):

```typescript
    if (input.status === "cancelled") {
      await this.dashboardNotifications?.enqueueDashboardChangeNotification({
        clinicId: updated.value.clinicId,
        customerId: updated.value.customerId,
        appointmentId: updated.value.id,
        phone: updated.value.customerPhone ?? "",
        customerName: updated.value.customerName ?? "",
        petName: updated.value.petName ?? "",
        templateKey: "cancellation_update",
        oldScheduledAt: updated.value.scheduledAt,
        location: updated.value.appointmentType === "home_visit" ? HOME_VISIT_LOCATION : CLINIC_LOCATION,
      });
    }
```

שני הבלוקים משתמשים ב-`?.` (optional chaining) כי `dashboardNotifications` הוא constructor param אופציונלי — קריאה בלי הזרקה (כמו בטסטים ישנים שלא מזריקים אותו) פשוט לא שולחת שום דבר, לא קורסת.

- [ ] **Step 5: הרץ את הטסטים וודא שהם עוברים**

```bash
npx vitest run tests/unit/appointment.service.test.ts
```

- [ ] **Step 6: typecheck + full suite**

```bash
npx tsc --noEmit
npx vitest run
```

- [ ] **Step 7: Commit**

```bash
cd /Users/idoamsalem/mvp-noa-1-0/.worktrees/editable-sms-templates
git add app/lib/services/appointment.service.ts app/tests/unit/appointment.service.test.ts
git commit -m "feat: enqueue dashboard reschedule/cancellation SMS from TS (fixes home-visit location bug)"
```

---

### Task 8: החלת override על שלוש המתודות הקיימות ב-`DashboardNotificationsService`

**Files:**
- Modify: `app/lib/services/dashboard-notifications.service.ts`
- Modify: `app/tests/unit/dashboard-notifications.service.test.ts`

- [ ] **Step 1: הוסף טסט שמוודא ש-`enqueueApprovalNotifications` מכבד override**

```typescript
  it("enqueueApprovalNotifications uses the clinic's booking_confirmation override when present", async () => {
    const single = vi.fn().mockResolvedValue({
      data: { settings: { smsTemplates: { booking_confirmation: "תור אושר! {{petName}}" } } },
      error: null,
    });
    const insert = vi.fn().mockResolvedValue({ error: null });
    const client = {
      from: vi.fn((table: string) =>
        table === "clinics"
          ? { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single }
          : { insert },
      ),
    };
    const service = new DashboardNotificationsService(client as never);

    await service.enqueueApprovalNotifications({
      appointmentId: "appt-1", scheduledAt: "2027-01-15T10:00:00.000Z", durationMinutes: 30,
      visitType: "checkup", clinicId: "clinic-1", customerId: "cust-1", phone: "+972500000000",
      customerName: "דנה", petName: "מיקה",
    });

    const [rows] = insert.mock.calls[0] as [{ type: string; body: string }[]];
    const booking = rows.find((r) => r.type === "booking_confirmation");
    expect(booking!.body).toBe("תור אושר! מיקה");
  });
```

- [ ] **Step 2: הרץ, ודא כישלון**

```bash
cd /Users/idoamsalem/mvp-noa-1-0/.worktrees/editable-sms-templates/app
npx vitest run tests/unit/dashboard-notifications.service.test.ts
```
Expected: FAIL — `enqueueApprovalNotifications` עדיין קורא ל-`smsTemplates.xxx` הישן, מתעלם מ-override.

- [ ] **Step 3: עדכן את שלוש המתודות הקיימות ב-`app/lib/services/dashboard-notifications.service.ts`**

בכל שלוש המתודות (`enqueueApprovalNotifications`, `enqueueRejectionNotification`, `enqueueVaccinationReminder`), הוסף בתחילת הפונקציה:
```typescript
    const overrides = await this.getSmsTemplateOverrides(p.clinicId);
```
והחלף כל קריאה `smsTemplates.xxx(data)` ב-`resolveSmsTemplate("xxx", overrides.xxx, data)`. לדוגמה, ב-`enqueueApprovalNotifications`:

```typescript
  async enqueueApprovalNotifications(p: ApproveNotificationParams): Promise<Result<void>> {
    const overrides = await this.getSmsTemplateOverrides(p.clinicId);
    const now = new Date();
    const { dayName, date, time } = formatAppointmentDateTime(p.scheduledAt);
    const isHome = p.visitType === "home_visit";
    const location = isHome ? HOME_VISIT_LOCATION : CLINIC_LOCATION;
    const visitTypeLabel = VISIT_LABELS[p.visitType] ?? p.visitType;
    const price = VISIT_PRICES[p.visitType] ?? "150 ₪";

    const shared = {
      clinic_id:      p.clinicId,
      customer_id:    p.customerId,
      appointment_id: p.appointmentId,
      phone:          p.phone,
      status:         "pending",
    };

    const rows = [
      {
        ...shared,
        type:          "booking_confirmation",
        body:          resolveSmsTemplate("booking_confirmation", overrides.booking_confirmation, { customerName: p.customerName, petName: p.petName, dayName, date, time, location, visitType: visitTypeLabel, price }),
        scheduled_for: now.toISOString(),
      },
    ];

    const dateIso = israelDateIso(p.scheduledAt);
    const morning = israelDateAtHour(dateIso, 8);
    if (morning > now) {
      rows.push({
        ...shared,
        type:          "morning_reminder",
        body:          resolveSmsTemplate("morning_reminder", overrides.morning_reminder, { customerName: p.customerName, petName: p.petName, time, location, visitType: visitTypeLabel }),
        scheduled_for: morning.toISOString(),
      });
    }

    const followupTime = new Date(new Date(p.scheduledAt).getTime() + p.durationMinutes * 60_000 + 24 * 60 * 60_000);
    rows.push({
      ...shared,
      type:          "post_visit_followup",
      body:          resolveSmsTemplate("post_visit_followup", overrides.post_visit_followup, { customerName: p.customerName, petName: p.petName }),
      scheduled_for: followupTime.toISOString(),
    });

    const { error } = await this.client.from("notifications_log").insert(rows);
    if (error) return err(AppError.externalProvider("Failed to enqueue approval notifications", error));
    return ok(undefined);
  }
```

עדכן `enqueueRejectionNotification` ו-`enqueueVaccinationReminder` באותו דפוס (קריאה אחת ל-`getSmsTemplateOverrides` בתחילת הפונקציה, `resolveSmsTemplate` במקום `smsTemplates.xxx`).

**שים לב:** ה-`requireFields` runtime guard (בתוך `smsTemplates.xxx` הישן) כבר לא רץ כשעוברים ל-`resolveSmsTemplate` ישירות — הולידציה על שדות חסרים כבר קרתה בזמן השמירה של ה-override (Task 3, `smsTemplatesSchema`), ועל הברירת מחדל הקשיחה סומכים כי היא לא משתנה. אין סיכון ל-SMS פגום כי כל קריאה כאן ממשיכה לספק את כל השדות הנדרשים בקוד (`data` object) בדיוק כמו קודם — רק מקור הטקסט (default/override) הוא המשתנה החדש.

- [ ] **Step 4: הרץ את הטסטים וודא שהם עוברים**

```bash
npx vitest run tests/unit/dashboard-notifications.service.test.ts
```

- [ ] **Step 5: `sms-template-parity.test.ts` — חייב עדיין לעבור (אין override בסביבת הטסט, אז ברירת המחדל אמורה לצאת זהה)**

```bash
npx vitest run tests/unit/sms-template-parity.test.ts
```
Expected: 5/5 PASS. אם נכשל, ודא ש-`getSmsTemplateOverrides` על client מדומה שאין לו mock ל-`from("clinics")` באמת מחזירה `{}` (לא זורקת) — ראה Step 4 של Task 6.

- [ ] **Step 6: typecheck + full suite**

```bash
npx tsc --noEmit
npx vitest run
```

- [ ] **Step 7: Commit**

```bash
cd /Users/idoamsalem/mvp-noa-1-0/.worktrees/editable-sms-templates
git add app/lib/services/dashboard-notifications.service.ts app/tests/unit/dashboard-notifications.service.test.ts
git commit -m "feat: honor clinic SMS template overrides in existing DashboardNotificationsService methods"
```

---

### Task 9: `agent/src/lib/notifications.ts` — override עבור booking/morning/arrival/followup/reschedule/client-cancellation

**Files:**
- Modify: `agent/src/lib/notifications.ts`
- Test: `agent/tests/unit/lib/notifications.test.ts`

- [ ] **Step 1: קרא את הקובץ במלואו (כבר הועבר בתכנון) + את הטסט הקיים במלואו**

שים לב לדפוס ה-mock הקיים: `vi.mock("../../../src/lib/supabase.js", () => ({ getSupabase: () => ({ from: mockFrom }) }))`, עם `mockFrom.mockReturnValue({ upsert: mockUpsert, update: mockUpdate })`.

- [ ] **Step 2: הרחב את ה-mock ב-`agent/tests/unit/lib/notifications.test.ts`**

עדכן את בלוק ה-mock הקיים כדי לתמוך גם ב-`.select().eq().single()` (לשליפת `clinics.settings`):

```typescript
const mockUpsert = vi.fn().mockResolvedValue({ error: null });
const mockUpdate = vi.fn().mockResolvedValue({ error: null });
const mockEq = vi.fn();
const mockFrom = vi.fn();
const mockSingle = vi.fn().mockResolvedValue({ data: { settings: { smsTemplates: {} } }, error: null });

vi.mock("../../../src/lib/supabase.js", () => ({
  getSupabase: () => ({
    from: mockFrom,
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockEq.mockReturnValue({ eq: mockEq, error: null });
  mockUpdate.mockReturnValue({ eq: mockEq });
  mockUpsert.mockResolvedValue({ error: null });
  mockSingle.mockResolvedValue({ data: { settings: { smsTemplates: {} } }, error: null });
  mockFrom.mockImplementation((table: string) =>
    table === "clinics"
      ? { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: mockSingle }
      : { upsert: mockUpsert, update: mockUpdate },
  );
});
```

הוסף טסטים חדשים (בסוף הקובץ, `describe` חדש):

```typescript
describe("clinic SMS template overrides", () => {
  it("scheduleBookingNotifications uses the clinic's booking_confirmation override when present", async () => {
    mockSingle.mockResolvedValue({
      data: { settings: { smsTemplates: { booking_confirmation: "אישרנו! {{petName}}" } } },
      error: null,
    });

    await scheduleBookingNotifications({
      appointmentId: "appt-1",
      scheduledAt: "2027-01-15T10:00:00.000Z",
      durationMinutes: 30,
      visitType: "checkup",
      clinicId: "clinic-1",
      customerId: "cust-1",
      phone: "+972500000000",
      customerName: "דנה",
      petName: "מיקה",
    });

    const bookingCall = mockUpsert.mock.calls.find(([row]) => row.type === "booking_confirmation");
    expect(bookingCall![0].body).toBe("אישרנו! מיקה");
  });

  it("scheduleBookingNotifications falls back to default wording when the clinic has no override", async () => {
    await scheduleBookingNotifications({
      appointmentId: "appt-1",
      scheduledAt: "2027-01-15T10:00:00.000Z",
      durationMinutes: 30,
      visitType: "checkup",
      clinicId: "clinic-1",
      customerId: "cust-1",
      phone: "+972500000000",
      customerName: "דנה",
      petName: "מיקה",
    });

    const bookingCall = mockUpsert.mock.calls.find(([row]) => row.type === "booking_confirmation");
    expect(bookingCall![0].body).toContain("נקבע בהצלחה"); // default wording
  });

  it("enqueueRescheduleNotification uses the clinic's reschedule_update override when present", async () => {
    mockSingle.mockResolvedValue({
      data: { settings: { smsTemplates: { reschedule_update: "הועבר ל-{{newDate}}" } } },
      error: null,
    });

    await enqueueRescheduleNotification({
      appointmentId: "appt-1",
      oldScheduledAt: "2027-01-15T10:00:00.000Z",
      newScheduledAt: "2027-01-20T12:00:00.000Z",
      durationMinutes: 30,
      visitType: "home_visit",
      clinicId: "clinic-1",
      customerId: "cust-1",
      phone: "+972500000000",
      customerName: "דנה",
      petName: "מיקה",
    });

    const [row] = mockUpsert.mock.calls[0] as [{ body: string }];
    expect(row.body).toContain("הועבר ל-");
  });

  it("enqueueClientCancellationConfirmation uses the clinic's override when present", async () => {
    mockSingle.mockResolvedValue({
      data: { settings: { smsTemplates: { client_cancellation_confirmation: "בוטל, {{customerName}}" } } },
      error: null,
    });

    await enqueueClientCancellationConfirmation({
      appointmentId: "appt-1",
      scheduledAt: "2027-01-15T10:00:00.000Z",
      clinicId: "clinic-1",
      customerId: "cust-1",
      phone: "+972500000000",
      customerName: "דנה",
      petName: "מיקה",
    });

    const call = mockUpsert.mock.calls.find(([row]) => row.type === "client_cancellation_confirmation");
    expect(call![0].body).toBe("בוטל, דנה");
  });
});
```

- [ ] **Step 3: הרץ, ודא כישלון**

```bash
cd /Users/idoamsalem/mvp-noa-1-0/.worktrees/editable-sms-templates/agent
npx vitest run tests/unit/lib/notifications.test.ts
```
Expected: FAIL — הקוד עדיין קורא ל-`smsTemplates.xxx` הישן, לא שולף override.

- [ ] **Step 4: עדכן `agent/src/lib/notifications.ts`**

עדכן imports:
```typescript
import { getSupabase } from "./supabase.js";
import {
  resolveSmsTemplate,
  formatAppointmentDateTime,
  israelDateIso,
  israelDateAtHour,
  israelDayHourMinute,
  CLINIC_LOCATION,
  HOME_VISIT_LOCATION,
  type SmsTemplateKey,
} from "@tomer/shared";
import { getVisitConfig, type VisitType } from "./appointments.js";
```

(הוסר `smsTemplates`, `BookingConfirmationData`, `MorningReminderData` — כבר לא בשימוש ישיר; `buildBaseParams` ממשיך להחזיר את אותו shape של data, רק לא כטיפוס ה-`Require<...>` הספציפי.)

הוסף helper חדש, ליד `enqueueNotification`:
```typescript
/** Reads clinics.settings.smsTemplates for one clinic. Empty object if there's
 * no override or the row can't be read — callers always have the default text. */
async function getSmsTemplateOverrides(clinicId: string): Promise<Partial<Record<SmsTemplateKey, string>>> {
  const { data, error } = await getSupabase()
    .from("clinics")
    .select("settings")
    .eq("id", clinicId)
    .single();
  if (error || !data) return {};
  return (data.settings?.smsTemplates as Partial<Record<SmsTemplateKey, string>> | undefined) ?? {};
}
```

עדכן `scheduleBookingNotifications`:
```typescript
export async function scheduleBookingNotifications(p: BookingNotificationParams): Promise<void> {
  const overrides = await getSmsTemplateOverrides(p.clinicId);
  const now = new Date();
  const base = buildBaseParams(p.scheduledAt, p.visitType, p.customerName, p.petName);
  const shared = {
    clinicId:      p.clinicId,
    customerId:    p.customerId,
    appointmentId: p.appointmentId,
    phone:         p.phone,
  };

  await enqueueNotification({
    ...shared,
    type:         "booking_confirmation",
    body:         resolveSmsTemplate("booking_confirmation", overrides.booking_confirmation, base),
    scheduledFor: now,
  });

  const appointmentDateIso = israelDateIso(new Date(p.scheduledAt));
  const morning = morningReminderTime(appointmentDateIso);
  if (morning > now) {
    await enqueueNotification({
      ...shared,
      type:         "morning_reminder",
      body:         resolveSmsTemplate("morning_reminder", overrides.morning_reminder, base),
      scheduledFor: morning,
    });
  }

  const arrivalReminderTime = new Date(new Date(p.scheduledAt).getTime() - 2 * 60 * 60_000);
  if (arrivalReminderTime > now) {
    await enqueueNotification({
      ...shared,
      type:         "arrival_reminder",
      body:         resolveSmsTemplate("arrival_reminder", overrides.arrival_reminder, base),
      scheduledFor: arrivalReminderTime,
    });
  }

  const followupTime = new Date(
    new Date(p.scheduledAt).getTime() + p.durationMinutes * 60_000 + 24 * 60 * 60_000,
  );
  await enqueueNotification({
    ...shared,
    type:         "post_visit_followup",
    body:         resolveSmsTemplate("post_visit_followup", overrides.post_visit_followup, { customerName: p.customerName, petName: p.petName }),
    scheduledFor: followupTime,
  });
}
```

עדכן `enqueueRescheduleNotification`:
```typescript
export async function enqueueRescheduleNotification(
  p: RescheduleNotificationParams,
): Promise<void> {
  const overrides = await getSmsTemplateOverrides(p.clinicId);
  const { date: oldDate } = formatAppointmentDateTime(p.oldScheduledAt);
  const { date: newDate, time: newTime } = formatAppointmentDateTime(p.newScheduledAt);
  const location = p.visitType === "home_visit" ? HOME_VISIT_LOCATION : CLINIC_LOCATION;

  await enqueueNotification({
    clinicId:      p.clinicId,
    customerId:    p.customerId,
    appointmentId: p.appointmentId,
    phone:         p.phone,
    type:          "reschedule_update",
    body:          resolveSmsTemplate("reschedule_update", overrides.reschedule_update, {
      customerName: p.customerName,
      petName:      p.petName,
      oldDate,
      newDate,
      newTime,
      location,
    }),
    scheduledFor: new Date(),
  });
}
```

עדכן `enqueueClientCancellationConfirmation`:
```typescript
export async function enqueueClientCancellationConfirmation(
  p: ClientCancellationParams,
): Promise<void> {
  await cancelFutureNotifications(p.appointmentId, p.clinicId);

  const overrides = await getSmsTemplateOverrides(p.clinicId);
  const { date } = formatAppointmentDateTime(p.scheduledAt);
  await enqueueNotification({
    clinicId:      p.clinicId,
    customerId:    p.customerId,
    appointmentId: p.appointmentId,
    phone:         p.phone,
    type:          "client_cancellation_confirmation",
    body:          resolveSmsTemplate("client_cancellation_confirmation", overrides.client_cancellation_confirmation, {
      customerName: p.customerName,
      petName:      p.petName,
      oldDate:      date,
    }),
    scheduledFor: new Date(),
  });
}
```

- [ ] **Step 5: הרץ את הטסטים וודא שהם עוברים**

```bash
npx vitest run tests/unit/lib/notifications.test.ts
```

- [ ] **Step 6: typecheck + full suite של agent**

```bash
cd /Users/idoamsalem/mvp-noa-1-0/.worktrees/editable-sms-templates/agent
npx tsc --noEmit -p tsconfig.typecheck.json
npx vitest run
```

- [ ] **Step 7: Commit**

```bash
cd /Users/idoamsalem/mvp-noa-1-0/.worktrees/editable-sms-templates
git add agent/src/lib/notifications.ts agent/tests/unit/lib/notifications.test.ts
git commit -m "feat(agent): honor clinic SMS template overrides in notifications.ts"
```

---

### Task 10: `agent/src/lib/vaccinationReminders.ts` — override עבור `vaccination_reminder`

**Files:**
- Modify: `agent/src/lib/vaccinationReminders.ts`
- Test: `agent/tests/unit/lib/vaccinationReminders.test.ts` (עדכון/חדש — מוצא בזמן המימוש)

- [ ] **Step 1: קרא את הקובץ במלואו (כבר הועבר בתכנון) + מצא/קרא את הטסט הקיים**

```bash
cd /Users/idoamsalem/mvp-noa-1-0/.worktrees/editable-sms-templates/agent
find tests/unit -iname "*vaccination*"
```

- [ ] **Step 2: הוסף טסט**

הוסף (לקובץ הקיים אם נמצא, באותו סגנון mock כמו Task 9):

```typescript
  it("uses the clinic's vaccination_reminder override when present", async () => {
    // mock getSupabase().from("clinics")...single() to return an override,
    // matching this file's real mock setup pattern found in Step 1.
    // mock getSupabase().from("vaccinations")...  to return one due vaccination row.
    // assert the enqueued notifications_log row's body matches the override, rendered.
  });
```

(הקוד המדויק תלוי במוסכמות ה-mock שנמצאו בפועל בקובץ הקיים — אין קובץ טסט קיים ידוע מראש לקובץ הזה; אם אין, צור `agent/tests/unit/lib/vaccinationReminders.test.ts` חדש לפי הדפוס המדויק שכבר נקבע ב-Task 9 עבור `notifications.test.ts`, כולל מוקים לטבלאות `clinics` ו-`vaccinations`/`notifications_log`.)

- [ ] **Step 3: הרץ, ודא כישלון**

```bash
npx vitest run tests/unit/lib/vaccinationReminders.test.ts
```

- [ ] **Step 4: עדכן `agent/src/lib/vaccinationReminders.ts`**

עדכן imports:
```typescript
import { getSupabase } from "./supabase.js";
import { resolveSmsTemplate, type SmsTemplateKey } from "@tomer/shared";
import { logger } from "./logger.js";
import { israelDateIso } from "./notifications.js";
```

(הוסר `import { smsTemplates } from "../services/sms.templates.js"`.)

בתוך `enqueueDueVaccinationReminders`, לפני הלולאה `for (const row of data)`, הוסף שליפת overrides — **פעם אחת** לכל ריצה, לא פר-שורה (כל השורות ב-`data` שייכות באותה קריאה בעיקרון לאותה קליניקה בפיילוט חד-קליני, אבל ליתר ביטחון וכדי לתמוך גם בעתיד רב-קליני, שולפים לפי `row.clinic_id` בתוך הלולאה עם cache פשוט):

```typescript
export async function enqueueDueVaccinationReminders(): Promise<EnqueueVaccinationRemindersResult> {
  const result: EnqueueVaccinationRemindersResult = { scanned: 0, enqueued: 0, skippedNoPhone: 0, failed: 0 };
  const overridesCache = new Map<string, Partial<Record<SmsTemplateKey, string>>>();

  async function getOverridesFor(clinicId: string): Promise<Partial<Record<SmsTemplateKey, string>>> {
    if (overridesCache.has(clinicId)) return overridesCache.get(clinicId)!;
    const { data, error } = await getSupabase().from("clinics").select("settings").eq("id", clinicId).single();
    const overrides = (!error && data) ? ((data.settings?.smsTemplates as Partial<Record<SmsTemplateKey, string>> | undefined) ?? {}) : {};
    overridesCache.set(clinicId, overrides);
    return overrides;
  }

  // ...existing date-window query unchanged...

  for (const row of data) {
    const pet = Array.isArray(row.pet) ? row.pet[0] : row.pet;
    const customer = Array.isArray(row.customer) ? row.customer[0] : row.customer;
    if (!pet || !customer) continue;

    if (!customer.phone) {
      result.skippedNoPhone++;
      logger.warn({ vaccinationId: row.id, customerId: customer.id }, "vaccination reminder skipped — no phone on file");
      continue;
    }

    const overrides = await getOverridesFor(row.clinic_id);
    const body = resolveSmsTemplate("vaccination_reminder", overrides.vaccination_reminder, {
      customerName: customer.full_name,
      petName: pet.name,
      vaccineName: row.vaccine_name,
    });

    // ...rest unchanged (upsert into notifications_log)...
  }

  return result;
}
```

- [ ] **Step 5: הרץ את הטסטים וודא שהם עוברים**

```bash
npx vitest run tests/unit/lib/vaccinationReminders.test.ts
```

- [ ] **Step 6: typecheck + full suite**

```bash
npx tsc --noEmit -p tsconfig.typecheck.json
npx vitest run
```

- [ ] **Step 7: Commit**

```bash
cd /Users/idoamsalem/mvp-noa-1-0/.worktrees/editable-sms-templates
git add agent/src/lib/vaccinationReminders.ts agent/tests/unit/lib/vaccinationReminders.test.ts
git commit -m "feat(agent): honor clinic SMS template overrides in vaccination reminders"
```

---

### Task 11: UI עריכה ב-`/dashboard/settings`

**Files:**
- Modify: `app/app/dashboard/settings/page.tsx`

- [ ] **Step 1: קרא את הקובץ במלואו**, כולל `CLIENT_SMS`, `SectionTitle`, `Row`, וכל שאר רכיבי ה-UI כבר בשימוש בדף (`Card`, `Field`, `Input`, `useToast`). בדוק אם קיים `Drawer` או `Modal` component ב-`app/components/dashboard/ui/` (חפש `grep -rl "export function Drawer\|export function Modal" app/components/dashboard/ui/`) — זה קובע איזה רכיב תשתמש בו לעריכה.

- [ ] **Step 2: עדכן את `CLIENT_SMS` בראש הקובץ, מ-`{label, when}[]` ל-`{key, label, when}[]`**

```typescript
import type { SmsTemplateKey } from "@tomer/shared";
import { DEFAULT_SMS_TEMPLATE_TEXT, SMS_TEMPLATE_REQUIRED_FIELDS } from "@tomer/shared";

const CLIENT_SMS: Array<{ key: SmsTemplateKey; label: string; when: string }> = [
  { key: "booking_confirmation", label: "אישור קביעת תור", when: "מיד עם הקביעה" },
  { key: "morning_reminder", label: "תזכורת בוקר", when: "08:00 ביום התור" },
  { key: "arrival_reminder", label: "אישור הגעה", when: "שעתיים לפני התור" },
  { key: "post_visit_followup", label: "מעקב אחרי ביקור", when: "יממה לאחר הביקור" },
  { key: "reschedule_update", label: "עדכון שינוי תור", when: "כשנועה משנה תור" },
  { key: "cancellation_update", label: "עדכון ביטול (מהדשבורד)", when: "כשנועה מבטלת תור" },
  { key: "client_cancellation_confirmation", label: "אישור ביטול (מהלקוח)", when: "כשהלקוח מבטל בטלפון" },
  { key: "vaccination_reminder", label: "תזכורת חיסון", when: "14 יום לפני מועד" },
];

const FIELD_LABELS: Record<string, string> = {
  customerName: "שם הלקוח",
  petName: "שם החיה",
  dayName: "יום בשבוע",
  date: "תאריך",
  time: "שעה",
  location: "מיקום",
  visitType: "סוג ביקור",
  price: "מחיר",
  oldDate: "תאריך ישן",
  newDate: "תאריך חדש",
  newTime: "שעה חדשה",
  vaccineName: "שם החיסון",
};
```

- [ ] **Step 3: הוסף state לעריכה, ליד ה-state הקיים בקומפוננטה הראשית**

```typescript
  const [editingKey, setEditingKey] = useState<SmsTemplateKey | null>(null);
  const [draftText, setDraftText] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);
```

- [ ] **Step 4: הוסף פונקציות שמירה/איפוס, ליד שאר ה-handlers הקיימים בקומפוננטה**

```typescript
  function openTemplateEditor(key: SmsTemplateKey) {
    setEditingKey(key);
    setDraftText(settings?.smsTemplates?.[key] ?? DEFAULT_SMS_TEMPLATE_TEXT[key]);
  }

  async function saveTemplate() {
    if (!editingKey) return;
    setSavingTemplate(true);
    try {
      const nextSmsTemplates = { ...(settings?.smsTemplates ?? {}), [editingKey]: draftText };
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ smsTemplates: nextSmsTemplates }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        toast(body?.error?.message || "השמירה נכשלה", "error");
        return;
      }
      const body = (await res.json()) as { data: ClinicSettings };
      setSettings(body.data);
      toast("הניסוח נשמר", "success");
      setEditingKey(null);
    } catch {
      toast("השמירה נכשלה", "error");
    } finally {
      setSavingTemplate(false);
    }
  }

  async function resetTemplateToDefault(key: SmsTemplateKey) {
    setSavingTemplate(true);
    try {
      const nextSmsTemplates = { ...(settings?.smsTemplates ?? {}) };
      delete nextSmsTemplates[key];
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ smsTemplates: nextSmsTemplates }),
      });
      if (!res.ok) {
        toast("האיפוס נכשל", "error");
        return;
      }
      const body = (await res.json()) as { data: ClinicSettings };
      setSettings(body.data);
      toast("אופס לברירת המחדל", "success");
      setEditingKey(null);
    } catch {
      toast("האיפוס נכשל", "error");
    } finally {
      setSavingTemplate(false);
    }
  }
```

התאם את שם ה-state המחזיק את `ClinicSettings` הנוכחי (`settings`/`setSettings` הוא ניחוש — קרא את הקובץ האמיתי ב-Step 1 ועדכן לשם האמיתי) ואת נתיב ה-`useEffect`/`fetch` הראשוני שכבר טוען אותו.

- [ ] **Step 5: עדכן את בלוק ה-JSX שמרנדר את `CLIENT_SMS`**

מצא את ה-JSX הקיים שממפה על `CLIENT_SMS` ומרנדר `Row`. הוסף כפתור "ערוך" לכל שורה:

```typescript
        {CLIENT_SMS.map((sms) => (
          <div key={sms.key} className="flex items-center justify-between gap-3 py-2.5" style={{ borderBottom: "var(--rule)" }}>
            <div>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{sms.label}</p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>{sms.when}</p>
            </div>
            <Btn variant="ghost" size="sm" onClick={() => openTemplateEditor(sms.key)}>ערוך</Btn>
          </div>
        ))}
```

(אמת ש-`Btn` כבר מיובא בקובץ; אם לא, הוסף `import { Btn } from "@/components/dashboard/ui/btn";`.)

- [ ] **Step 6: הוסף את עורך התבנית (Drawer/Modal) בתחתית ה-JSX של הקומפוננטה**

```typescript
      {editingKey && (
        <Drawer open onClose={() => setEditingKey(null)} title={CLIENT_SMS.find((s) => s.key === editingKey)?.label ?? ""}>
          <div className="space-y-3 p-4">
            <textarea
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              rows={8}
              dir="rtl"
              className="w-full text-sm p-3"
              style={{ border: "var(--rule)", borderRadius: "var(--radius-2)", background: "var(--surface-sunken)" }}
            />
            <div>
              <p className="text-xs font-semibold mb-1" style={{ color: "var(--text-muted)" }}>משתנים זמינים:</p>
              <p className="text-xs" style={{ color: "var(--text-faint)" }}>
                {["customerName", "petName", ...SMS_TEMPLATE_REQUIRED_FIELDS[editingKey]]
                  .map((field) => `{{${field}}} (${FIELD_LABELS[field] ?? field})`)
                  .join(" · ")}
              </p>
            </div>
            <div className="flex gap-2">
              <Btn variant="primary" size="sm" loading={savingTemplate} onClick={() => void saveTemplate()}>שמור</Btn>
              <Btn variant="soft" size="sm" loading={savingTemplate} onClick={() => void resetTemplateToDefault(editingKey)}>אפס לברירת מחדל</Btn>
            </div>
          </div>
        </Drawer>
      )}
```

התאם את שם/פרופס הרכיב (`Drawer` הוא ניחוש — אם ב-Step 1 גילית ש-`Modal` הוא הרכיב הקיים בפועל, או שהפרופס שונים, עדכן בהתאם למה שבאמת קיים ב-`app/components/dashboard/ui/`).

- [ ] **Step 7: typecheck**

```bash
cd /Users/idoamsalem/mvp-noa-1-0/.worktrees/editable-sms-templates/app
npx tsc --noEmit
```

- [ ] **Step 8: הרץ את חבילת הטסטים**

```bash
npx vitest run
```
Expected: אין רגרסיה (אין טסט אוטומטי חדש למסך הזה — אימות ידני בהמשך).

- [ ] **Step 9: Commit**

```bash
cd /Users/idoamsalem/mvp-noa-1-0/.worktrees/editable-sms-templates
git add app/app/dashboard/settings/page.tsx
git commit -m "feat: add SMS template editor to /dashboard/settings"
```

---

### Task 12: אימות מלא

**Files:** none — verification only.

- [ ] **Step 1: הרץ את כל שלוש חבילות הטסטים**

```bash
cd /Users/idoamsalem/mvp-noa-1-0/.worktrees/editable-sms-templates
npm run test:all
cd packages/shared && npx vitest run
```
Expected: agent + app + packages/shared כולם ירוקים במלואם.

- [ ] **Step 2: typecheck מלא**

```bash
cd /Users/idoamsalem/mvp-noa-1-0/.worktrees/editable-sms-templates
npm run typecheck:all
```

- [ ] **Step 3: `npm run build --workspace=app`**

```bash
cd app && npm run build
```
Expected: build מצליח, `/dashboard/settings` נבנה ללא שגיאות.

- [ ] **Step 4: build של agent**

```bash
cd /Users/idoamsalem/mvp-noa-1-0/.worktrees/editable-sms-templates/agent
npm run build
```

---

### Task 13: מיגרציה + אישור באג ה-location + merge + deploy

**Files:** none — verification + deployment only.

- [ ] **Step 1: עצור לאישור מפורש — תיקון באג ה-location**

הצג למשתמש/לנועה: מ-Task 7, שינוי ההתנהגות — SMS דחייה/ביטול לביקורי בית יציין מעכשיו "ביקור בית בכתובתכם" במקום כתובת הקליניקה הקבועה. **דורש אישור מפורש לפני merge**, בדיוק כמו כל שינוי ניסוח SMS אחר.

- [ ] **Step 2: עצור לאישור מפורש לפני החלת המיגרציה על הענן**

בדוק `supabase migration list --linked` מול מיגרציות ממתינות לא-קשורות (ראה CLAUDE.md — נוהל coordination בין sessions). לאחר אישור, החל **רק** את המיגרציה הזו (לא `db push` גורף):

```sql
-- (התוכן המלא מ-Task 5, Step 2)
```

- [ ] **Step 3: עצור לאישור מפורש לפני מיזוג ל-main ופריסה**

```bash
cd /Users/idoamsalem/mvp-noa-1-0
git fetch origin main
git merge --no-ff feat/editable-sms-templates
git push origin main
```

- [ ] **Step 4: אימות ידני אחרי הפריסה**

1. כניסה כ-owner/admin → `/dashboard/settings` → כפתור "ערוך" ליד כל אחת מ-8 שורות ה-SMS.
2. עריכת `cancellation_update`, מחיקת `{{oldDate}}` בכוונה, שמירה → אמור להיחסם עם הודעת שגיאה שמזכירה `oldDate`.
3. עריכת `cancellation_update` בתקינות, שמירה, ואז ביטול תור אמיתי מהדשבורד → ה-SMS שיוצא בפועל (בדוק ב-`notifications_log` או בטלפון בדיקה) תואם לניסוח שנשמר, לא לברירת המחדל.
4. דחיית תור ביקור-בית מהדשבורד → ה-SMS מציין "ביקור בית בכתובתכם", לא כתובת הקליניקה.
5. "אפס לברירת מחדל" על תבנית שנערכה → חוזרת לניסוח המקורי.
6. שיחה עם תומר (טלפון) שמזמינה תור → SMS אישור התור תואם לניסוח שהוגדר בהגדרות (אם נערך).

---

## Self-Review

**כיסוי ה-spec:** מודל נתונים (Task 2-4) ✓, מנוע רינדור + תאימות לאחור (Task 1) ✓, תיקון פער הטריגר (Task 5-7) ✓, הרחבה לכל 8 התבניות ב-app/+agent/ (Task 6, 8-10) ✓ — הרחבת היקף שאושרה מעבר למפרט המקורי, UI (Task 11) ✓, אימות+deploy עם 3 נקודות עצירה (Task 12-13) ✓.

**סריקת placeholders:** אין TBD. Task 10 ו-11 מכילים הערות "מוצא/מותאם בזמן המימוש" לגבי שם קובץ טסט/רכיב UI מדויק שלא אומת מראש (אין קובץ טסט קיים ידוע ל-vaccinationReminders, ולא אושר אם `Drawer` או `Modal` הוא הרכיב האמיתי) — זה תואם את המוסכמה בתוכניות קודמות בפרויקט הזה (וידוא מול המערכת האמיתית בזמן ביצוע, לא ניחוש עיוור), לא "TBD" אמיתי.

**עקביות טיפוסים:** `SmsTemplateKey` (Task 1) עקבי בין `@tomer/shared`, `ClinicSettings.smsTemplates` (Task 2), הולידטור (Task 3), `DashboardChangeNotificationParams` (Task 6), וקריאות ה-UI (Task 11). `resolveSmsTemplate(key, customText, data)` בשימוש זהה בכל 4 המקומות (Task 6, 8, 9, 10).
