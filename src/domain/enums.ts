/**
 * Canonical domain enums — the single source of truth shared by the service
 * layer, the Prisma schema, and the UI. Keep in lockstep with `prisma/schema.prisma`.
 */

export const LOOP_STATUSES = [
  'Draft',
  'Confirmed',
  'Scheduled',
  'Awaiting',
  'Responded',
  'Blocked',
  'Escalated',
  'Completed',
  'Closed',
  'Dropped',
  'Archived',
  'Deleted',
] as const;
export type LoopStatus = (typeof LOOP_STATUSES)[number];

export const PRIORITIES = ['Critical', 'High', 'Medium', 'Low'] as const;
export type Priority = (typeof PRIORITIES)[number];

/**
 * Channels. MVP actively sends on email + whatsapp (assisted) and logs telephone.
 * telegram / sms / voice are wired for routing but gated off in MVP (Phase 3).
 */
export const CHANNELS = ['email', 'whatsapp', 'telephone', 'telegram', 'sms', 'voice'] as const;
export type Channel = (typeof CHANNELS)[number];

export const CONSENT_STATES = ['none', 'opted_in', 'opted_out'] as const;
export type ConsentState = (typeof CONSENT_STATES)[number];

export const PLANS = ['free', 'pro', 'business'] as const;
export type Plan = (typeof PLANS)[number];

export const LOOP_SOURCES = ['manual', 'voice', 'email'] as const;
export type LoopSource = (typeof LOOP_SOURCES)[number];

/** Reminder kinds + lifecycle states. */
export const REMINDER_KINDS = ['deadline', 'followup'] as const;
export type ReminderKind = (typeof REMINDER_KINDS)[number];

export const REMINDER_STATES = ['scheduled', 'fired', 'snoozed', 'cancelled'] as const;
export type ReminderState = (typeof REMINDER_STATES)[number];

/**
 * Timeline event ("Touch") types. These are events on a loop's history — NOT
 * statuses. "Reminder due / Follow-up sent / Viewed" live here.
 */
export const TOUCH_TYPES = [
  'created',
  'drafted',
  'sent',
  'delivered',
  'seen',
  'replied',
  'reminded',
  'followup_sent',
  'call_logged',
  'status_changed',
  'closed',
  'note',
] as const;
export type TouchType = (typeof TOUCH_TYPES)[number];

/** Roles modelled now for future multi-user; MVP enforces Owner-only. */
export const ROLES = ['owner', 'admin', 'assistant', 'read_only'] as const;
export type Role = (typeof ROLES)[number];
