import Link from 'next/link';
import { ChevronRight, Download, Shield, CreditCard, Plug, Users } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { BottomNav } from '@/components/ui/BottomNav';
import { initials } from '@/lib/format';
import { getRepository, DEV_SPACE_ID } from '@/server/repositories';

export const dynamic = 'force-dynamic';

const INTEGRATIONS = [
  { name: 'Database (Supabase)', connected: Boolean(process.env.DATABASE_URL) },
  { name: 'AI (Anthropic)', connected: Boolean(process.env.ANTHROPIC_API_KEY) },
  { name: 'Email (Resend)', connected: Boolean(process.env.RESEND_API_KEY) },
  { name: 'Payments (Razorpay/Stripe)', connected: Boolean(process.env.RAZORPAY_KEY_ID || process.env.STRIPE_SECRET_KEY) },
];

export default async function SettingsPage() {
  const contacts = await getRepository().listContacts(DEV_SPACE_ID);

  return (
    <main className="mx-auto min-h-dvh w-full max-w-md px-5 pb-28 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <h1 className="mb-5 text-h1 text-text">Settings</h1>

      {/* Profile */}
      <GlassCard className="mb-4 flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-pill bg-gold text-h3 text-gold-on">K</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-h3 text-text">Karan</p>
          <p className="truncate text-sm text-muted">karanrmundhra@gmail.com</p>
        </div>
        <span className="rounded-pill bg-[rgb(var(--pos-surface)/0.6)] px-3 py-1 text-xs text-muted">Free plan</span>
      </GlassCard>

      {/* Billing */}
      <Link href="/plans" className="pos-focus mb-4 block">
        <GlassCard flush className="flex items-center gap-3 p-4">
          <CreditCard className="h-5 w-5 text-gold" aria-hidden />
          <span className="flex-1 text-sm text-text">Plans & billing</span>
          <ChevronRight className="h-4 w-4 text-faint" aria-hidden />
        </GlassCard>
      </Link>

      {/* Contacts & consent */}
      <GlassCard className="mb-4">
        <div className="mb-3 flex items-center gap-2">
          <Users className="h-4 w-4 text-gold" aria-hidden />
          <h2 className="text-h3 text-text">Contacts & consent</h2>
        </div>
        <ul className="space-y-2">
          {contacts.map((c) => {
            const channels = [c.email && 'email', c.whatsapp && 'WhatsApp', c.telephone && 'phone'].filter(Boolean);
            return (
              <li key={c.id} className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-pill bg-[rgb(var(--pos-surface)/0.85)] text-[0.6rem] font-semibold text-text">
                  {initials(c.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-text">{c.name}</span>
                  <span className="block text-xs text-muted">{channels.join(' · ') || 'No channels'}</span>
                </span>
                <span className="rounded-pill bg-[rgb(var(--pos-surface)/0.6)] px-2.5 py-1 text-[0.65rem] text-muted">
                  Assisted-send OK
                </span>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-xs text-faint">
          Saved contact details are not consent to auto-message. Autonomous channels (Phase 3) require
          explicit opt-in per the consent record.
        </p>
      </GlassCard>

      {/* Integrations */}
      <GlassCard className="mb-4">
        <div className="mb-3 flex items-center gap-2">
          <Plug className="h-4 w-4 text-gold" aria-hidden />
          <h2 className="text-h3 text-text">Integrations</h2>
        </div>
        <ul className="space-y-2">
          {INTEGRATIONS.map((i) => (
            <li key={i.name} className="flex items-center justify-between text-sm">
              <span className="text-text">{i.name}</span>
              <span className={i.connected ? 'text-gold' : 'text-muted'}>
                {i.connected ? 'Connected' : 'Not connected'}
              </span>
            </li>
          ))}
        </ul>
      </GlassCard>

      {/* Security */}
      <GlassCard className="mb-4">
        <div className="mb-3 flex items-center gap-2">
          <Shield className="h-4 w-4 text-gold" aria-hidden />
          <h2 className="text-h3 text-text">Security</h2>
        </div>
        <p className="text-sm text-muted">
          MFA and biometric unlock activate with account sign-in (Supabase Auth). Sessions are
          httpOnly + secure; all data is encrypted in transit and at rest.
        </p>
      </GlassCard>

      {/* Data export */}
      <a href="/api/v1/export" className="pos-focus block">
        <GlassCard flush className="flex items-center gap-3 p-4">
          <Download className="h-5 w-5 text-gold" aria-hidden />
          <span className="flex-1 text-sm text-text">Export my data (JSON)</span>
          <ChevronRight className="h-4 w-4 text-faint" aria-hidden />
        </GlassCard>
      </a>

      <BottomNav />
    </main>
  );
}
