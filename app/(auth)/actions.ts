"use server";

import { headers } from "next/headers";
import { AuthError } from "next-auth";
import { signIn, signOut } from "@/lib/auth";
import { verifyInviteToken } from "@/lib/auth/invite-token";
import { hashPassword } from "@/lib/auth/password";
import { createOrgWithAdmin } from "@/lib/db/org-signup";
import { scopedDb } from "@/lib/db/scoped";
import { userErrors, type Result, ok, err } from "@/lib/errors";
import {
  acceptInviteSchema,
  loginSchema,
  signupSchema,
} from "@/lib/schemas/auth";
import { checkRateLimit, rateLimitedMessage } from "@/lib/rate-limit";

async function clientIp(): Promise<string> {
  const h = await headers();
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("x-real-ip") ??
    "local"
  );
}

export async function loginAction(input: unknown): Promise<Result> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return err(userErrors.validation);
  if (!checkRateLimit("login", `${parsed.data.slug}:${await clientIp()}`)) {
    return err(rateLimitedMessage);
  }
  try {
    await signIn("credentials", {
      ...parsed.data,
      redirectTo: "/dashboard",
    });
    return ok(undefined);
  } catch (e) {
    if (e instanceof AuthError) return err(userErrors.invalidCredentials);
    throw e; // NEXT_REDIRECT on success — must propagate
  }
}

export async function signupAction(input: unknown): Promise<Result> {
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) return err(userErrors.validation);
  if (!checkRateLimit("signup", await clientIp())) {
    return err(rateLimitedMessage);
  }
  const { orgName, slug, name, email, password } = parsed.data;

  const created = await createOrgWithAdmin({
    orgName,
    slug,
    adminName: name,
    email,
    passwordHash: await hashPassword(password),
  });
  if (!created.ok) return created;

  try {
    await signIn("credentials", {
      slug,
      email,
      password,
      redirectTo: "/dashboard",
    });
    return ok(undefined);
  } catch (e) {
    if (e instanceof AuthError) return err(userErrors.invalidCredentials);
    throw e;
  }
}

export async function acceptInviteAction(input: unknown): Promise<Result> {
  const parsed = acceptInviteSchema.safeParse(input);
  if (!parsed.success) return err(userErrors.validation);

  const claims = verifyInviteToken(parsed.data.token);
  if (!claims) return err(userErrors.inviteInvalid);

  const db = scopedDb(claims.orgId);
  const user = await db.user.findUnique({ where: { id: claims.userId } });
  if (!user || user.status !== "invited") return err(userErrors.inviteInvalid);

  await db.user.update({
    where: { id: claims.userId },
    data: {
      passwordHash: await hashPassword(parsed.data.password),
      status: "active",
    },
  });
  await db.auditLog.create({
    data: {
      orgId: claims.orgId,
      entity: "User",
      entityId: claims.userId,
      actorId: claims.userId,
      action: "user.activated",
      meta: {},
    },
  });
  return ok(undefined);
}

export async function logoutAction(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}
