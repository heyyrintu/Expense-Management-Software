"use server";

import { revalidatePath } from "next/cache";
import {
  AuthenticationError,
  AuthorizationError,
  requireSession,
} from "@/lib/auth/guard";
import { scopedDb } from "@/lib/db/scoped";
import { userErrors, type Result, ok, err } from "@/lib/errors";
import { z } from "zod";

const idSchema = z.object({ id: z.string().uuid() });

export async function markNotificationReadAction(input: unknown): Promise<Result> {
  try {
    const ctx = await requireSession();
    const parsed = idSchema.safeParse(input);
    if (!parsed.success) return err(userErrors.validation);

    // recipient-pinned: only the session user's own notifications
    await scopedDb(ctx.orgId).notification.updateMany({
      where: { id: parsed.data.id, userId: ctx.userId, readAt: null },
      data: { readAt: new Date() },
    });
    revalidatePath("/notifications");
    return ok(undefined);
  } catch (e) {
    if (e instanceof AuthenticationError || e instanceof AuthorizationError) {
      return err(e.message);
    }
    throw e;
  }
}

export async function markAllNotificationsReadAction(): Promise<Result> {
  try {
    const ctx = await requireSession();
    await scopedDb(ctx.orgId).notification.updateMany({
      where: { userId: ctx.userId, readAt: null },
      data: { readAt: new Date() },
    });
    revalidatePath("/notifications");
    return ok(undefined);
  } catch (e) {
    if (e instanceof AuthenticationError || e instanceof AuthorizationError) {
      return err(e.message);
    }
    throw e;
  }
}
