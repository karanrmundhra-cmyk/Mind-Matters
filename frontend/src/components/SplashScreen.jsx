import React from "react";
import Logo from "@/components/Logo";

export default function SplashScreen() {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      data-testid="splash-screen"
    >
      <div className="flex flex-col items-center mm-fade-in">
        <Logo size={120} />
        <div className="mt-6 mm-font-serif text-4xl tracking-wide text-white/95">
          Mind Matters
        </div>
        <div className="mt-3 mm-wave-line" />
        <div className="mt-3 text-xs uppercase tracking-[0.32em] text-white/40">
          Personal Operating System
        </div>
      </div>
    </div>
  );
}
