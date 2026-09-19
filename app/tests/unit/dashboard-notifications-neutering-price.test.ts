import { describe, expect, it, vi } from "vitest";
import { DashboardNotificationsService } from "@/lib/services/dashboard-notifications.service";

/**
 * Neutering has no fixed price — it depends on species, weight, age and medical
 * state, and only Dr. Noa quotes it. The approval SMS used to print "💳 350 ₪"
 * anyway, contradicting what the agent is now required to say on the phone.
 */

function buildClient() {
  const insert = vi.fn().mockResolvedValue({ error: null });
  const single = vi.fn().mockResolvedValue({ data: { settings: { smsTemplates: {} } }, error: null });
  const client = {
    from: vi.fn((table: string) =>
      table === "clinics"
        ? { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single }
        : { insert },
    ),
  };
  return { client, insert };
}

type QueuedRow = { type: string; body: string };

async function enqueueFor(visitType: string): Promise<QueuedRow[]> {
  const { client, insert } = buildClient();
  const service = new DashboardNotificationsService(client as never);

  const result = await service.enqueueApprovalNotifications({
    appointmentId: "appt-1",
    // Far future, so the morning reminder is queued too and every row is asserted.
    scheduledAt: "2099-06-21T09:00:00.000Z",
    durationMinutes: 40,
    visitType,
    clinicId: "clinic-1",
    customerId: "cust-1",
    phone: "+972500000000",
    customerName: "דנה כהן",
    petName: "רקס",
  });

  expect(result.ok).toBe(true);
  return (insert.mock.calls[0] as [QueuedRow[]])[0];
}

describe("approval SMS pricing", () => {
  it("never names a number for a neutering appointment", async () => {
    const rows = await enqueueFor("neutering");
    const confirmation = rows.find((row) => row.type === "booking_confirmation");

    expect(confirmation).toBeDefined();
    expect(confirmation!.body).toContain('המחיר יימסר על ידי ד"ר נועה');
    // The old body read "💳 350 ₪". No digits may follow the card marker.
    expect(confirmation!.body).not.toMatch(/💳\s*\d/);
    expect(confirmation!.body).not.toContain("350");
  });

  it("still prints the fixed price for visit types that have one", async () => {
    const rows = await enqueueFor("checkup");
    const confirmation = rows.find((row) => row.type === "booking_confirmation");

    expect(confirmation!.body).toContain("💳 150 ₪");
  });

  it("falls back to the standard fee for an unknown visit type", async () => {
    const rows = await enqueueFor("something_new");
    const confirmation = rows.find((row) => row.type === "booking_confirmation");

    expect(confirmation!.body).toContain("💳 150 ₪");
  });
});
