/**
 * Capitalize first letter of every word, preserving ALL-CAPS abbreviations
 * (LIC, HDFC, SBI, etc.) — same rule as backend _title_case_smart.
 */
export function capWords(s) {
  if (typeof s !== "string" || !s) return s;
  return s
    .split(/(\s+)/)
    .map((w) => {
      if (!w.trim()) return w;
      if (w.length > 1 && w === w.toUpperCase()) return w; // keep ALL-CAPS
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join("");
}

export function capFirst(s) {
  if (typeof s !== "string" || !s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
