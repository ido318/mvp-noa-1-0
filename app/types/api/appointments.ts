import type { Appointment } from "@/types/domain/appointment";

export type AppointmentListResponse = {
  items: Appointment[];
};

export type CalendarAvailabilityResponse = {
  clinicId: string;
  date: string;
  slotMinutes: 30;
  timezone: string;
  availableSlots: string[];
};
