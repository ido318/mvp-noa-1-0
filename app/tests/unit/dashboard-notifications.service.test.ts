import { describe, expect, it, vi } from "vitest";
import { DashboardNotificationsService } from "@/lib/services/dashboard-notifications.service";

describe("DashboardNotificationsService — clinic template overrides", () => {
  it("getSmsTemplateOverrides fetches clinics.settings.smsTemplates for the given clinic", async () => {
    const single = vi.fn().mockResolvedValue({
      data: { settings: { smsTemplates: { cancellation_update: "override {{oldDate}}" } } },
      error: null,
    });
    const client = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single,
      }),
    };
    const service = new DashboardNotificationsService(client as never);

    const overrides = await service.getSmsTemplateOverrides("clinic-1");

    expect(overrides).toEqual({ cancellation_update: "override {{oldDate}}" });
  });

  it("getSmsTemplateOverrides returns {} when the clinic has no overrides or the query fails", async () => {
    const single = vi.fn().mockResolvedValue({ data: null, error: { message: "not found" } });
    const client = {
      from: vi.fn().mockReturnValue({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single }),
    };
    const service = new DashboardNotificationsService(client as never);

    const overrides = await service.getSmsTemplateOverrides("clinic-1");

    expect(overrides).toEqual({});
  });

  it("enqueueDashboardChangeNotification renders reschedule_update using the clinic's override when present", async () => {
    const single = vi.fn().mockResolvedValue({
      data: { settings: { smsTemplates: { reschedule_update: "עדכון קצר: {{newDate}} {{newTime}}" } } },
      error: null,
    });
    const insert = vi.fn().mockResolvedValue({ error: null });
    const client = {
      from: vi.fn((table: string) =>
        table === "clinics"
          ? { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single }
          : { insert },
      ),
    };
    const service = new DashboardNotificationsService(client as never);

    const result = await service.enqueueDashboardChangeNotification({
      clinicId: "clinic-1",
      customerId: "cust-1",
      appointmentId: "appt-1",
      phone: "+972500000000",
      customerName: "דנה",
      petName: "מיקה",
      templateKey: "reschedule_update",
      oldScheduledAt: "2027-01-15T10:00:00.000Z",
      newScheduledAt: "2027-01-20T12:00:00.000Z",
      location: "הקליניקה, גרציאני 6 ת\"א",
    });

    expect(result.ok).toBe(true);
    const [row] = insert.mock.calls[0] as [{ body: string; type: string }];
    expect(row.type).toBe("reschedule_update");
    expect(row.body).toContain("עדכון קצר:");
    expect(row.body).not.toContain("{{");
  });

  it("enqueueDashboardChangeNotification falls back to the default wording when there's no override", async () => {
    const single = vi.fn().mockResolvedValue({ data: { settings: { smsTemplates: {} } }, error: null });
    const insert = vi.fn().mockResolvedValue({ error: null });
    const client = {
      from: vi.fn((table: string) =>
        table === "clinics"
          ? { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single }
          : { insert },
      ),
    };
    const service = new DashboardNotificationsService(client as never);

    const result = await service.enqueueDashboardChangeNotification({
      clinicId: "clinic-1",
      customerId: "cust-1",
      appointmentId: "appt-1",
      phone: "+972500000000",
      customerName: "דנה",
      petName: "מיקה",
      templateKey: "cancellation_update",
      oldScheduledAt: "2027-01-15T10:00:00.000Z",
      location: "הקליניקה, גרציאני 6 ת\"א",
    });

    expect(result.ok).toBe(true);
    const [row] = insert.mock.calls[0] as [{ body: string }];
    expect(row.body).toContain("בשל אילוץ רפואי");
  });
});
