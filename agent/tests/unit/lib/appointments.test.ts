import { describe, it, expect } from "vitest";
import {
  getClinicHours,
  getDayNameHe,
  generateAllSlots,
  filterFreeSlots,
  formatSlotLabel,
  formatDateHe,
} from "../../../src/lib/appointments.js";

// 2026-06-14 = Sunday, 2026-06-19 = Friday, 2026-06-20 = Saturday
// (verified: June 14 2026 is a Sunday)

describe("getClinicHours", () => {
  it("ראשון (14/6/2026) → 08:00-20:00", () => {
    const h = getClinicHours("2026-06-14");
    expect(h).not.toBeNull();
    expect(h!.start).toEqual({ h: 8, m: 0 });
    expect(h!.end).toEqual({ h: 20, m: 0 });
  });

  it("חמישי (18/6/2026) → 08:00-20:00", () => {
    const h = getClinicHours("2026-06-18");
    expect(h).not.toBeNull();
    expect(h!.start).toEqual({ h: 8, m: 0 });
    expect(h!.end).toEqual({ h: 20, m: 0 });
  });

  it("שישי (19/6/2026) → 08:30-13:00", () => {
    const h = getClinicHours("2026-06-19");
    expect(h).not.toBeNull();
    expect(h!.start).toEqual({ h: 8, m: 30 });
    expect(h!.end).toEqual({ h: 13, m: 0 });
  });

  it("שבת (20/6/2026) → null (סגור)", () => {
    expect(getClinicHours("2026-06-20")).toBeNull();
  });
});

describe("generateAllSlots", () => {
  it("יום חול — מתחיל ב-08:00 ומסיים ב-19:30", () => {
    const slots = generateAllSlots("2026-06-14", { start: { h: 8, m: 0 }, end: { h: 20, m: 0 } });
    expect(formatSlotLabel(slots[0]!)).toBe("08:00");
    expect(formatSlotLabel(slots[slots.length - 1]!)).toBe("19:30");
    expect(slots).toHaveLength(24); // 8:00..19:30 = 24 slots
  });

  it("שישי — מתחיל ב-08:30 ומסיים ב-12:30", () => {
    const slots = generateAllSlots("2026-06-19", { start: { h: 8, m: 30 }, end: { h: 13, m: 0 } });
    expect(formatSlotLabel(slots[0]!)).toBe("08:30");
    expect(formatSlotLabel(slots[slots.length - 1]!)).toBe("12:30");
    expect(slots).toHaveLength(9); // 8:30..12:30 = 9 slots
  });
});

describe("filterFreeSlots", () => {
  it("ללא תורים תפוסים — מחזיר עד 8 slots ראשונים", () => {
    const all = generateAllSlots("2026-06-14", { start: { h: 8, m: 0 }, end: { h: 20, m: 0 } });
    const free = filterFreeSlots(all, []);
    expect(free).toHaveLength(8);
    expect(formatSlotLabel(free[0]!)).toBe("08:00");
  });

  it("שלושה תפוסים — מוציא אותם", () => {
    const all = generateAllSlots("2026-06-14", { start: { h: 8, m: 0 }, end: { h: 20, m: 0 } });
    const taken = [all[0]!, all[1]!, all[2]!];
    const free = filterFreeSlots(all, taken);
    expect(formatSlotLabel(free[0]!)).toBe("09:30"); // slots 0,1,2 removed (08:00,08:30,09:00)
  });

  it("כל ה-slots תפוסים — מחזיר []", () => {
    const all = generateAllSlots("2026-06-14", { start: { h: 8, m: 0 }, end: { h: 20, m: 0 } });
    const free = filterFreeSlots(all, all);
    expect(free).toHaveLength(0);
  });
});

describe("formatDateHe", () => {
  it("2026-06-15 → 15/06/2026", () => {
    expect(formatDateHe("2026-06-15")).toBe("15/06/2026");
  });
});

describe("getDayNameHe", () => {
  it("2026-06-14 (Sunday) → ראשון", () => {
    expect(getDayNameHe("2026-06-14")).toBe("ראשון");
  });

  it("2026-06-19 (Friday) → שישי", () => {
    expect(getDayNameHe("2026-06-19")).toBe("שישי");
  });

  it("2026-06-20 (Saturday) → שבת", () => {
    expect(getDayNameHe("2026-06-20")).toBe("שבת");
  });
});
