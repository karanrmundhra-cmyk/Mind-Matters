import { type ButtonHTMLAttributes, forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

type Variant = 'gold' | 'glass' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
};

const base =
  'pos-focus inline-flex select-none items-center justify-center gap-2 rounded-pill font-medium ' +
  'transition-[transform,box-shadow,background-color,opacity] duration-pos ease-pos ' +
  'active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50';

const sizes: Record<Size, string> = {
  sm: 'h-9 px-4 text-sm min-w-[44px]',
  md: 'h-11 px-5 text-[0.95rem] min-w-[44px]',
  lg: 'h-14 px-7 text-base min-w-[44px]',
};

const variants: Record<Variant, string> = {
  // The signature premium action: gold fill, soft inner highlight, gold glow.
  gold:
    'bg-gold text-gold-on shadow-gold-glow hover:brightness-[1.04] ' +
    'border border-[color:var(--pos-gold-deep)]/30',
  glass: 'pos-glass text-text hover:brightness-[1.03]',
  ghost: 'bg-transparent text-muted hover:text-text hover:bg-line',
  danger: 'bg-danger text-danger-on hover:brightness-[1.05]',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'gold', size = 'md', loading, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(base, sizes[size], variants[variant], className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  ),
);
Button.displayName = 'Button';
