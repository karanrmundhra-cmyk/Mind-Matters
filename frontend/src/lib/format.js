/**
 * No-op passthroughs. Originally these auto-title-cased inputs, but per
 * user feedback (v2.1) we preserve exactly what the user typed.
 * Kept as identity functions so existing call-sites need no refactor.
 */
export function capWords(s) {
  return s ?? "";
}

export function capFirst(s) {
  return s ?? "";
}

/** Today in YYYY-MM-DD (local timezone). */
export function todayISO() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
