import { redirect } from "next/navigation";

import { getSessionCtx } from "@/lib/auth/guard";

export default async function Home() {
  redirect((await getSessionCtx()) ? "/dashboard" : "/login");
}
