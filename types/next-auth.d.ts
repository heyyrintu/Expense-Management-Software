import type { Role } from "@/lib/auth/roles";

type SessionRole = Role | "super_admin";
import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    userId: string;
    orgId: string;
    orgSlug: string;
    role: SessionRole;
  }
  interface User {
    orgId: string;
    orgSlug: string;
    role: SessionRole;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId: string;
    orgId: string;
    orgSlug: string;
    role: SessionRole;
  }
}
