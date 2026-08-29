import { describe, expect, it } from "vitest";
import { computeInvoiceTotal, formatInvoiceNumber } from "@/lib/services/invoice.service";

describe("computeInvoiceTotal", () => {
  it("sums quantity * unitPrice across all line items", () => {
    const total = computeInvoiceTotal([
      { description: "בדיקה כללית", quantity: 1, unitPrice: 180 },
      { description: "חיסון שנתי", quantity: 1, unitPrice: 120 },
      { description: "זריקות נוגדות פרעושים", quantity: 3, unitPrice: 50 },
    ]);

    expect(total).toBe(450);
  });

  it("rounds to 2 decimal places to avoid floating-point drift", () => {
    const total = computeInvoiceTotal([
      { description: "טיפול", quantity: 3, unitPrice: 33.33 },
    ]);

    expect(total).toBe(99.99);
  });

  it("returns 0 for an empty item list", () => {
    expect(computeInvoiceTotal([])).toBe(0);
  });
});

describe("formatInvoiceNumber", () => {
  it("formats as INV-<year>-<3-digit sequence>", () => {
    expect(formatInvoiceNumber(new Date("2026-08-29T00:00:00Z"), 1)).toBe("INV-2026-001");
    expect(formatInvoiceNumber(new Date("2026-08-29T00:00:00Z"), 42)).toBe("INV-2026-042");
  });

  it("does not truncate a sequence number past 3 digits", () => {
    expect(formatInvoiceNumber(new Date("2026-08-29T00:00:00Z"), 1234)).toBe("INV-2026-1234");
  });
});
