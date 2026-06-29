import { describe, it, expect } from 'vitest';
import { buildSendLink } from '@/domain/send/links';

describe('assisted-send deep links', () => {
  it('builds a mailto link with subject + body', () => {
    const link = buildSendLink('email', { email: 'raj@example.com' }, 'Contract', 'Please send it');
    expect(link?.href).toBe('mailto:raj@example.com?subject=Contract&body=Please%20send%20it');
  });

  it('builds a tel link from a messy phone number', () => {
    expect(buildSendLink('telephone', { phone: '+91 (990) 000-0001' }, 's', 'b')?.href).toBe(
      'tel:+919900000001',
    );
  });

  it('builds a wa.me link with the message text', () => {
    expect(buildSendLink('whatsapp', { whatsapp: '+919900000001' }, 's', 'hi there')?.href).toBe(
      'https://wa.me/919900000001?text=hi%20there',
    );
  });

  it('returns null when the contact detail is missing', () => {
    expect(buildSendLink('email', {}, 's', 'b')).toBeNull();
    expect(buildSendLink('whatsapp', { email: 'x@y.com' }, 's', 'b')).toBeNull();
  });

  it('returns null for MVP-gated channels', () => {
    expect(buildSendLink('telegram', { phone: '+1' }, 's', 'b')).toBeNull();
    expect(buildSendLink('sms', { phone: '+1' }, 's', 'b')).toBeNull();
    expect(buildSendLink('voice', { phone: '+1' }, 's', 'b')).toBeNull();
  });
});
