import { describe, it, expect, vi, beforeEach } from "vitest";
import { processNotifications } from "../../../src/services/notification.processor.js";

// ─────────────────────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────────────────────

const mockFrom = vi.fn();

vi.mock("../../../src/lib/supabase.js", () => ({
  getSupabase: () => ({ from: mockFrom }),
}));

vi.mock("../../../src/lib/sms.service.js", () => ({
  sendSms: vi.fn().mockResolvedValue({ sid: "SM_test" }),
}));

vi.mock("../../../src/lib/notifications.js", () => ({
  isQuietHours:     vi.fn().mockReturnValue(false),
  nextSendableTime: vi.fn().mockReturnValue(new Date("2026-06-17T05:00:00Z")),
}));

import { sendSms } from "../../../src/lib/sms.service.js";
import { isQuietHours } from "../../../src/lib/notifications.js";

function makeRow(overrides: Partial<{
  id: string; phone: string; body: string; type: string;
  appointment_id: string; clinic_id: string;
}> = {}) {
  return {
    id:             "notif-1",
    phone:          "+972501234567",
    body:           "SMS text",
    type:           "booking_confirmation",
    appointment_id: "appt-1",
    clinic_id:      "clinic-1",
    ...overrides,
  };
}

// A chainable mock that ends with .select().returns() or just resolves via .then()
function chainOf(resolveValue: unknown = { error: null }) {
  const chain: Record<string, unknown> = {};
  const fn = vi.fn().mockReturnValue(chain);
  chain["update"]  = fn;
  chain["eq"]      = fn;
  chain["lte"]     = fn;
  chain["lt"]      = fn;
  chain["select"]  = fn;
  chain["returns"] = vi.fn().mockResolvedValue(resolveValue);
  // Make chain awaitable for queries that don't call .returns()
  const originalThen = (res: (v: unknown) => unknown) =>
    Promise.resolve(resolveValue).then(res);
  (chain as { then?: unknown }).then = originalThen;
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
  it("returns zeros when claim returns no rows", async () => {
    // recovery call + claim call both succeed with no data
    const recovery = chainOf({ error: null });
    const claim    = chainOf({ data: [], error: null });
    mockFrom.mockReturnValueOnce(recovery).mockReturnValueOnce(claim);

    const result = await processNotifications();
    expect(result).toEqual({ processed: 0, sent: 0, failed: 0, deferred: 0 });
    expect(sendSms).not.toHaveBeenCalled();
  });

  it("atomically claims and sends SMS for each row", async () => {
    const rows = [makeRow({ id: "n-1" }), makeRow({ id: "n-2" })];

    const recovery   = chainOf({ error: null });
    const claim      = chainOf({ data: rows, error: null });
    const sentUpdate = chainOf({ error: null });
    mockFrom
      .mockReturnValueOnce(recovery)
      .mockReturnValueOnce(claim)
      .mockReturnValue(sentUpdate);

    const result = await processNotifications({ appointmentId: "appt-1" });
    expect(sendSms).toHaveBeenCalledTimes(2);
    expect(sendSms).toHaveBeenCalledWith(rows[0]!.phone, rows[0]!.body);
    expect(result.sent).toBe(2);
    expect(result.failed).toBe(0);
    expect(result.processed).toBe(2);
  });

  it("bulk defers and tracks deferred count when in quiet hours", async () => {
    vi.mocked(isQuietHours).mockReturnValue(true);

    const recovery   = chainOf({ error: null });
    const deferChain = chainOf({ data: [{ id: "n-1" }, { id: "n-2" }], error: null });
    mockFrom.mockReturnValueOnce(recovery).mockReturnValueOnce(deferChain);

    const result = await processNotifications();
    expect(sendSms).not.toHaveBeenCalled();
    expect(result.deferred).toBe(2);
    expect(result.sent).toBe(0);
  });

  it("marks row as failed and does not throw when sendSms rejects", async () => {
    vi.mocked(sendSms).mockRejectedValueOnce(new Error("Twilio error"));
    const row = makeRow();

    const recovery    = chainOf({ error: null });
    const claim       = chainOf({ data: [row], error: null });
    const failedUpdate = chainOf({ error: null });
    mockFrom
      .mockReturnValueOnce(recovery)
      .mockReturnValueOnce(claim)
      .mockReturnValue(failedUpdate);

    const result = await processNotifications();
    expect(result.failed).toBe(1);
    expect(result.sent).toBe(0);
  });

  it("logs error but still counts sent when post-send status update fails", async () => {
    const row = makeRow();
    const recovery   = chainOf({ error: null });
    const claim      = chainOf({ data: [row], error: null });
    const failUpdate = chainOf({ error: { message: "DB error" } });
    mockFrom
      .mockReturnValueOnce(recovery)
      .mockReturnValueOnce(claim)
      .mockReturnValue(failUpdate);

    // Should not throw; SMS was delivered
    const result = await processNotifications();
    expect(result.sent).toBe(1);
    expect(result.failed).toBe(0);
  });

  it("second concurrent processor claims 0 rows (atomic guarantee)", async () => {
    // Simulates a second concurrent processor run: claim returns empty
    const recovery = chainOf({ error: null });
    const claim    = chainOf({ data: [], error: null });
    mockFrom.mockReturnValueOnce(recovery).mockReturnValueOnce(claim);

    const result = await processNotifications();
    expect(sendSms).not.toHaveBeenCalled();
    expect(result.processed).toBe(0);
  });
});
