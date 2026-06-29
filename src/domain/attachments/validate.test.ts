import { describe, it, expect } from 'vitest';
import { validateAttachment, MAX_ATTACHMENT_BYTES } from '@/domain/attachments/validate';

describe('validateAttachment', () => {
  it('accepts an allowed type within the size limit', () => {
    expect(validateAttachment({ filename: 'contract.pdf', mime: 'application/pdf', size: 1024 })).toEqual({ ok: true });
  });

  it('rejects an unsupported MIME type', () => {
    const r = validateAttachment({ filename: 'a.exe', mime: 'application/x-msdownload', size: 10 });
    expect(r.ok).toBe(false);
  });

  it('rejects an oversized or empty file', () => {
    expect(validateAttachment({ filename: 'big.pdf', mime: 'application/pdf', size: MAX_ATTACHMENT_BYTES + 1 }).ok).toBe(false);
    expect(validateAttachment({ filename: 'empty.pdf', mime: 'application/pdf', size: 0 }).ok).toBe(false);
  });

  it('rejects an invalid filename', () => {
    expect(validateAttachment({ filename: '', mime: 'application/pdf', size: 10 }).ok).toBe(false);
  });
});
