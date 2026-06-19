import { describe, expect, it } from "vitest";
import { israelDateIso } from "@/lib/israel-date";

describe("israelDateIso", () => {
  it("מקבץ תור לפי תאריך ישראל גם כשה-UTC ביום הקודם", () => {
    expect(israelDateIso("2026-06-21T22:30:00.000Z")).toBe("2026-06-22");
  });
});
