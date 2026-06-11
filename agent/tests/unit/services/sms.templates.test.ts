import { describe, it, expect } from "vitest";
import {
  smsTemplates,
  formatAppointmentDateTime,
  CLINIC_LOCATION,
  HOME_VISIT_LOCATION,
} from "../../../src/services/sms.templates.js";

const SAMPLE_CLINIC: Parameters<typeof smsTemplates.booking_confirmation>[0] = {
  customerName: "שרה לוי",
  petName: "ביסלי",
  dayName: "יום שלישי",
  date: "17.6.2026",
  time: "16:30",
  location: CLINIC_LOCATION,
  visitType: "בדיקה",
  price: "150",
};

const SAMPLE_HOME: Parameters<typeof smsTemplates.morning_reminder>[0] = {
  customerName: "שרה לוי",
  petName: "ביסלי",
  time: "10:00",
  location: HOME_VISIT_LOCATION,
  visitType: "ביקור בית",
};

const SAMPLE_RESCHEDULE: Parameters<typeof smsTemplates.reschedule_update>[0] = {
  customerName: "שרה לוי",
  petName: "ביסלי",
  oldDate: "17.6.2026",
  newDate: "19.6.2026",
  newTime: "11:00",
  location: CLINIC_LOCATION,
};

const SAMPLE_CANCEL: Parameters<typeof smsTemplates.cancellation_update>[0] = {
  customerName: "שרה לוי",
  petName: "ביסלי",
  oldDate: "17.6.2026",
};

describe("smsTemplates snapshots", () => {
  it("booking_confirmation — clinic", () => {
    expect(smsTemplates.booking_confirmation(SAMPLE_CLINIC)).toMatchInlineSnapshot(`
      "שלום שרה לוי, כאן תומר ממרפאת Get A Vet של ד"ר נועה כבשני.
      התור של ביסלי נקבע בהצלחה ✅
      📅 יום שלישי, 17.6.2026 | 🕒 16:30 | 📍 הקליניקה, גרציאני 6 ת"א
      🩺 בדיקה | 💳 150 ₪
      לשינוי או ביטול (חינם עד 4 שעות לפני התור) — חייגו אלינו.
      מאחלים לביסלי בריאות שלמה 🐾"
    `);
  });

  it("morning_reminder — home visit", () => {
    expect(smsTemplates.morning_reminder(SAMPLE_HOME)).toMatchInlineSnapshot(`
      "בוקר טוב שרה לוי ☀️ תזכורת מ-Get A Vet:
      היום 🕒 10:00 | ביקור בית לביסלי | 📍 ביקור בית בכתובתכם
      אם משהו השתנה — חייגו אלינו בהקדם האפשרי.
      מחכים לכם, תומר וד"ר נועה 🐾"
    `);
  });

  it("post_visit_followup", () => {
    expect(
      smsTemplates.post_visit_followup({ customerName: "שרה לוי", petName: "ביסלי" }),
    ).toMatchInlineSnapshot(`
      "שלום שרה לוי, כאן תומר מ-Get A Vet 🐾
      רצינו לשאול מה שלום ביסלי אחרי הביקור אצל ד"ר נועה — האם המצב משתפר?
      אם יש שאלות, החמרה או כל דבר אחר — אנחנו זמינים בטלפון.
      החלמה מהירה לביסלי ❤️"
    `);
  });

  it("reschedule_update", () => {
    expect(smsTemplates.reschedule_update(SAMPLE_RESCHEDULE)).toMatchInlineSnapshot(`
      "שלום שרה לוי, עדכון מ-Get A Vet:
      בשל אילוץ רפואי, התור של ביסלי מיום 17.6.2026 עודכן:
      📅 מועד חדש: 19.6.2026 | 🕒 11:00 | 📍 הקליניקה, גרציאני 6 ת"א
      המועד לא מתאים? חייגו אלינו ונמצא זמן אחר.
      מתנצלים על אי הנוחות 🙏 תומר, Get A Vet"
    `);
  });

  it("cancellation_update", () => {
    expect(smsTemplates.cancellation_update(SAMPLE_CANCEL)).toMatchInlineSnapshot(`
      "שלום שרה לוי, עדכון מ-Get A Vet:
      בשל אילוץ רפואי, התור של ביסלי מיום 17.6.2026 בוטל.
      נשמח לתאם מועד חדש — חייגו אלינו ונמצא זמן שנוח לכם.
      מתנצלים על אי הנוחות 🙏 תומר, Get A Vet"
    `);
  });
});

describe("formatAppointmentDateTime", () => {
  it("formats Jerusalem time correctly — not UTC", () => {
    // 2026-06-17T14:30:00Z = 17:30 in Jerusalem (UTC+3 in summer)
    const result = formatAppointmentDateTime("2026-06-17T14:30:00Z");
    expect(result.time).toBe("17:30");
    expect(result.date).toContain("17");
    expect(result.dayName).toBeTruthy();
  });

  it("midnight UTC does not bleed into previous day in Jerusalem", () => {
    // 2026-06-17T00:00:00Z = 03:00 Jerusalem — still June 17
    const result = formatAppointmentDateTime("2026-06-17T00:00:00Z");
    expect(result.date).toContain("17");
    expect(result.time).toBe("03:00");
  });
});
