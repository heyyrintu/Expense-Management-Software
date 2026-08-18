// S3-compatible storage client (MinIO locally). Module-private to
// lib/storage — application code goes through lib/storage/receipts.ts.
import { S3Client } from "@aws-sdk/client-s3";

const globalForS3 = globalThis as unknown as { s3?: S3Client };

export function s3Client(): S3Client {
  if (!globalForS3.s3) {
    globalForS3.s3 = new S3Client({
      endpoint: process.env.S3_ENDPOINT ?? "http://localhost:9000",
      region: process.env.S3_REGION ?? "us-east-1",
      forcePathStyle: (process.env.S3_FORCE_PATH_STYLE ?? "true") === "true",
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
