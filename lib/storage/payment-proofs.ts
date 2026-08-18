// Payment-proof storage (6.1): /{orgId}/payment-proofs/{batchId}/{uuid}-{name}
// Signed URLs are only ever derived from a scopedDb reimbursement lookup —
// same org-checked-by-construction pattern as receipts.
import { randomUUID } from "node:crypto";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { sanitizeFileName } from "@/lib/schemas/receipt";
import { s3Bucket, s3Client } from "./s3";

export function buildProofKey(
  orgId: string,
  batchId: string,
  fileName: string
): string {
  return `${orgId}/payment-proofs/${batchId}/${randomUUID()}-${sanitizeFileName(fileName)}`;
}

export async function putProofObject(params: {
  key: string;
  body: Buffer;
  contentType: string;
  fileName: string;
}): Promise<void> {
  await s3Client().send(
    new PutObjectCommand({
      Bucket: s3Bucket(),
      Key: params.key,
      Body: params.body,
      ContentType: params.contentType,
      ContentDisposition: `inline; filename="${sanitizeFileName(params.fileName)}"`,
    })
  );
}

/** Presign a GET for a proof key that came from a scopedDb payment row. */
export async function signedProofUrl(payment: { proofKey: string }): Promise<string> {
  return getSignedUrl(
    s3Client(),
    new GetObjectCommand({ Bucket: s3Bucket(), Key: payment.proofKey }),
    { expiresIn: 300 }
  );
}
