import React from "react";

/** Minimalist monochrome logo — concentric arcs (mind + waves) */
export default function Logo({ size = 28, className = "" }) {
  return (
    <div
      className={`inline-flex items-center justify-center ${className}`}
      data-testid="app-logo"
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 64 64"
        width={size}
        height={size}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      >
        <circle cx="32" cy="32" r="26" opacity="0.25" />
        <circle cx="32" cy="32" r="19" opacity="0.45" />
        <circle cx="32" cy="32" r="12" opacity="0.7" />
        <circle cx="32" cy="32" r="4.5" fill="currentColor" stroke="none" />
        <path
          d="M6 42 C 18 36, 28 48, 40 42 S 58 36, 62 40"
          opacity="0.5"
        />
      </svg>
    </div>
  );
}
