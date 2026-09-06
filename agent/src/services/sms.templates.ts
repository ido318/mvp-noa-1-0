export interface SmsTemplateData {
  customerName: string;
  petName: string;
  dayName?: string;      // יום בשבוע בעברית: "יום שלישי"
  date?: string;         // "17.6.2026"
  time?: string;         // "16:30"
  location?: string;     // "הקליניקה, גרציאני 6 ת"א" / "ביקור בית בכתובתכם"
  visitType?: string;    // "בדיקה" / "חיסונים" / "ביקור בית"
  price?: string;        // "150 ₪" — a full segment, so a service with no
                         // fixed price can say so instead of naming a number
  oldDate?: string;
  newDate?: string;
  newTime?: string;
  vaccineName?: string;
}

// Clinic address constant — used for location in all non-home-visit appointments.
export const CLINIC_LOCATION = 'הקליניקה, גרציאני 6 ת"א';
export const HOME_VISIT_LOCATION = "ביקור בית בכתובתכם";

// Per-template required-field types — callers get compile-time errors for missing fields.
type Require<T, K extends keyof T> = T & Required<Pick<T, K>>;

export type BookingConfirmationData = Require<SmsTemplateData, "dayName" | "date" | "time" | "location" | "visitType" | "price">;
export type MorningReminderData     = Require<SmsTemplateData, "time" | "location" | "visitType">;
export type RescheduleUpdateData    = Require<SmsTemplateData, "oldDate" | "newDate" | "newTime" | "location">;
export type CancellationUpdateData  = Require<SmsTemplateData, "oldDate">;
export type VaccinationReminderData = Require<SmsTemplateData, "vaccineName" | "petName">;

// Runtime guard — throws before a malformed SMS is sent.
function requireFields<T extends SmsTemplateData>(d: T, fields: (keyof T)[], template: string): void {
  const missing = fields.filter((f) => d[f] === undefined || d[f] === "");
  if (missing.length > 0) {
    throw new Error(`smsTemplates.${template}: missing required fields: ${missing.join(", ")}`);
  }
}

/**
 * Format an ISO datetime string (or Date) for SMS output using Jerusalem timezone.
 * Returns { dayName, date, time } — never raw UTC.
 */
export function formatAppointmentDateTime(isoOrDate: string | Date): {
  dayName: string;
  date: string;
  time: string;
} {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  const tz = "Asia/Jerusalem";

  const dayName = new Intl.DateTimeFormat("he-IL", {
    timeZone: tz,
    weekday: "long",
  }).format(d);

  const { day, month, year } = new Intl.DateTimeFormat("he-IL", {
    timeZone: tz,
    day: "numeric",
    month: "numeric",
    year: "numeric",
  })
    .formatToParts(d)
    .reduce<Record<string, string>>((acc, p) => {
      acc[p.type] = p.value;
      return acc;
    }, {});

  const date = `${day}.${month}.${year}`;

  const time = new Intl.DateTimeFormat("he-IL", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);

  return { dayName, date, time };
}

export const smsTemplates = {
  booking_confirmation: (d: BookingConfirmationData) => {
    requireFields(d, ["dayName", "date", "time", "location", "visitType", "price"], "booking_confirmation");
    return (
      `שלום ${d.customerName}, כאן תומר ממרפאת Get A Vet של ד"ר נועה כבשני.\n` +
      `התור של ${d.petName} נקבע בהצלחה ✅\n` +
      `📅 ${d.dayName}, ${d.date} | 🕒 ${d.time} | 📍 ${d.location}\n` +
      `🩺 ${d.visitType} | 💳 ${d.price}\n` +
      `לשינוי או ביטול (חינם עד 4 שעות לפני התור) — חייגו אלינו.\n` +
      `מאחלים ל${d.petName} בריאות שלמה 🐾`
    );
  },

  morning_reminder: (d: MorningReminderData) => {
    requireFields(d, ["time", "location", "visitType"], "morning_reminder");
    return (
      `בוקר טוב ${d.customerName} ☀️ תזכורת מ-Get A Vet:\n` +
      `היום 🕒 ${d.time} | ${d.visitType} ל${d.petName} | 📍 ${d.location}\n` +
      `אם משהו השתנה — חייגו אלינו בהקדם האפשרי.\n` +
      `מחכים לכם, תומר וד"ר נועה 🐾`
    );
  },

  arrival_reminder: (d: MorningReminderData) => {
    requireFields(d, ["time", "location", "visitType"], "arrival_reminder");
    return (
      `שלום ${d.customerName}, כאן תומר מ-Get A Vet ⏰\n` +
      `מזכירים: התור של ${d.petName} היום בשעה ${d.time} | ${d.visitType} | 📍 ${d.location}\n` +
      `אם לא תוכלו להגיע — חייגו אלינו בהקדם.\n` +
      `נתראה בקרוב 🐾`
    );
  },

  post_visit_followup: (d: SmsTemplateData) =>
    `שלום ${d.customerName}, כאן תומר מ-Get A Vet 🐾\n` +
    `רצינו לשאול מה שלום ${d.petName} אחרי הביקור אצל ד"ר נועה — האם המצב משתפר?\n` +
    `אם יש שאלות, החמרה או כל דבר אחר — אנחנו זמינים בטלפון.\n` +
    `החלמה מהירה ל${d.petName} ❤️`,

  reschedule_update: (d: RescheduleUpdateData) => {
    requireFields(d, ["oldDate", "newDate", "newTime", "location"], "reschedule_update");
    return (
      `שלום ${d.customerName}, עדכון מ-Get A Vet:\n` +
      `בשל אילוץ רפואי, התור של ${d.petName} מיום ${d.oldDate} עודכן:\n` +
      `📅 מועד חדש: ${d.newDate} | 🕒 ${d.newTime} | 📍 ${d.location}\n` +
      `המועד לא מתאים? חייגו אלינו ונמצא זמן אחר.\n` +
      `מתנצלים על אי הנוחות 🙏 תומר, Get A Vet`
    );
  },

  cancellation_update: (d: CancellationUpdateData) => {
    requireFields(d, ["oldDate"], "cancellation_update");
    return (
      `שלום ${d.customerName}, עדכון מ-Get A Vet:\n` +
      `בשל אילוץ רפואי, התור של ${d.petName} מיום ${d.oldDate} בוטל.\n` +
      `נשמח לתאם מועד חדש — חייגו אלינו ונמצא זמן שנוח לכם.\n` +
      `מתנצלים על אי הנוחות 🙏 תומר, Get A Vet`
    );
  },

  client_cancellation_confirmation: (d: CancellationUpdateData) => {
    requireFields(d, ["oldDate"], "client_cancellation_confirmation");
    return (
      `שלום ${d.customerName}, מאשרים: התור של ${d.petName} מיום ${d.oldDate} בוטל לבקשתכם.\n` +
      `נשמח לראותכם שוב — לקביעת תור חדש חייגו אלינו בכל עת.\n` +
      `תומר, Get A Vet 🐾`
    );
  },

  vaccination_reminder: (d: VaccinationReminderData) => {
    requireFields(d, ["vaccineName", "petName"], "vaccination_reminder");
    return (
      `שלום ${d.customerName}, כאן תומר מ-Get A Vet 💉\n` +
      `הגיע הזמן לחיסון הבא של ${d.petName} (${d.vaccineName}) — מומלץ לתאם בקרוב לשמירה על הבריאות.\n` +
      `לתיאום תור נוח — חייגו אלינו בכל עת.\n` +
      `בריאות ל${d.petName} 🐾 תומר, Get A Vet`
    );
  },
};
