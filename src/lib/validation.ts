import { z } from "zod";

export const schoolRegistrationSchema = z.object({
  schoolName: z.string().trim().min(2).max(160),
  schoolType: z.string().trim().min(2).max(80),
  street: z.string().trim().min(2).max(160),
  postalCode: z.string().trim().regex(/^\d{5}$/, "Bitte eine fünfstellige Postleitzahl eingeben."),
  city: z.string().trim().min(2).max(100),
  state: z.string().trim().min(2).max(100),
  contactName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  password: z.string().min(12).max(128),
  terms: z.literal("on"),
  privacy: z.literal("on"),
});
export const toiletDecisionSchema = z.object({ requestId: z.string().uuid(), decision: z.enum(["approved", "denied"]) });
