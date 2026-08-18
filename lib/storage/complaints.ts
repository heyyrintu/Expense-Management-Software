// Complaint attachment storage (7.3): /{orgId}/complaints/{complaintId}/...
// Signed URLs are only ever derived from a scopedDb complaint row, so the org
// check has already happened at the data layer (CLAUDE.md).
import { randomUUID } from "node:crypto";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { sanitizeFileName } from "@/lib/schemas/receipt";
import { s3Bucket, s3Client } from "./s3";

export function buildComplaintKey(
  orgId: string,
  complaintId: string,
  fileName: string
): string {
  return `${orgId}/complaints/${complaintId}/${randomUUID()}-${sanitizeFileName(fileName)}`;
}

export async function putComplaintObject(params: {
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

/** Presign a GET for an attachment key that came from a scopedDb complaint. */
export async function signedComplaintUrl(complaint: {
  attachmentKey: string;
}): Promise<string> {
  return getSignedUrl(
    s3Client(),
    new GetObjectCommand({ Bucket: s3Bucket(), Key: complaint.attachmentKey }),
    { expiresIn: 300 }
  );
}
