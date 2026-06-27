import type { Channel } from '@/domain/enums';

/** Who a message on a given channel is addressed to. Locked routing rules. */
export type Recipient = 'user' | 'delegatee';

/**
 * Channel routing (LOCKED per spec):
 *   WhatsApp  → the USER (self-reminders)
 *   Email / Telegram / SMS / Voice → the DELEGATEE
 *   Telephone (tap-to-call) is placed by the user but concerns the delegatee.
 */
export function routeRecipient(channel: Channel): Recipient {
  switch (channel) {
    case 'whatsapp':
      return 'user';
    case 'email':
    case 'telegram':
    case 'sms':
    case 'voice':
    case 'telephone':
      return 'delegatee';
  }
}

/**
 * Channels that can actually dispatch in the MVP.
 *  - email: assisted send via the user's own account (Resend) — active
 *  - whatsapp: self-reminder deep link — active
 *  - telephone: tap-to-call placed by the user, app logs a Touch — active
 *  - telegram / sms / voice: routing wired but sends GATED (Phase 3)
 */
const MVP_ACTIVE_CHANNELS: ReadonlySet<Channel> = new Set<Channel>([
  'email',
  'whatsapp',
  'telephone',
]);

export function isChannelActiveInMvp(channel: Channel): boolean {
  return MVP_ACTIVE_CHANNELS.has(channel);
}

/** Channels whose sends require stored opt-in consent before any autonomous use (Phase 3). */
const CONSENT_REQUIRED_CHANNELS: ReadonlySet<Channel> = new Set<Channel>([
  'telegram',
  'sms',
  'voice',
]);

export function requiresConsent(channel: Channel): boolean {
  return CONSENT_REQUIRED_CHANNELS.has(channel);
}
