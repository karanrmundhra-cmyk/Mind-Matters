import { type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export type ChipProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
};

/** Elegant pill chip used for filters, group quick-tabs, and attributes. */
export function Chip({ className, active, children, ...props }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        'pos-focus inline-flex h-9 items-center gap-1.5 rounded-pill px-4 text-sm whitespace-nowrap',
        'transition-[background-color,color,box-shadow] duration-pos ease-pos active:scale-[0.97]',
        active
          ? 'bg-gold text-gold-on shadow-gold-glow'
          : 'bg-[rgb(var(--pos-surface)/0.5)] text-muted hover:text-text border border-[rgb(var(--pos-border)/var(--pos-border-a))]',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
