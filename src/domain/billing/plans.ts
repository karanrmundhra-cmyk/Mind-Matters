import type { Plan } from '@/domain/enums';

export interface PlanLimits {
  activeLoops: number; // Infinity = unlimited
  routines: number;
  whatsappSelfReminders: boolean;
  filtersAndGroups: boolean;
  assistedSend: boolean;
}

/** Tier limits. Free is deliberately generous enough to feel the value, capped to convert. */
export const PLAN_LIMITS: Readonly<Record<Plan, PlanLimits>> = {
  free: {
    activeLoops: 10,
    routines: 1,
    whatsappSelfReminders: false,
    filtersAndGroups: false,
    assistedSend: true, // email assisted-send + self-reminders
  },
  pro: {
    activeLoops: Infinity,
    routines: Infinity,
    whatsappSelfReminders: true,
    filtersAndGroups: true,
    assistedSend: true,
  },
  business: {
    activeLoops: Infinity,
    routines: Infinity,
    whatsappSelfReminders: true,
    filtersAndGroups: true,
    assistedSend: true,
  },
};

/** Pricing in INR. Annual = 2 months free (×10). Placeholders — confirm before charging. */
export const PLAN_PRICING: Readonly<Record<Plan, { monthly: number; annual: number }>> = {
  free: { monthly: 0, annual: 0 },
  pro: { monthly: 499, annual: 499 * 10 },
  business: { monthly: 1499, annual: 1499 * 10 },
};

export function canCreateLoop(plan: Plan, activeLoopCount: number): boolean {
  return activeLoopCount < PLAN_LIMITS[plan].activeLoops;
}

export function canCreateRoutine(plan: Plan, routineCount: number): boolean {
  return routineCount < PLAN_LIMITS[plan].routines;
}

/** Remaining active loops for the plan, or 'unlimited'. */
export function remainingLoops(plan: Plan, activeLoopCount: number): number | 'unlimited' {
  const limit = PLAN_LIMITS[plan].activeLoops;
  return limit === Infinity ? 'unlimited' : Math.max(0, limit - activeLoopCount);
}
