import React from "react";

export function Card({ className = "", children, ...rest }) {
  return (
    <div className={`mm-glass ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function SectionTitle({ title, subtitle, right }) {
  return (
    <div className="flex items-end justify-between mb-5">
      <div>
        <div className="text-[11px] uppercase tracking-[0.3em] text-white/40">
          {subtitle}
        </div>
        <div className="mm-font-display text-2xl sm:text-3xl text-white mt-1">
          {title}
        </div>
      </div>
      {right}
    </div>
  );
}

export function Stat({ label, value, hint, testid }) {
  return (
    <div className="mm-glass p-5" data-testid={testid}>
      <div className="text-[10px] uppercase tracking-[0.3em] text-white/40">{label}</div>
      <div className="mm-font-display text-3xl mt-2">{value}</div>
      {hint && <div className="text-xs text-white/45 mt-1">{hint}</div>}
    </div>
  );
}

export function EmptyState({ title, hint, children }) {
  return (
    <div className="mm-glass p-10 flex flex-col items-center text-center">
      <div className="mm-font-display text-lg text-white/80">{title}</div>
      {hint && <div className="text-sm text-white/45 mt-2 max-w-md">{hint}</div>}
      {children && <div className="mt-5">{children}</div>}
    </div>
  );
}
