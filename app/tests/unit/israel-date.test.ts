import { describe, expect, it } from "vitest";
import {
  formatIsraelDate,
  formatIsraelDateTime,
  formatIsraelTime,
  israelDateIso,
} from "@/lib/israel-date";

describe("israelDateIso", () => {
  it("מקבץ תור לפי תאריך ישראל גם כשה-UTC ביום הקודם", () => {
    expect(israelDateIso("2026-06-21T22:30:00.000Z")).toBe("2026-06-22");
  });
});

describe("Israel date/time display formatting", () => {
  it("formats time in 24-hour Israel time", () => {
    expect(formatIsraelTime("2026-06-20T10:00:00.000Z")).toBe("13:00");
  });

  it("formats dates as dd/mm/yy", () => {
    expect(formatIsraelDate("2026-06-20T10:00:00.000Z")).toBe("20/06/26");
  });

  it("formats date and time together without 12-hour clock", () => {
    expect(formatIsraelDateTime("2026-06-20T10:00:00.000Z")).toBe("20/06/26 13:00");
  });
});
