import { z } from "zod";

export const listCalendarBlocksSchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
});

export const createCalendarBlockSchema = z
  .object({
    clinicId: z.string().uuid(),
    startAt: z.string().datetime(),
    endAt: z.string().datetime(),
    reason: z.string().trim().max(300).optional().nullable(),
  })
  .refine(
    (value) => new Date(value.endAt).getTime() > new Date(value.startAt).getTime(),
    { path: ["endAt"], message: "endAt must be after startAt" },
  );
