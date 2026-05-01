import React from "react";

/** R.K.M. brand logo — uses the uploaded emblem. */
export default function Logo({ size = 28, className = "", glow = true }) {
  return (
    <div
      className={`inline-flex items-center justify-center relative ${className}`}
      data-testid="app-logo"
      style={{ width: size, height: size }}
    >
      {glow && (
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background:
              "radial-gradient(closest-side, rgba(228,201,140,0.35), transparent 70%)",
            filter: "blur(6px)",
            zIndex: 0,
          }}
        />
      )}
      <img
        src="/rkm-logo.png"
        alt="R.K.M."
        width={size}
        height={size}
        style={{
          position: "relative",
          zIndex: 1,
          objectFit: "contain",
          filter: "drop-shadow(0 1px 6px rgba(228,201,140,0.35))",
        }}
      />
    </div>
  );
}

