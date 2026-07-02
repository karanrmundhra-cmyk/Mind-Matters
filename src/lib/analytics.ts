/**
 * Analytics abstraction. All product events go through `track()` with a typed name, so
 * the provider (PostHog by default) can be swapped without touching call sites. Until a
 * sink is registered (e.g. PostHog initialised with NEXT_PUBLIC_POSTHOG_KEY) `track` is a
 * safe no-op — analytics never block or break a user action.
 */
export type AnalyticsEvent =
  | 'loop_created'
  | 'loop_confirmed'
  | 'loop_closed'
  | 'loop_dropped'
  | 'followup_scheduled'
  | 'followup_sent'
  | 'response_received'
  | 'channel_used'
  | 'routine_checked'
  | 'streak_incremented'
  | 'consent_requested'
  | 'consent_granted'
  | 'consent_revoked'
  | 'payment_started'
  | 'subscription_active'
  | 'payment_failed'
  | 'onboarding_completed'
  | 'first_loop_confirmed';

export const ANALYTICS_EVENTS: readonly AnalyticsEvent[] = [
  'loop_created', 'loop_confirmed', 'loop_closed', 'loop_dropped', 'followup_scheduled',
  'followup_sent', 'response_received', 'channel_used', 'routine_checked', 'streak_incremented',
  'consent_requested', 'consent_granted', 'consent_revoked', 'payment_started',
  'subscription_active', 'payment_failed', 'onboarding_completed', 'first_loop_confirmed',
] as const;

export type AnalyticsSink = (event: AnalyticsEvent, props?: Record<string, unknown>) => void;

let sink: AnalyticsSink | null = null;

/** Register the analytics destination (e.g. a PostHog capture call). */
export function setAnalyticsSink(s: AnalyticsSink | null): void {
  sink = s;
}

/** Fire an event. Never throws — analytics failures must not affect the user. */
export function track(event: AnalyticsEvent, props?: Record<string, unknown>): void {
  if (!sink) return;
  try {
    sink(event, props);
  } catch {
    /* swallow — analytics must never break a flow */
  }
}
