import { z } from "zod";

export const closeVisitSchema = z.object({
  version: z.number().int().min(0),
});
