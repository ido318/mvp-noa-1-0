import { z } from "zod";

export const appointmentTypeSchema = z.enum([
  "checkup",
  "vaccination",
  "consultation",
  "urgent",
  "follow_up",
  "other",
]);

export const appointmentStatusSchema = z.enum([
  "scheduled",
  "confirmed",
  "completed",
  "cancelled",
  "no_show",
]);

export const appointmentSourceSchema = z.enum([
  "phone",
  "front_desk",
  "online",
  "internal",
  "other",
]);

export const createAppointmentSchema = z.object({
  clinicId: z.string().uuid(),
  customerId: z.string().uuid(),
  petId: z.string().uuid(),
  appointmentType: appointmentTypeSchema,
  source: appointmentSourceSchema,
  scheduledAt: z.string().datetime(),
  durationMinutes: z.literal(30),
  reason: z.string().trim().max(400).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export const updateAppointmentSchema = z
  .object({
    version: z.number().int().min(0),
    data: z
      .object({
        appointmentType: appointmentTypeSchema.optional(),
        source: appointmentSourceSchema.optional(),
        scheduledAt: z.string().datetime().optional(),
        durationMinutes: z.literal(30).optional(),
        reason: z.string().trim().max(400).optional().nullable(),
        notes: z.string().trim().max(2000).optional().nullable(),
      })
      .refine((value) => Object.keys(value).length > 0, {
        message: "At least one field is required",
      }),
  })
  .strict();

export const changeStatusSchema = z.object({
  version: z.number().int().min(0),
  status: appointmentStatusSchema,
  cancellationReason: z.string().trim().max(400).optional().nullable(),
});

export const listAppointmentsSchema = z.object({
  clinicId: z.string().uuid().optional(),
  date: z.string().date().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  status: appointmentStatusSchema.optional(),
  customerId: z.string().uuid().optional(),
  petId: z.string().uuid().optional(),
});

export const availabilitySchema = z.object({
  clinicId: z.string().uuid(),
  date: z.string().date(),
});
