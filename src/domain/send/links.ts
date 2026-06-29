import type { Channel } from '@/domain/enums';

export interface SendTarget {
  email?: string | null;
  phone?: string | null; // for telephone (tel:)
  whatsapp?: string | null; // E.164-ish, for wa.me
}

export interface SendLink {
  channel: Channel;
  href: string;
}

/** Keep digits (and a leading +) for tel:/wa.me. */
function digits(num: string): string {
  const cleaned = num.replace(/[^\d+]/g, '');
  return cleaned.replace(/(?!^)\+/g, '');
}

/**
 * Build an assisted-send deep link — the message is sent from the USER's own client
 * (their mail app / phone / WhatsApp), never autonomously by the server. Returns null
 * when the target lacks the needed contact detail or the channel can't deep-link in MVP.
 */
export function buildSendLink(
  channel: Channel,
  target: SendTarget,
  subject: string,
  body: string,
): SendLink | null {
  switch (channel) {
    case 'email': {
      if (!target.email) return null;
      const qs = `subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      return { channel, href: `mailto:${target.email}?${qs}` };
    }
    case 'telephone': {
      if (!target.phone) return null;
      return { channel, href: `tel:${digits(target.phone)}` };
    }
    case 'whatsapp': {
      if (!target.whatsapp) return null;
      // wa.me expects digits only, no leading '+'.
      const num = digits(target.whatsapp).replace(/^\+/, '');
      return { channel, href: `https://wa.me/${num}?text=${encodeURIComponent(body)}` };
    }
    // telegram / sms / voice are gated in MVP (no manual deep-link path).
    case 'telegram':
    case 'sms':
    case 'voice':
      return null;
  }
}
