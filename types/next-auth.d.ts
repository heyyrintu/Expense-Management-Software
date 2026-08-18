import type { Role } from "@/lib/auth/roles";
import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    userId: string;
    orgId: string;
    orgSlug: string;
    role: Role;
  }
  interface User {
    orgId: string;
    orgSlug: string;
    role: Role;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId: string;
    orgId: string;
    orgSlug: string;
    role: Role;
  }
}
