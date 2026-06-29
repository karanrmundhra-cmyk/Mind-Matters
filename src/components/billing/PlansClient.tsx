'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { cn } from '@/lib/cn';
import { PLAN_PRICING } from '@/domain/billing/plans';
import type { Plan } from '@/domain/enums';

type Cycle = 'monthly' | 'annual';

const PLANS: Array<{ id: Plan; name: string; tagline: string; features: string[]; highlight?: boolean }> = [
  {
    id: 'free',
    name: 'Free',
    tagline: 'Get a feel for closing loops.',
    features: ['10 active loops', 'Email assisted-send', 'Self-reminders', '1 routine'],
  },
  {
    id: 'pro',
    name: 'Pro',
    tagline: 'For people others owe a lot.',
    features: ['Unlimited loops', 'WhatsApp self-reminders', 'Assisted send', 'All routines', 'Filters & groups'],
    highlight: true,
  },
  {
    id: 'business',
    name: 'Business',
    tagline: 'Autonomous follow-through.',
    features: ['Everything in Pro', 'Autonomous WhatsApp (Phase 3)', 'Voice follow-ups (Phase 3)', 'Accountability profiles'],
  },
];

export function PlansClient({ currentPlan = 'free' }: { currentPlan?: Plan }) {
  const [cycle, setCycle] = useState<Cycle>('monthly');

  const price = (p: Plan) => {
    const v = cycle === 'monthly' ? PLAN_PRICING[p].monthly : PLAN_PRICING[p].annual;
    if (v === 0) return 'Free';
    return cycle === 'monthly' ? `₹${v}/mo` : `₹${v}/yr`;
  };

  return (
    <div>
      <div className="mb-5 flex items-center justify-center gap-2">
        <Chip active={cycle === 'monthly'} onClick={() => setCycle('monthly')}>
          Monthly
        </Chip>
        <Chip active={cycle === 'annual'} onClick={() => setCycle('annual')}>
          Annual · 2 months free
        </Chip>
      </div>

      <div className="space-y-3">
        {PLANS.map((plan) => {
          const isCurrent = plan.id === currentPlan;
          return (
            <GlassCard key={plan.id} className={cn(plan.highlight && 'ring-1 ring-gold/40')}>
              <div className="flex items-baseline justify-between">
                <h2 className="text-h3 text-text">{plan.name}</h2>
                <span className={cn('text-h3', plan.id === 'free' ? 'text-muted' : 'text-gold')}>{price(plan.id)}</span>
              </div>
              <p className="mt-0.5 text-sm text-muted">{plan.tagline}</p>
              <ul className="mt-3 space-y-1.5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-text">
                    <Check className="h-4 w-4 shrink-0 text-gold" aria-hidden /> {f}
                  </li>
                ))}
              </ul>
              <div className="mt-4">
                {isCurrent ? (
                  <Button variant="glass" className="w-full" disabled>
                    Current plan
                  </Button>
                ) : plan.id === 'free' ? (
                  <Button variant="ghost" className="w-full" disabled>
                    Downgrade
                  </Button>
                ) : (
                  <Button variant="gold" className="w-full" disabled>
                    Choose {plan.name}
                  </Button>
                )}
              </div>
            </GlassCard>
          );
        })}
      </div>

      <p className="mt-4 text-center text-xs text-faint">
        Checkout (Razorpay for India · Stripe international) activates once payment keys are connected.
        Prices are placeholders pending confirmation.
      </p>
    </div>
  );
}
