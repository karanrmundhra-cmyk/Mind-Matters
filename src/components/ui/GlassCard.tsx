import { type HTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/cn';

type GlassCardProps = HTMLAttributes<HTMLDivElement> & {
  /** Tighten padding for dense rows. */
  flush?: boolean;
};

/**
 * Floating translucent glass container — the primary surface across the app.
 * Backdrop blur + translucent fill + subtle inner border + soft layered shadow.
 */
export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, flush, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'pos-glass rounded-card',
        flush ? 'p-0' : 'p-5 sm:p-6',
        className,
      )}
      {...props}
    />
  ),
);
GlassCard.displayName = 'GlassCard';
