import { AppError, err, ok, type Result } from "@/lib/errors/app-error";
import type { AppointmentRepository } from "@/lib/repositories/appointment.repository";
import type { CustomerRepository } from "@/lib/repositories/customer.repository";
import type { PetRepository } from "@/lib/repositories/pet.repository";
import type { AuditService } from "@/lib/services/audit.service";
import type { ServiceActor } from "@/lib/services/service-context";
import type {
  Appointment,
  AppointmentListFilters,
  AppointmentStatus,
  ChangeAppointmentStatusInput,
  CreateAppointmentInput,
  UpdateAppointmentInput,
} from "@/types/domain/appointment";

const ALLOWED_STATUS_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  scheduled: ["confirmed", "cancelled", "no_show"],
  confirmed: ["completed", "cancelled", "no_show"],
  completed: [],
  cancelled: [],
  no_show: [],
};

export class AppointmentService {
  constructor(
    private readonly appointmentRepository: AppointmentRepository,
    private readonly customerRepository: CustomerRepository,
    private readonly petRepository: PetRepository,
    private readonly auditService: AuditService,
  ) {}

  async listAppointments(
    actor: ServiceActor,
    filters: Omit<AppointmentListFilters, "clinicIds"> & { clinicIds?: string[] },
  ): Promise<Result<Appointment[]>> {
    const clinicIds = filters.clinicIds ?? actor.clinicIds;
    if (clinicIds.some((clinicId) => !actor.clinicIds.includes(clinicId))) {
      return err(AppError.forbidden("Cannot list appointments for requested clinic"));
    }
    return this.appointmentRepository.list({ ...filters, clinicIds });
  }

  async getAppointmentById(
    actor: ServiceActor,
    appointmentId: string,
  ): Promise<Result<Appointment>> {
    const existing = await this.appointmentRepository.findById(appointmentId);
    if (!existing.ok) return existing;
    if (!existing.value) return err(AppError.notFound("Appointment not found"));
    if (!actor.clinicIds.includes(existing.value.clinicId)) {
      return err(AppError.forbidden("Appointment outside actor clinics"));
    }
    return ok(existing.value);
  }

  async createAppointment(
    actor: ServiceActor,
    input: CreateAppointmentInput,
  ): Promise<Result<Appointment>> {
    if (!actor.clinicIds.includes(input.clinicId)) {
      return err(AppError.forbidden("Cannot create appointment in this clinic"));
    }
    if (input.durationMinutes !== 30) {
      return err(AppError.validation("Phase 3 supports only 30-minute appointments"));
    }

    const customer = await this.customerRepository.findById(input.customerId);
    if (!customer.ok) return err(customer.error);
    if (!customer.value) return err(AppError.notFound("Customer not found"));
    if (customer.value.clinicId !== input.clinicId) {
      return err(AppError.validation("Customer clinic mismatch"));
    }

    const pet = await this.petRepository.findById(input.petId);
    if (!pet.ok) return err(pet.error);
    if (!pet.value) return err(AppError.notFound("Pet not found"));
    if (pet.value.clinicId !== input.clinicId || pet.value.customerId !== input.customerId) {
      return err(AppError.validation("Pet/customer/clinic mismatch"));
    }

    const overlapCheck = await this.appointmentRepository.findActiveOverlaps(
      input.clinicId,
      input.scheduledAt,
      input.durationMinutes,
    );
    if (!overlapCheck.ok) return err(overlapCheck.error);
    if (overlapCheck.value.length > 0) {
      return err(
        AppError.conflict("Appointment overlaps with an active appointment", {
          overlapCount: overlapCheck.value.length,
        }),
      );
    }

    const created = await this.appointmentRepository.create(input, actor.userId);
    if (!created.ok) return created;

    await this.auditService.logAction({
      clinicId: created.value.clinicId,
      actorType: "user",
      actorId: actor.userId,
      action: "appointment.create",
      entityType: "appointment",
      entityId: created.value.id,
      afterPayload: created.value,
    });

    return created;
  }

  async updateAppointment(
    actor: ServiceActor,
    appointmentId: string,
    version: number,
    input: UpdateAppointmentInput,
  ): Promise<Result<Appointment>> {
    const existing = await this.getAppointmentById(actor, appointmentId);
    if (!existing.ok) return existing;

    if (version !== existing.value.version) {
      return err(
        AppError.conflict("Appointment update conflict: stale version", {
          expectedVersion: existing.value.version,
          providedVersion: version,
        }),
      );
    }

    const nextScheduledAt = input.scheduledAt ?? existing.value.scheduledAt;
    const nextDuration = input.durationMinutes ?? existing.value.durationMinutes;
    if (nextDuration !== 30) {
      return err(AppError.validation("Phase 3 supports only 30-minute appointments"));
    }

    const overlapCheck = await this.appointmentRepository.findActiveOverlaps(
      existing.value.clinicId,
      nextScheduledAt,
      nextDuration,
      existing.value.id,
    );
    if (!overlapCheck.ok) return err(overlapCheck.error);
    if (overlapCheck.value.length > 0) {
      return err(AppError.conflict("Appointment overlaps with an active appointment"));
    }

    const updated = await this.appointmentRepository.updateVersioned(appointmentId, {
      expectedVersion: version,
      data: {
        appointment_type: input.appointmentType,
        source: input.source,
        scheduled_at: input.scheduledAt,
        duration_minutes: input.durationMinutes,
        reason: input.reason,
        notes: input.notes,
      },
    });
    if (!updated.ok) return updated;

    await this.auditService.logAction({
      clinicId: updated.value.clinicId,
      actorType: "user",
      actorId: actor.userId,
      action: "appointment.update",
      entityType: "appointment",
      entityId: updated.value.id,
      beforePayload: existing.value,
      afterPayload: updated.value,
    });

    return updated;
  }

  async changeStatus(
    actor: ServiceActor,
    appointmentId: string,
    version: number,
    input: ChangeAppointmentStatusInput,
  ): Promise<Result<Appointment>> {
    const existing = await this.getAppointmentById(actor, appointmentId);
    if (!existing.ok) return existing;

    if (version !== existing.value.version) {
      return err(
        AppError.conflict("Appointment update conflict: stale version", {
          expectedVersion: existing.value.version,
          providedVersion: version,
        }),
      );
    }

    const allowed = ALLOWED_STATUS_TRANSITIONS[existing.value.status];
    if (!allowed.includes(input.status)) {
      return err(
        AppError.validation(
          `Invalid status transition: ${existing.value.status} -> ${input.status}`,
        ),
      );
    }

    const updated = await this.appointmentRepository.updateVersioned(appointmentId, {
      expectedVersion: version,
      data: {
        status: input.status,
        cancelled_at:
          input.status === "cancelled" ? new Date().toISOString() : existing.value.cancelledAt,
        cancelled_by_user_id:
          input.status === "cancelled" ? actor.userId : existing.value.cancelledByUserId,
        cancellation_reason:
          input.status === "cancelled"
            ? (input.cancellationReason ?? null)
            : existing.value.cancellationReason,
      },
    });
    if (!updated.ok) return updated;

    await this.auditService.logAction({
      clinicId: updated.value.clinicId,
      actorType: "user",
      actorId: actor.userId,
      action: "appointment.status_change",
      entityType: "appointment",
      entityId: updated.value.id,
      beforePayload: existing.value,
      afterPayload: updated.value,
    });

    return updated;
  }

  async softDelete(
    actor: ServiceActor,
    appointmentId: string,
    version: number,
  ): Promise<Result<void>> {
    const existing = await this.getAppointmentById(actor, appointmentId);
    if (!existing.ok) return err(existing.error);

    if (version !== existing.value.version) {
      return err(
        AppError.conflict("Appointment delete conflict: stale version", {
          expectedVersion: existing.value.version,
          providedVersion: version,
        }),
      );
    }

    const deleted = await this.appointmentRepository.updateVersioned(appointmentId, {
      expectedVersion: version,
      data: { deleted_at: new Date().toISOString() },
    });
    if (!deleted.ok) return err(deleted.error);

    await this.auditService.logAction({
      clinicId: existing.value.clinicId,
      actorType: "user",
      actorId: actor.userId,
      action: "appointment.delete",
      entityType: "appointment",
      entityId: existing.value.id,
      beforePayload: existing.value,
    });

    return ok(undefined);
  }
}
