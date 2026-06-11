export interface SmsTemplateData {
  customerName: string;
  petName: string;
  dayName?: string;      // יום בשבוע בעברית: "יום שלישי"
  date?: string;         // "17.6.2026"
  time?: string;         // "16:30"
  location?: string;     // "הקליניקה, גרציאני 6 ת"א" / "ביקור בית בכתובתכם"
  visitType?: string;    // "בדיקה" / "חיסונים" / "ביקור בית"
  price?: string;        // "150"
  oldDate?: string;
  newDate?: string;
  newTime?: string;
}

// Clinic address constant — used for location in all non-home-visit appointments.
export const CLINIC_LOCATION = 'הקליניקה, גרציאני 6 ת"א';
export const HOME_VISIT_LOCATION = "ביקור בית בכתובתכם";

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
  booking_confirmation: (d: SmsTemplateData) =>
    `שלום ${d.customerName}, כאן תומר ממרפאת Get A Vet של ד"ר נועה כבשני.\n` +
    `התור של ${d.petName} נקבע בהצלחה ✅\n` +
    `📅 ${d.dayName}, ${d.date} | 🕒 ${d.time} | 📍 ${d.location}\n` +
    `🩺 ${d.visitType} | 💳 ${d.price} ₪\n` +
    `לשינוי או ביטול (חינם עד 4 שעות לפני התור) — חייגו אלינו.\n` +
    `מאחלים ל${d.petName} בריאות שלמה 🐾`,

  morning_reminder: (d: SmsTemplateData) =>
    `בוקר טוב ${d.customerName} ☀️ תזכורת מ-Get A Vet:\n` +
    `היום 🕒 ${d.time} | ${d.visitType} ל${d.petName} | 📍 ${d.location}\n` +
    `אם משהו השתנה — חייגו אלינו בהקדם האפשרי.\n` +
    `מחכים לכם, תומר וד"ר נועה 🐾`,

  post_visit_followup: (d: SmsTemplateData) =>
    `שלום ${d.customerName}, כאן תומר מ-Get A Vet 🐾\n` +
    `רצינו לשאול מה שלום ${d.petName} אחרי הביקור אצל ד"ר נועה — האם המצב משתפר?\n` +
    `אם יש שאלות, החמרה או כל דבר אחר — אנחנו זמינים בטלפון.\n` +
    `החלמה מהירה ל${d.petName} ❤️`,

  reschedule_update: (d: SmsTemplateData) =>
    `שלום ${d.customerName}, עדכון מ-Get A Vet:\n` +
    `בשל אילוץ רפואי, התור של ${d.petName} מיום ${d.oldDate} עודכן:\n` +
    `📅 מועד חדש: ${d.newDate} | 🕒 ${d.newTime} | 📍 ${d.location}\n` +
    `המועד לא מתאים? חייגו אלינו ונמצא זמן אחר.\n` +
    `מתנצלים על אי הנוחות 🙏 תומר, Get A Vet`,

  cancellation_update: (d: SmsTemplateData) =>
    `שלום ${d.customerName}, עדכון מ-Get A Vet:\n` +
    `בשל אילוץ רפואי, התור של ${d.petName} מיום ${d.oldDate} בוטל.\n` +
    `נשמח לתאם מועד חדש — חייגו אלינו ונמצא זמן שנוח לכם.\n` +
    `מתנצלים על אי הנוחות 🙏 תומר, Get A Vet`,
} as const;
