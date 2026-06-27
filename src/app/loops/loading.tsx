import { BottomNav } from '@/components/ui/BottomNav';

/** Skeleton shown while the Loops screen data loads. */
export default function LoopsLoading() {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-md px-5 pb-44 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <div className="mb-5">
        <div className="h-8 w-28 animate-pulse rounded-pill bg-[rgb(var(--pos-surface)/0.6)]" />
      </div>
      <div className="mb-4 flex gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-9 w-20 animate-pulse rounded-pill bg-[rgb(var(--pos-surface)/0.5)]" />
        ))}
      </div>
      <ul className="space-y-2.5" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <li key={i} className="pos-glass flex items-center gap-3 rounded-card p-3.5">
            <div className="h-7 w-7 animate-pulse rounded-pill bg-[rgb(var(--pos-surface)/0.6)]" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-2/3 animate-pulse rounded-pill bg-[rgb(var(--pos-surface)/0.6)]" />
              <div className="h-3 w-1/3 animate-pulse rounded-pill bg-[rgb(var(--pos-surface)/0.4)]" />
            </div>
          </li>
        ))}
      </ul>
      <BottomNav />
    </main>
  );
}
