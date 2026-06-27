import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { parseBody, ApiException } from '@/lib/api';

const schema = z.object({ text: z.string().min(1), priority: z.enum(['High', 'Low']) });

describe('parseBody', () => {
  it('returns typed data for a valid body', () => {
    const data = parseBody(schema, { text: 'hi', priority: 'High' });
    expect(data).toEqual({ text: 'hi', priority: 'High' });
  });

  it('throws a validation_error ApiException on an invalid body', () => {
    try {
      parseBody(schema, { text: '', priority: 'Nope' });
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(ApiException);
      expect((e as ApiException).code).toBe('validation_error');
    }
  });
});
