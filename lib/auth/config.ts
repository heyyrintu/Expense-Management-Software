import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/db/client";
import { scopedDb } from "@/lib/db/scoped";
import { loginSchema, superLoginSchema } from "@/lib/schemas/auth";
import { verifyPassword } from "./password";
import { isRole } from "./roles";

export const authConfig = {
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    // Platform operators (PRD 6.1b) — separate table, no org, no tenant data.
    Credentials({
      id: "super-credentials",
      credentials: { email: {}, password: {} },
      async authorize(credentials) {
        const parsed = superLoginSchema.safeParse(credentials);
        if (!parsed.success) return null;
        const admin = await prisma.superAdmin.findUnique({
          where: { email: parsed.data.email.toLowerCase() },
        });
        if (!admin) return null;
        if (!(await verifyPassword(parsed.data.password, admin.passwordHash))) {
          return null;
        }
        return {
          id: admin.id,
          name: "Super Admin",
          email: admin.email,
          orgId: "",
          orgSlug: "",
          role: "super_admin" as const,
        };
      },
    }),
    Credentials({
      credentials: {
        slug: {},
        email: {},
        password: {},
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;
        const { slug, email, password } = parsed.data;

        // Org resolved from public slug (organizations has no RLS);
        // the user lookup then goes through scopedDb — tenant-scoped
        // like every other data access.
        const org = await prisma.organization.findUnique({
          where: { slug },
          select: { id: true, slug: true, status: true },
        });
        if (!org || org.status !== "active") return null;

        const user = await scopedDb(org.id).user.findUnique({
          where: { orgId_email: { orgId: org.id, email: email.toLowerCase() } },
        });
        if (!user || user.status !== "active" || !user.passwordHash) return null;
        if (!(await verifyPassword(password, user.passwordHash))) return null;
        if (!isRole(user.role)) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          orgId: user.orgId,
          orgSlug: org.slug,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      // `user` is only present on sign-in — copy claims into the JWT once.
      if (user) {
        token.userId = user.id as string;
        token.orgId = user.orgId;
        token.orgSlug = user.orgSlug;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      session.userId = token.userId;
      session.orgId = token.orgId;
      session.orgSlug = token.orgSlug;
      session.role = token.role;
      return session;
    },
  },
} satisfies NextAuthConfig;
