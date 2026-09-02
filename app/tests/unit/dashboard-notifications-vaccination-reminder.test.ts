import { describe, expect, it, vi } from "vitest";
import { DashboardNotificationsService } from "@/lib/services/dashboard-notifications.service";

// The exact frozen wording from agent/src/services/sms.templates.ts's
// vaccination_reminder template — kept here only to assert against, never as
// a second source of truth to edit independently of that file.
function frozenVaccinationReminderBody(customerName: string, petName: string, vaccineName: string): string {
  return (
    `שלום ${customerName}, כאן תומר מ-Get A Vet 💉\n` +
    `הגיע הזמן לחיסון הבא של ${petName} (${vaccineName}) — מומלץ לתאם בקרוב לשמירה על הבריאות.\n` +
    `לתיאום תור נוח — חייגו אלינו בכל עת.\n` +
    `בריאות ל${petName} 🐾 תומר, Get A Vet`
  );
}

function buildClient() {
  const upsert = vi.fn().mockResolvedValue({ error: null });
  const client = { from: vi.fn().mockReturnValue({ upsert }) };
  return { client, upsert };
}

describe("DashboardNotificationsService.enqueueVaccinationReminder", () => {
  it("sends the frozen SMS wording verbatim, not an ad-hoc paraphrase", async () => {
    const { client, upsert } = buildClient();
    const service = new DashboardNotificationsService(client as never);

    const result = await service.enqueueVaccinationReminder({
      vaccinationId: "vacc-1",
      clinicId: "clinic-1",
      customerId: "cust-1",
      phone: "+972500000000",
      customerName: "דנה כהן",
      petName: "מיקה",
      vaccineName: "כלבת",
      nextDueAt: "2026-10-01",
    });

    expect(result.ok).toBe(true);
    expect(client.from).toHaveBeenCalledWith("notifications_log");
    const [row] = upsert.mock.calls[0] as [{ body: string }, unknown];
    expect(row.body).toBe(frozenVaccinationReminderBody("דנה כהן", "מיקה", "כלבת"));
  });

  it("does not mention a specific due date — the frozen template only says 'בקרוב'", async () => {
    const { client, upsert } = buildClient();
    const service = new DashboardNotificationsService(client as never);

    await service.enqueueVaccinationReminder({
      vaccinationId: "vacc-1",
      clinicId: "clinic-1",
      customerId: "cust-1",
      phone: "+972500000000",
      customerName: "דנה כהן",
      petName: "מיקה",
      vaccineName: "כלבת",
      nextDueAt: "2026-10-01",
    });

    const [row] = upsert.mock.calls[0] as [{ body: string }, unknown];
    expect(row.body).not.toContain("2026");
    expect(row.body).toContain("בקרוב");
  });

  it("upserts on (vaccination_id, type) ignoring duplicates, matching the cron job's own idempotent insert", async () => {
    const { client, upsert } = buildClient();
    const service = new DashboardNotificationsService(client as never);

    await service.enqueueVaccinationReminder({
      vaccinationId: "vacc-1",
      clinicId: "clinic-1",
      customerId: "cust-1",
      phone: "+972500000000",
      customerName: "דנה כהן",
      petName: "מיקה",
      vaccineName: "כלבת",
      nextDueAt: "2026-10-01",
    });

    const [, options] = upsert.mock.calls[0] as [unknown, { onConflict: string; ignoreDuplicates: boolean }];
    expect(options).toEqual({ onConflict: "vaccination_id,type", ignoreDuplicates: true });
  });
});
