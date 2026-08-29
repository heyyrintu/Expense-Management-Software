// S3-compatible storage client (MinIO locally, Cloudflare R2 in production).
// Module-private to lib/storage — application code goes through
// lib/storage/receipts.ts.
import { S3Client } from "@aws-sdk/client-s3";

const globalForS3 = globalThis as unknown as { s3?: S3Client };

export function s3Client(): S3Client {
  if (!globalForS3.s3) {
    globalForS3.s3 = new S3Client({
      endpoint: process.env.S3_ENDPOINT ?? "http://localhost:9000",
      region: process.env.S3_REGION ?? "us-east-1",
      forcePathStyle: (process.env.S3_FORCE_PATH_STYLE ?? "true") === "true",
      // ── WHY THESE TWO LINES EXIST ────────────────────────────────────────
      // Since v3.729 the AWS SDK defaults BOTH of these to "WHEN_SUPPORTED",
      // which stamps an x-amz-checksum-crc32 header on every upload and
      // validates a checksum on every download. That is correct for real S3
      // and a problem for other S3-compatible stores: Cloudflare R2 rejects
      // or mishandles the flexible-checksum headers, and the failure surfaces
      // as an opaque 4xx on PutObject rather than as anything mentioning
      // checksums.
      //
      // "WHEN_REQUIRED" keeps checksums for the operations that genuinely
      // mandate them and drops them everywhere else. It is a no-op against
      // MinIO and real S3, so local, CI and production all run one code path
      // — which is the whole point of this file being config-only.
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "minioadmin",
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "minioadmin",
      },
    });
  }
  return globalForS3.s3;
}

export function s3Bucket(): string {
  return process.env.S3_BUCKET ?? "receipts";
}
