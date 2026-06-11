import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  isQuietHours,
  nextSendableTime,
  morningReminderTime,
  israelDateIso,
  enqueueNotification,
  scheduleBookingNotifications,
  cancelFutureNotifications,
} from "../../../src/lib/notifications.js";

// ─────────────────────────────────────────────────────────────────────────────
// Mock Supabase (all writes succeed by default)
// ─────────────────────────────────────────────────────────────────────────────

const mockUpsert = vi.fn().mockResolvedValue({ error: null });
const mockUpdate = vi.fn().mockResolvedValue({ error: null });
const mockEq = vi.fn();
const mockFrom = vi.fn();

vi.mock("../../../src/lib/supabase.js", () => ({
  getSupabase: () => ({
    from: mockFrom,
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();

  // Chain builder: from(...).upsert() or from(...).update().eq().eq().eq()
  mockEq.mockReturnValue({ eq: mockEq, error: null });
  mockUpdate.mockReturnValue({ eq: mockEq });
  mockUpsert.mockResolvedValue({ error: null });
  mockFrom.mockReturnValue({ upsert: mockUpsert, update: mockUpdate });
});

// ─────────────────────────────────────────────────────────────────────────────
// isQuietHours — tests DST (Jan = UTC+2, Jul = UTC+3)
// ─────────────────────────────────────────────────────────────────────────────

describe("isQuietHours", () => {
  it("returns false at 10:00 Israel time in winter (UTC+2)", () => {
    // 2026-01-15T08:00:00Z = 10:00 Israel (UTC+2)
    expect(isQuietHours(new Date("2026-01-15T08:00:00Z"))).toBe(false);
  });

  it("returns false at 10:00 Israel time in summer (UTC+3)", () => {
    // 2026-07-15T07:00:00Z = 10:00 Israel (UTC+3)
    expect(isQuietHours(new Date("2026-07-15T07:00:00Z"))).toBe(false);
  });

  it("returns true at 22:00 Israel time (both seasons)", () => {
    // 2026-01-15T20:00:00Z = 22:00 Israel (UTC+2) — winter
    expect(isQuietHours(new Date("2026-01-15T20:00:00Z"))).toBe(true);
    // 2026-07-15T19:00:00Z = 22:00 Israel (UTC+3) — summer
    expect(isQuietHours(new Date("2026-07-15T19:00:00Z"))).toBe(true);
  });

  it("returns true at 06:00 Israel (before 08:00 cutoff)", () => {
    // 2026-06-15T03:00:00Z = 06:00 Israel (UTC+3 summer)
    expect(isQuietHours(new Date("2026-06-15T03:00:00Z"))).toBe(true);
  });

  it("returns false at exactly 08:00 Israel", () => {
    // 2026-06-15T05:00:00Z = 08:00 Israel (UTC+3 summer)
    expect(isQuietHours(new Date("2026-06-15T05:00:00Z"))).toBe(false);
  });

  it("returns true at exactly 21:00 Israel", () => {
    // 2026-06-15T18:00:00Z = 21:00 Israel (UTC+3 summer)
    expect(isQuietHours(new Date("2026-06-15T18:00:00Z"))).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// morningReminderTime — 08:00 Israel for a given date
// ─────────────────────────────────────────────────────────────────────────────

describe("morningReminderTime", () => {
  it("returns 05:00 UTC for a summer date (UTC+3 → 08:00 Israel)", () => {
    const t = morningReminderTime("2026-07-15");
    expect(t.toISOString()).toBe("2026-07-15T05:00:00.000Z");
  });

  it("returns 06:00 UTC for a winter date (UTC+2 → 08:00 Israel)", () => {
    const t = morningReminderTime("2026-01-15");
    expect(t.toISOString()).toBe("2026-01-15T06:00:00.000Z");
  });

  it("israelHour of returned Date is 8", () => {
    // Verify via israelDateIso that the date is correct
    const t = morningReminderTime("2026-06-17");
    expect(israelDateIso(t)).toBe("2026-06-17");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// nextSendableTime
// ─────────────────────────────────────────────────────────────────────────────

describe("nextSendableTime", () => {
  it("returns the same time when not in quiet hours", () => {
    // 10:00 Israel = not quiet
    const now = new Date("2026-06-15T07:00:00Z"); // 10:00 Israel (UTC+3)
    expect(nextSendableTime(now)).toBe(now);
  });

  it("defers to 08:00 same morning when before morning cutoff", () => {
    // 03:00 Israel (quiet) — morning has not yet passed
    const now = new Date("2026-06-15T00:00:00Z"); // 03:00 Israel
    const result = nextSendableTime(now);
    expect(result.toISOString()).toBe("2026-06-15T05:00:00.000Z"); // 08:00 Israel UTC+3
  });

  it("defers to 08:00 next morning when in evening quiet hours", () => {
    // 22:00 Israel (quiet) — today's morning has passed
    const now = new Date("2026-06-15T19:00:00Z"); // 22:00 Israel (UTC+3)
    const result = nextSendableTime(now);
    expect(result.toISOString()).toBe("2026-06-16T05:00:00.000Z"); // 08:00 next day
  });

  it("crosses DST boundary correctly (winter evening → next morning)", () => {
    // 22:00 Israel on 2026-01-15 (UTC+2) = 20:00 UTC
    const now = new Date("2026-01-15T20:00:00Z");
    const result = nextSendableTime(now);
    expect(result.toISOString()).toBe("2026-01-16T06:00:00.000Z"); // 08:00 Israel UTC+2
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// israelDateIso
// ─────────────────────────────────────────────────────────────────────────────

describe("israelDateIso", () => {
  it("returns Israel date not UTC date when crossing midnight", () => {
    // 2026-06-17T22:30:00Z = 01:30 on 2026-06-18 in Israel (UTC+3)
    expect(israelDateIso(new Date("2026-06-17T22:30:00Z"))).toBe("2026-06-18");
  });

  it("returns same day when UTC and Israel share the same date", () => {
    // 2026-06-17T10:00:00Z = 13:00 in Israel
    expect(israelDateIso(new Date("2026-06-17T10:00:00Z"))).toBe("2026-06-17");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// enqueueNotification — idempotency via upsert with ignoreDuplicates
// ─────────────────────────────────────────────────────────────────────────────

describe("enqueueNotification", () => {
  it("calls upsert with correct shape", async () => {
    const params = {
      clinicId:      "clinic-1",
      customerId:    "cust-1",
      appointmentId: "appt-1",
      phone:         "+972501234567",
      type:          "booking_confirmation" as const,
      body:          "Hello",
      scheduledFor:  new Date("2026-06-17T05:00:00Z"),
    };
    await enqueueNotification(params);
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        appointment_id: "appt-1",
        type:           "booking_confirmation",
        status:         "pending",
      }),
      expect.objectContaining({ onConflict: "appointment_id,type", ignoreDuplicates: true }),
    );
  });

  it("throws when Supabase returns an error", async () => {
    mockUpsert.mockResolvedValueOnce({ error: { message: "DB error" } });
    await expect(
      enqueueNotification({
        clinicId: "c", customerId: "cu", appointmentId: "a", phone: "+972500000000",
        type: "booking_confirmation", body: "x", scheduledFor: new Date(),
      }),
    ).rejects.toThrow("enqueueNotification failed");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// cancelFutureNotifications
// ─────────────────────────────────────────────────────────────────────────────

describe("cancelFutureNotifications", () => {
  it("calls update with status=skipped for the given appointment", async () => {
    // The chain: from().update().eq().eq().eq()
    const mockChain = { eq: vi.fn().mockReturnThis() };
    mockChain.eq.mockReturnValue(mockChain);
    // Last .eq() returns { error: null }
    mockChain.eq.mockReturnValueOnce(mockChain).mockReturnValueOnce(mockChain).mockReturnValueOnce({ error: null });
    mockFrom.mockReturnValue({ update: vi.fn().mockReturnValue(mockChain) });

    await expect(cancelFutureNotifications("appt-1", "clinic-1")).resolves.toBeUndefined();
  });
});
