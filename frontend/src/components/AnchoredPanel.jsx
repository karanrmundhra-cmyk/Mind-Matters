import React, { useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * AnchoredPanel — light-weight floating panel that positions itself next
 * to a DOM anchor element. Used by AttachmentsDialog / ReminderDialog /
 * CommentDrawer to render as inline popovers (next to their row icon)
 * instead of full-screen centered modals.
 *
 * Props:
 *   anchor    — DOM element to position next to (REQUIRED)
 *   open      — boolean
 *   onClose   — () => void
 *   width     — panel width in px (default 360)
 *   maxHeight — panel max-height in px (default 70vh)
 *   side      — "bottom" | "top" (default auto: bottom unless not enough room)
 *   align     — "end" | "start" | "center" (default "end" = align right edge with anchor)
 *   testId    — data-testid hook
 *   children  — panel content (re-rendered each open)
 *
 * Behaviour:
 *   • No backdrop. Click outside (or Escape) dismisses.
 *   • Tracks anchor on scroll + resize so it follows the trigger.
 *   • Lightweight fade/scale-in animation via Tailwind transition.
 */
export default function AnchoredPanel({
  anchor,
  open,
  onClose,
  width = 360,
  maxHeight = "70vh",
  side: preferredSide,
  align = "end",
  testId,
  children,
}) {
  const panelRef = useRef(null);
  const [coords, setCoords] = useState(null);
  const [mounted, setMounted] = useState(false);

  // Compute position relative to viewport (using fixed coords).
  const recompute = () => {
    if (!anchor || !open) return;
    const r = anchor.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = Math.min(width, vw - 16);

    // Vertical placement: prefer bottom; fall back to top if not enough room.
    const spaceBelow = vh - r.bottom;
    const spaceAbove = r.top;
    const side = preferredSide || (spaceBelow >= 220 || spaceBelow >= spaceAbove ? "bottom" : "top");

    // Horizontal placement: align right edge with anchor by default (works
    // best for row-action icons which sit on the right side of the table).
    let left;
    if (align === "start") left = r.left;
    else if (align === "center") left = r.left + r.width / 2 - w / 2;
    else left = r.right - w;
    left = Math.max(8, Math.min(left, vw - w - 8));

    let top;
    if (side === "bottom") top = r.bottom + 6;
    else top = r.top - 6; // we'll translate up by full height in style via transform

    setCoords({ top, left, w, side });
  };

  useLayoutEffect(() => {
    if (!open || !anchor) return;
    recompute();
    setMounted(true);
    const r = () => recompute();
    window.addEventListener("scroll", r, true);
    window.addEventListener("resize", r);
    return () => {
      window.removeEventListener("scroll", r, true);
      window.removeEventListener("resize", r);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, anchor]);

  // Outside click + Escape to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    const onDown = (e) => {
      if (!panelRef.current) return;
      if (panelRef.current.contains(e.target)) return;
      if (anchor && anchor.contains(e.target)) return;
      onClose?.();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open, onClose, anchor]);

  if (!open || !anchor) return null;
  if (!coords) return null;

  const transform = coords.side === "top" ? "translateY(-100%)" : "translateY(0)";

  return (
    <div
      ref={panelRef}
      data-testid={testId}
      className={`fixed z-[70] mm-glass rounded-xl border border-[rgba(201,169,97,0.3)] shadow-2xl transition duration-150 ease-out ${
        mounted ? "opacity-100 scale-100" : "opacity-0 scale-95"
      }`}
      style={{
        top: coords.top,
        left: coords.left,
        width: coords.w,
        maxHeight,
        transform,
        transformOrigin: coords.side === "top" ? "bottom right" : "top right",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {children}
    </div>
  );
}
