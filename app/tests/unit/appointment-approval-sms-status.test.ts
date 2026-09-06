import { describe, expect, it, vi } from "vitest";
import { AppError, err, ok } from "@/lib/errors/app-error";
import { AppointmentService } from "@/lib/services/appointment.service";
import type { AppointmentRepository } from "@/lib/repositories/appointment.repository";
import type { CustomerRepository } from "@/lib/repositories/customer.repository";
import type { PetRepository } from "@/lib/repositories/pet.repository";
import type { AuditService } from "@/lib/services/audit.service";
import type { ServiceActor } from "@/lib/services/service-context";
import type { Appointment } from "@/types/domain/appointment";

/**
 * The dashboard used to tell the vet "התור אושר ונשלח SMS ללקוח" unconditionally,
 * while the enqueue Result was discarded — so an RLS rejection, or a queue nobody
 * processed, was indistinguishable from a delivered message. These cover the
 * three outcomes the toast now has to tell apart.
 */

const CLINIC = "clinic-1";

const owner: ServiceActor = {
  userId: "user-1",
  clinicIds: [CLINIC],
  defaultClinicId: CLINIC,
  memberships: [{ clinicId: CLINIC, role: "owner" }],
};

function pendingAppointment(): Appointment {
  return {
    id: "appt-1",
    clinicId: CLINIC,
    customerId: "cust-1",
    petId: "pet-1",
    appointmentType: "neutering",
    source: "phone",
    status: "pending_approval",
    scheduledAt: "2026-06-21T09:00:00.000Z",
    durationMinutes: 40,
    reason: null,
    notes: null,
    cancelledAt: null,
    cancelledByUserId: null,
    cancellationReason: null,
    createdByUserId: null,
    createdAt: "2026-06-20T09:00:00.000Z",
    updatedAt: "2026-06-20T09:00:00.000Z",
    deletedAt: null,
    version: 0,
  };
}

function buildService(options: {
  enqueue: ReturnType<typeof vi.fn>;
  dispatch?: ReturnType<typeof vi.fn>;
}) {
  const appointment = pendingAppointment();
  const appointmentRepository = {
    findById: vi.fn().mockResolvedValue(ok(appointment)),
    updateVersioned: vi.fn().mockResolvedValue(
      ok({ ...appointment, status: "confirmed", version: 1 }),
    ),
  };
  const auditService = { logAction: vi.fn().mockResolvedValue(ok({})) };
  const dashboardNotifications = {
    enqueueApprovalNotifications: options.enqueue,
    enqueueRejectionNotification: options.enqueue,
  };
  const dispatcher = options.dispatch ? { dispatch: options.dispatch } : undefined;

  const service = new AppointmentService(
    appointmentRepository as unknown as AppointmentRepository,
    {} as CustomerRepository,
    {} as PetRepository,
    auditService as unknown as AuditService,
    dashboardNotifications as never,
    undefined,
    undefined,
    dispatcher as never,
  );

  return { service, appointmentRepository };
}

const params = { phone: "0501234567", customerName: "דנה", petName: "רקס" };

describe("approve/reject SMS status", () => {
  it("reports 'sent' when the queue was written and the agent processed it", async () => {
    const dispatch = vi.fn().mockResolvedValue({ dispatched: true });
    const { service } = buildService({
      enqueue: vi.fn().mockResolvedValue(ok(undefined)),
      dispatch,
    });

    const result = await service.approvePendingAppointment(owner, "appt-1", params);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.smsStatus).toBe("sent");
    expect(result.value.appointment.status).toBe("confirmed");
    expect(dispatch).toHaveBeenCalledWith({ appointmentId: "appt-1" });
  });

  it("reports 'queued' when the agent could not be reached — the row is still queued", async () => {
    const { service } = buildService({
      enqueue: vi.fn().mockResolvedValue(ok(undefined)),
      dispatch: vi.fn().mockResolvedValue({ dispatched: false, reason: "not configured" }),
    });

    const result = await service.approvePendingAppointment(owner, "appt-1", params);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.smsStatus).toBe("queued");
  });

  it("reports 'failed' when nothing was queued, and still approves the appointment", async () => {
    const { service, appointmentRepository } = buildService({
      enqueue: vi.fn().mockResolvedValue(err(AppError.externalProvider("RLS denied the insert"))),
      dispatch: vi.fn(),
    });

    const result = await service.approvePendingAppointment(owner, "appt-1", params);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // The approval itself must stand — only the notification failed.
    expect(result.value.smsStatus).toBe("failed");
    expect(result.value.appointment.status).toBe("confirmed");
    expect(appointmentRepository.updateVersioned).toHaveBeenCalled();
  });

  it("dispatches the row the DB trigger wrote when rejecting, and does not enqueue its own", async () => {
    // appointments_notify_dashboard_change already inserts cancellation_update
    // inside the same UPDATE. Enqueueing it again here violated the
    // (appointment_id, type) unique key, reported the rejection as failed, and
    // skipped the dispatch — while a valid row sat in the queue.
    const enqueue = vi.fn();
    const dispatch = vi.fn().mockResolvedValue({ dispatched: true });
    const { service } = buildService({ enqueue, dispatch });

    const result = await service.rejectPendingAppointment(owner, "appt-1", params);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.smsStatus).toBe("sent");
    expect(enqueue).not.toHaveBeenCalled();
    expect(dispatch).toHaveBeenCalledWith({ appointmentId: "appt-1" });
  });

  it("reports the rejection SMS as queued when the agent could not be reached", async () => {
    const { service } = buildService({
      enqueue: vi.fn(),
      dispatch: vi.fn().mockResolvedValue({ dispatched: false, reason: "offline" }),
    });

    const result = await service.rejectPendingAppointment(owner, "appt-1", params);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.smsStatus).toBe("queued");
  });
});
