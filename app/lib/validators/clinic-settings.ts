import { z } from "zod";

const businessHourEntrySchema = z.object({
  day: z.string().trim().min(1).max(60),
  hours: z.string().trim().min(1).max(60),
});

const visitPriceEntrySchema = z.object({
  label: z.string().trim().min(1).max(80),
  detail: z.string().trim().min(1).max(120),
});

const contactSchema = z.object({
  address: z.string().trim().max(200),
  whatsapp: z.string().trim().max(40),
  email: z.string().trim().max(120),
});

export const updateClinicSettingsSchema = z.object({
  businessHours: z.array(businessHourEntrySchema).min(1).max(10).optional(),
  visitPrices: z.array(visitPriceEntrySchema).min(1).max(20).optional(),
  contact: contactSchema.partial().optional(),
});

export type UpdateClinicSettingsInput = z.infer<typeof updateClinicSettingsSchema>;
