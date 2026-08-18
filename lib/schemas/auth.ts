import { z } from "zod";

// URL-safe org slug: 2–32 chars, lowercase alphanumeric + inner hyphens.
export const slugSchema = z
  .string()
  .min(2)
  .max(32)
  .regex(
    /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/,
    "Lowercase letters, numbers, and hyphens only"
  );

export const loginSchema = z.object({
  slug: slugSchema,
  email: z.string().email(),
  password: z.string().min(1, "Password is required"),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const signupSchema = z.object({
  orgName: z.string().min(2).max(80),
  slug: slugSchema,
  name: z.string().min(1).max(80),
  email: z.string().email(),
  password: z.string().min(8, "At least 8 characters"),
});
export type SignupInput = z.infer<typeof signupSchema>;

export const acceptInviteSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, "At least 8 characters"),
});
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;
