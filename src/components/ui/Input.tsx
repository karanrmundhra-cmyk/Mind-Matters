import { type InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/cn';

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

/** Fully pill-shaped translucent input. */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'pos-focus h-12 w-full rounded-pill px-5 text-[0.95rem] text-text placeholder:text-faint',
        'bg-[rgb(var(--pos-surface)/0.55)] backdrop-blur-xs',
        'border border-[rgb(var(--pos-border)/var(--pos-border-strong-a))]',
        'transition-[box-shadow,background-color] duration-pos ease-pos',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';
