/**
 * Feature flags. Gate experimental + Phase-2/3 features so they can ship dark and be
 * toggled by config (env) without code changes. Override any flag with an env var
 * `NEXT_PUBLIC_FLAG_<NAME>` set to "true"/"false" (NEXT_PUBLIC_ so client code can read it).
 */
export type FeatureFlag =
  | 'voice' // MVP: speak-to-capture (Web Speech API)
  | 'autonomous_send' // Phase 3: server sends without the user
  | 'ai_draft_auto' // auto-apply AI drafts (MVP keeps everything a proposal)
  | 'payments' // live checkout (off until gateway keys are configured)
  | 'telegram'
  | 'sms'
  | 'new_ui';

const DEFAULTS: Readonly<Record<FeatureFlag, boolean>> = {
  voice: true, // core MVP capture path
  autonomous_send: false,
  ai_draft_auto: false,
  payments: false,
  telegram: false,
  sms: false,
  new_ui: false,
};

export function isEnabled(flag: FeatureFlag): boolean {
  const raw = process.env[`NEXT_PUBLIC_FLAG_${flag.toUpperCase()}`];
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return DEFAULTS[flag];
}

/** Snapshot of all flags (e.g. to pass from a server component to the client). */
export function allFlags(): Record<FeatureFlag, boolean> {
  return (Object.keys(DEFAULTS) as FeatureFlag[]).reduce(
    (acc, f) => {
      acc[f] = isEnabled(f);
      return acc;
    },
    {} as Record<FeatureFlag, boolean>,
  );
}
