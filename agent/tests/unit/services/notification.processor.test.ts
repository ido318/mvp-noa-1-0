import { describe, it, expect, vi, beforeEach } from "vitest";
import { processNotifications } from "../../../src/services/notification.processor.js";

// ─────────────────────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("../../../src/lib/supabase.js", () => ({
  getSupabase: () => ({ from: mockFrom }),
}));

vi.mock("../../../src/lib/sms.service.js", () => ({
  sendSms: vi.fn().mockResolvedValue({ sid: "SM_test" }),
}));

vi.mock("../../../src/lib/notifications.js", () => ({
  isQuietHours:    vi.fn().mockReturnValue(false),
  nextSendableTime: vi.fn().mockReturnValue(new Date("2026-06-17T05:00:00Z")),
}));

import { sendSms } from "../../../src/lib/sms.service.js";
import { isQuietHours } from "../../../src/lib/notifications.js";

const mockFrom = vi.fn();

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

// Build a chainable mock that ends with .returns({ data, error })
function makeClaimChain(data: object[] | null, error: object | null = null) {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  chain["update"]  = vi.fn(self);
  chain["eq"]      = vi.fn(self);
  chain["lte"]     = vi.fn(self);
  chain["select"]  = vi.fn(self);
  chain["returns"] = vi.fn().mockResolvedValue({ data, error });
  return chain;
}

// Build a chainable mock for UPDATE without select (defer / status update)
function makeUpdateChain(error: object | null = null) {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  chain["update"] = vi.fn(self);
  chain["eq"]     = vi.fn(self);
  chain["lte"]    = vi.fn(self);
  // Awaiting the chain directly resolves — add a then() to make it thenable
  (chain as unknown as Promise<unknown>).then = (res: (v: unknown) => unknown) =>
    Promise.resolve({ error }).then(res);
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
  it("returns zeros when no rows claimed", async () => {
    const claimChain = makeClaimChain([]);
    mockFrom.mockReturnValue(claimChain);

    const result = await processNotifications();
    expect(result).toEqual({ processed: 0, sent: 0, failed: 0, deferred: 0 });
    expect(sendSms).not.toHaveBeenCalled();
  });

  it("sends SMS for each claimed row and marks as sent", async () => {
    const rows = [makeRow({ id: "n-1" }), makeRow({ id: "n-2" })];

    // First from() call → claim chain
    const claimChain = makeClaimChain(rows);
    // Subsequent from() calls → status update chain
    const updateChain = makeClaimChain(null);
    mockFrom.mockReturnValueOnce(claimChain).mockReturnValue(updateChain);

    const result = await processNotifications({ appointmentId: "appt-1" });
    expect(sendSms).toHaveBeenCalledTimes(2);
    expect(result.sent).toBe(2);
    expect(result.failed).toBe(0);
    expect(result.processed).toBe(2);
  });

  it("does bulk defer and skips sending when in quiet hours", async () => {
    vi.mocked(isQuietHours).mockReturnValue(true);

    const deferChain = makeUpdateChain();
    mockFrom.mockReturnValue(deferChain);

    const result = await processNotifications();
    expect(sendSms).not.toHaveBeenCalled();
    expect(result.sent).toBe(0);
    expect(result.processed).toBe(0);
  });

  it("marks as failed and does not throw when sendSms rejects", async () => {
    vi.mocked(sendSms).mockRejectedValueOnce(new Error("Twilio error"));
    const row = makeRow();

    const claimChain = makeClaimChain([row]);
    const failChain  = makeClaimChain(null);
    mockFrom.mockReturnValueOnce(claimChain).mockReturnValue(failChain);

    const result = await processNotifications();
    expect(result.failed).toBe(1);
    expect(result.sent).toBe(0);
  });

  it("atomic claim prevents duplicate: only claimed rows are sent", async () => {
    // Simulates a second processor run that claims 0 rows (first already claimed them)
    const claimChain = makeClaimChain([]);
    mockFrom.mockReturnValue(claimChain);

    const result = await processNotifications();
    expect(sendSms).not.toHaveBeenCalled();
    expect(result.processed).toBe(0);
  });
});
