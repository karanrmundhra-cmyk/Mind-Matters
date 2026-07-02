import { describe, it, expect, afterEach } from 'vitest';
import { isEnabled, allFlags } from '@/domain/flags/flags';

afterEach(() => {
  delete process.env.NEXT_PUBLIC_FLAG_VOICE;
  delete process.env.NEXT_PUBLIC_FLAG_PAYMENTS;
});

describe('feature flags', () => {
  it('uses sensible MVP defaults (voice on, phase-3 off)', () => {
    expect(isEnabled('voice')).toBe(true);
    expect(isEnabled('autonomous_send')).toBe(false);
    expect(isEnabled('payments')).toBe(false);
    expect(isEnabled('telegram')).toBe(false);
  });

  it('honours env overrides', () => {
    process.env.NEXT_PUBLIC_FLAG_VOICE = 'false';
    process.env.NEXT_PUBLIC_FLAG_PAYMENTS = 'true';
    expect(isEnabled('voice')).toBe(false);
    expect(isEnabled('payments')).toBe(true);
  });

  it('allFlags returns a complete snapshot', () => {
    const snap = allFlags();
    expect(Object.keys(snap).sort()).toEqual(
      ['ai_draft_auto', 'autonomous_send', 'new_ui', 'payments', 'sms', 'telegram', 'voice'].sort(),
    );
  });
});
