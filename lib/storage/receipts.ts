// Receipt storage. Keys live under the org prefix
//   {orgId}/receipts/{expenseId}/{uuid}-{fileName}
// and signed URLs are issued ONLY through signedReceiptUrl(), which takes
// the receipt row from a scopedDb lookup — meaning the org check has
// already happened at the data layer (CLAUDE.md receipt rule).
import { randomUUID } from "node:crypto";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { sanitizeFileName } from "@/lib/schemas/receipt";
import { s3Bucket, s3Client } from "./s3";

export const SIGNED_URL_TTL_SECONDS = 300;

export function buildReceiptKey(
  orgId: string,
  expenseId: string,
  fileName: string
): string {
  return `${orgId}/receipts/${expenseId}/${randomUUID()}-${sanitizeFileName(fileName)}`;
}

export async function putReceiptObject(params: {
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

export async function deleteReceiptObject(key: string): Promise<void> {
  await s3Client().send(
    new DeleteObjectCommand({ Bucket: s3Bucket(), Key: key })
  );
}

/**
 * Presign a GET for a receipt row that was fetched via scopedDb (org-checked
 * by construction). Never call with a key that didn't come from a scoped
 * receipt lookup.
 */
export async function signedReceiptUrl(receipt: {
  storageKey: string;
}): Promise<string> {
  return getSignedUrl(
    s3Client(),
    new GetObjectCommand({ Bucket: s3Bucket(), Key: receipt.storageKey }),
    { expiresIn: SIGNED_URL_TTL_SECONDS }
  );
}
