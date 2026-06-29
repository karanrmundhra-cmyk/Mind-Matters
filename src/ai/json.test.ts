import { describe, it, expect } from 'vitest';
import { extractJson } from '@/ai/json';

describe('extractJson', () => {
  it('returns plain JSON unchanged', () => {
    expect(extractJson('{"a":1}')).toBe('{"a":1}');
  });

  it('strips ```json fences', () => {
    expect(extractJson('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it('extracts the object from surrounding prose', () => {
    expect(extractJson('Here you go: {"a":1,"b":2} — done')).toBe('{"a":1,"b":2}');
  });
});
