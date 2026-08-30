// Liveness / readiness probe.
//
// A load balancer needs one URL that answers "can this instance actually
// serve traffic", which means proving the two dependencies a request needs:
// Postgres and the receipt store. A 200 that only proves Node is running
// would keep a broken instance in rotation.
//
// Deliberately terse in its response body: this endpoint is unauthenticated,
// so it reports UP/DOWN per dependency and never an error message, a driver
// string, or a hostname.
import { NextResponse } from "next/server";
import { HeadBucketCommand } from "@aws-sdk/client-s3";
import { prisma } from "@/lib/db/client";
import { s3Bucket, s3Client } from "@/lib/storage/s3";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function check(fn: () => Promise<unknown>): Promise<boolean> {
  try {
    await fn();
    return true;
  } catch {
    return false;
  }
}

export async function GET(): Promise<NextResponse> {
  const [db, storage] = await Promise.all([
    check(() => prisma.$queryRaw`SELECT 1`),
    check(() => s3Client().send(new HeadBucketCommand({ Bucket: s3Bucket() }))),
  ]);

  const ok = db && storage;
  return NextResponse.json(
    { ok, db: db ? "up" : "down", storage: storage ? "up" : "down" },
    { status: ok ? 200 : 503, headers: { "cache-control": "no-store" } }
  );
}
