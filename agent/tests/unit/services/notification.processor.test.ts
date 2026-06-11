import { describe, it, expect, vi, beforeEach } from "vitest";
import { processNotifications } from "../../../src/services/notification.processor.js";

// ─────────────────────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────────────────────

const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockLte = vi.fn();
const mockUpdate = vi.fn();
const mockFrom = vi.fn();
const mockReturns = vi.fn();

vi.mock("../../../src/lib/supabase.js", () => ({
  getSupabase: () => ({ from: mockFrom }),
}));

vi.mock("../../../src/lib/sms.service.js", () => ({
  sendSms: vi.fn().mockResolvedValue({ sid: "SM_test" }),
}));

vi.mock("../../../src/lib/notifications.js", () => ({
  isQuietHours: vi.fn().mockReturnValue(false),
  nextSendableTime: vi.fn().mockReturnValue(new Date("2026-06-17T05:00:00Z")),
}));

import { sendSms } from "../../../src/lib/sms.service.js";
import { isQuietHours } from "../../../src/lib/notifications.js";

const makeRow = (overrides: Partial<{
  id: string; phone: string; body: string; type: string;
  appointment_id: string; clinic_id: string;
}> = {}) => ({
  id:             "notif-1",
  phone:          "+972501234567",
  body:           "SMS text",
  type:           "booking_confirmation",
  appointment_id: "appt-1",
  clinic_id:      "clinic-1",
  ...overrides,
});

function setupQueryChain(rows: object[]) {
  // Build chain: from().select().eq().eq().lte().returns() → { data: rows, error: null }
  const chain = {
    select:  vi.fn().mockReturnThis(),
    eq:      vi.fn().mockReturnThis(),
    lte:     vi.fn().mockReturnThis(),
    returns: vi.fn().mockResolvedValue({ data: rows, error: null }),
  };
  const updateChain = { eq: vi.fn().mockReturnThis(), update: vi.fn().mockReturnThis() };
  mockFrom.mockReturnValueOnce(chain).mockReturnValue({
    update: vi.fn().mockReturnValue(updateChain),
  });
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(isQuietHours).mockReturnValue(false);
  vi.mocked(sendSms).mockResolvedValue({ sid: "SM_test" });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("processNotifications", () => {
  it("returns zeros when no pending rows", async () => {
    const chain = {
      select:  vi.fn().mockReturnThis(),
      eq:      vi.fn().mockReturnThis(),
      lte:     vi.fn().mockReturnThis(),
      returns: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    mockFrom.mockReturnValue(chain);

    const result = await processNotifications();
    expect(result).toEqual({ processed: 0, sent: 0, failed: 0, deferred: 0 });
  });

  it("sends SMS and marks as sent when not in quiet hours", async () => {
    const row = makeRow();
    setupQueryChain([row]);

    const result = await processNotifications({ appointmentId: "appt-1" });
    expect(sendSms).toHaveBeenCalledWith(row.phone, row.body);
    expect(result.sent).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.deferred).toBe(0);
  });

  it("defers when in quiet hours", async () => {
    vi.mocked(isQuietHours).mockReturnValue(true);
    const row = makeRow();

    const deferUpdateChain = { eq: vi.fn().mockReturnThis() };
    deferUpdateChain.eq.mockReturnValue(deferUpdateChain);
    deferUpdateChain.eq.mockReturnValueOnce(deferUpdateChain).mockReturnValueOnce({ error: null });

    const queryChain = {
      select:  vi.fn().mockReturnThis(),
      eq:      vi.fn().mockReturnThis(),
      lte:     vi.fn().mockReturnThis(),
      returns: vi.fn().mockResolvedValue({ data: [row], error: null }),
    };
    mockFrom
      .mockReturnValueOnce(queryChain)
      .mockReturnValue({ update: vi.fn().mockReturnValue(deferUpdateChain) });

    const result = await processNotifications();
    expect(sendSms).not.toHaveBeenCalled();
    expect(result.deferred).toBe(1);
    expect(result.sent).toBe(0);
  });

  it("marks as failed and does not throw when sendSms rejects", async () => {
    vi.mocked(sendSms).mockRejectedValueOnce(new Error("Twilio error"));
    const row = makeRow();

    const failUpdateChain = { eq: vi.fn().mockReturnThis() };
    failUpdateChain.eq.mockReturnValue({ error: null });

    const queryChain = {
      select:  vi.fn().mockReturnThis(),
      eq:      vi.fn().mockReturnThis(),
      lte:     vi.fn().mockReturnThis(),
      returns: vi.fn().mockResolvedValue({ data: [row], error: null }),
    };
    mockFrom
      .mockReturnValueOnce(queryChain)
      .mockReturnValue({ update: vi.fn().mockReturnValue(failUpdateChain) });

    const result = await processNotifications();
    expect(result.failed).toBe(1);
    expect(result.sent).toBe(0);
  });

  it("processes multiple rows independently", async () => {
    const rows = [makeRow({ id: "n-1" }), makeRow({ id: "n-2" })];

    const sentUpdateChain = { eq: vi.fn().mockReturnThis() };
    sentUpdateChain.eq.mockReturnValue({ error: null });

    const queryChain = {
      select:  vi.fn().mockReturnThis(),
      eq:      vi.fn().mockReturnThis(),
      lte:     vi.fn().mockReturnThis(),
      returns: vi.fn().mockResolvedValue({ data: rows, error: null }),
    };
    mockFrom
      .mockReturnValueOnce(queryChain)
      .mockReturnValue({ update: vi.fn().mockReturnValue(sentUpdateChain) });

    const result = await processNotifications();
    expect(result.processed).toBe(2);
    expect(result.sent).toBe(2);
    expect(sendSms).toHaveBeenCalledTimes(2);
  });
});
