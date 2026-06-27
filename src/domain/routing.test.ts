import { describe, it, expect } from 'vitest';
import {
  routeRecipient,
  isChannelActiveInMvp,
  requiresConsent,
} from '@/domain/routing';
import { CHANNELS } from '@/domain/enums';

describe('channel routing (locked rules)', () => {
  it('routes WhatsApp to the user (self-reminders)', () => {
    expect(routeRecipient('whatsapp')).toBe('user');
  });

  it('routes email/telegram/sms/voice/telephone to the delegatee', () => {
    for (const c of ['email', 'telegram', 'sms', 'voice', 'telephone'] as const) {
      expect(routeRecipient(c)).toBe('delegatee');
    }
  });

  it('returns a recipient for every defined channel (exhaustive)', () => {
    for (const c of CHANNELS) {
      expect(['user', 'delegatee']).toContain(routeRecipient(c));
    }
  });

  it('activates only email/whatsapp/telephone in the MVP', () => {
    expect(isChannelActiveInMvp('email')).toBe(true);
    expect(isChannelActiveInMvp('whatsapp')).toBe(true);
    expect(isChannelActiveInMvp('telephone')).toBe(true);
    expect(isChannelActiveInMvp('telegram')).toBe(false);
    expect(isChannelActiveInMvp('sms')).toBe(false);
    expect(isChannelActiveInMvp('voice')).toBe(false);
  });

  it('flags telegram/sms/voice as consent-required (Phase 3 gate)', () => {
    expect(requiresConsent('telegram')).toBe(true);
    expect(requiresConsent('sms')).toBe(true);
    expect(requiresConsent('voice')).toBe(true);
    expect(requiresConsent('email')).toBe(false);
    expect(requiresConsent('whatsapp')).toBe(false);
  });
});
