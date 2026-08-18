import { z } from "zod";

export const roleEnum = z.enum(["employee", "approver", "finance_admin", "org_admin"]);
export const userStatusEnum = z.enum(["invited", "active", "deactivated"]);

const optionalId = z.union([z.literal(""), z.string().uuid()]);

export const inviteUserSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  email: z.string().email(),
  role: roleEnum,
  departmentId: optionalId,
  approverId: optionalId,
});
export type InviteUserInput = z.infer<typeof inviteUserSchema>;

export const editUserSchema = z.object({
  id: z.string().uuid(),
  role: roleEnum,
  departmentId: optionalId,
  approverId: optionalId,
});
export type EditUserInput = z.infer<typeof editUserSchema>;

export const userIdSchema = z.object({ id: z.string().uuid() });

// list filters arrive via URL search params
export const usersListQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  role: roleEnum.optional(),
  department: z.string().uuid().optional(),
  status: userStatusEnum.optional(),
  page: z.coerce.number().int().min(1).max(10000).default(1),
});
export type UsersListQuery = z.infer<typeof usersListQuerySchema>;

export const departmentSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(60),
});
export const departmentEditSchema = departmentSchema.extend({
  id: z.string().uuid(),
});
export const departmentIdSchema = z.object({ id: z.string().uuid() });
