// Centralised attachment size guardrails. Used by AttachmentsDialog +
// the inline paperclip drop-handlers in Tasks / Routines / CashFlow.
//
// Per project decision (Feb 2026):
//   - Max 5 MB per individual file
//   - Max 10 MB total per row (across all attachments)
// Update the constants below to adjust limits everywhere at once.

export const MAX_ATTACHMENT_FILE_BYTES = 5 * 1024 * 1024;    // 5 MB / file
export const MAX_ATTACHMENT_TOTAL_BYTES = 10 * 1024 * 1024;  // 10 MB / row
export const ATTACHMENT_LIMIT_HINT = "Max 5 MB per file · 10 MB total per row";

export function formatBytes(n) {
  if (n == null || isNaN(n)) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function usedBytes(existing = []) {
  return (existing || []).reduce((s, a) => s + (Number(a?.size) || 0), 0);
}

/**
 * Validate a single File against per-file + per-row limits.
 * Returns a human-readable error string when invalid, or null when OK.
 *
 * @param {File}   file       — the new file to attach
 * @param {Array}  existing   — attachments already on the row (each with .size)
 */
export function validateAttachment(file, existing = []) {
  if (!file) return "No file selected";
  if (file.size > MAX_ATTACHMENT_FILE_BYTES) {
    return `File too large — max ${formatBytes(MAX_ATTACHMENT_FILE_BYTES)} per file (got ${formatBytes(file.size)})`;
  }
  const used = usedBytes(existing);
  if (used + file.size > MAX_ATTACHMENT_TOTAL_BYTES) {
    const remaining = Math.max(0, MAX_ATTACHMENT_TOTAL_BYTES - used);
    return `Row attachment quota exceeded — ${formatBytes(MAX_ATTACHMENT_TOTAL_BYTES)} max, ${formatBytes(remaining)} remaining`;
  }
  return null;
}
