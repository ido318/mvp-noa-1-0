import type { ClinicSettings } from "@/types/domain/clinic";

// Mirrors what the settings page used to hardcode. Acts as the fallback for any
// key missing from clinics.settings, so an untouched clinic renders identically
// to before this became editable.
export const DEFAULT_CLINIC_SETTINGS: ClinicSettings = {
  businessHours: [
    { day: "ראשון–חמישי", hours: "08:00–20:00" },
    { day: "שישי", hours: "08:30–13:00" },
    { day: "שבת", hours: "סגור" },
  ],
  visitPrices: [
    { label: "בדיקה בקליניקה", detail: "150 ₪ · 30 דק׳" },
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
};

export function withClinicSettingsDefaults(
  stored: Partial<ClinicSettings> | null | undefined,
): ClinicSettings {
  // `??` (not a `.length` check) so a deliberately emptied array survives a
  // round-trip instead of being silently replaced by the defaults again.
  return {
    businessHours: stored?.businessHours ?? DEFAULT_CLINIC_SETTINGS.businessHours,
    visitPrices: stored?.visitPrices ?? DEFAULT_CLINIC_SETTINGS.visitPrices,
    contact: {
      ...DEFAULT_CLINIC_SETTINGS.contact,
      ...stored?.contact,
    },
  };
}
