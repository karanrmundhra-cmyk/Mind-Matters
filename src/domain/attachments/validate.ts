/** Attachment validation — MIME whitelist + size cap. Pure; enforced server-side before storage. */

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10 MB

export const ALLOWED_MIME: ReadonlySet<string> = new Set<string>([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/heic',
  'text/plain',
  'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
]);

export interface AttachmentInput {
  filename: string;
  mime: string;
  size: number;
}

export type AttachmentValidation = { ok: true } | { ok: false; reason: string };

export function validateAttachment(input: AttachmentInput): AttachmentValidation {
  if (!input.filename || input.filename.length > 255) {
    return { ok: false, reason: 'Invalid file name' };
  }
  if (input.size <= 0) return { ok: false, reason: 'File is empty' };
  if (input.size > MAX_ATTACHMENT_BYTES) {
    return { ok: false, reason: `File exceeds ${MAX_ATTACHMENT_BYTES / (1024 * 1024)} MB limit` };
  }
  if (!ALLOWED_MIME.has(input.mime)) {
    return { ok: false, reason: `Unsupported file type: ${input.mime}` };
  }
  return { ok: true };
}
