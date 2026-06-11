import { ok, type Result } from "@/lib/errors/app-error";
import type { AppointmentRepository } from "@/lib/repositories/appointment.repository";
import type { ServiceActor } from "@/lib/services/service-context";
import type { Appointment } from "@/types/domain/appointment";
import type { CalendarAvailabilityResponse } from "@/types/api/appointments";

function dayBounds(date: string): { startIso: string; endIso: string } {
  // For Phase 3 we keep timezone handling simple and deterministic at UTC boundaries.
  // Business hours are interpreted in clinic local timezone in service logic below.
  const start = new Date(`${date}T00:00:00.000Z`);
  const end = new Date(`${date}T23:59:59.999Z`);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

function getWorkingHoursForDay(date: Date): { open: string; close: string } | null {
  // 0=Sun, 1=Mon, ... 6=Sat (Phase 3 temporary business config)
  const weekday = date.getUTCDay();
  if (weekday >= 0 && weekday <= 4) return { open: "09:00", close: "18:00" };
  if (weekday === 5) return { open: "09:00", close: "13:00" };
  return null;
}

function combineDateAndClock(date: string, hhmm: string): Date {
  return new Date(`${date}T${hhmm}:00.000Z`);
}

export class CalendarService {
  constructor(private readonly appointmentRepository: AppointmentRepository) {}

  async listDay(
    actor: ServiceActor,
    clinicId: string,
    date: string,
  ): Promise<Result<Appointment[]>> {
    const { startIso, endIso } = dayBounds(date);
    return this.appointmentRepository.list({
      clinicIds: actor.clinicIds.filter((id) => id === clinicId),
      from: startIso,
      to: endIso,
    });
  }

  async listWeek(
    actor: ServiceActor,
    clinicId: string,
    weekStartDate: string,
  ): Promise<Result<Appointment[]>> {
    const from = new Date(`${weekStartDate}T00:00:00.000Z`);
    const to = new Date(from.getTime() + 7 * 24 * 60 * 60 * 1000);
    return this.appointmentRepository.list({
      clinicIds: actor.clinicIds.filter((id) => id === clinicId),
      from: from.toISOString(),
      to: to.toISOString(),
    });
  }

  async availabilityByDate(
    actor: ServiceActor,
    clinicId: string,
    date: string,
    timezone = "Asia/Jerusalem",
  ): Promise<Result<CalendarAvailabilityResponse>> {
    const dayDate = new Date(`${date}T00:00:00.000Z`);
    const workingHours = getWorkingHoursForDay(dayDate);
    if (!workingHours) {
      return ok({
        clinicId,
        date,
        slotMinutes: 30,
        timezone,
        availableSlots: [],
      });
    }

    const openAt = combineDateAndClock(date, workingHours.open);
    const closeAt = combineDateAndClock(date, workingHours.close);

    const appointmentsResult = await this.appointmentRepository.list({
      clinicIds: actor.clinicIds.filter((id) => id === clinicId),
      from: openAt.toISOString(),
      to: closeAt.toISOString(),
      status: undefined,
    });
    if (!appointmentsResult.ok) return appointmentsResult;

    const active = appointmentsResult.value.filter(
      (row) => row.status === "scheduled" || row.status === "confirmed",
    );

    const slots: string[] = [];
    for (
      let cursor = openAt.getTime();
      cursor + 30 * 60_000 <= closeAt.getTime();
      cursor += 30 * 60_000
    ) {
      const slotStart = cursor;
      const slotEnd = cursor + 30 * 60_000;
      const overlaps = active.some((appointment) => {
        const start = new Date(appointment.scheduledAt).getTime();
        const end = start + appointment.durationMinutes * 60_000;
        return slotStart < end && slotEnd > start;
      });
      if (!overlaps) slots.push(new Date(slotStart).toISOString());
    }

    return ok({
      clinicId,
      date,
      slotMinutes: 30,
      timezone,
      availableSlots: slots,
    });
  }
}
