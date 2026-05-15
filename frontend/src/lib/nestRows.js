/**
 * nestRows — interleave parent → child → grandchild rows into a flat list
 *  with a `_depth` field (0, 1, 2). Caps at depth 2 (so max 3 visible levels).
 *
 * Args:
 *  - rows: array of row objects, each with `id` and optional `parent_id`.
 *  - opts.matches(row): predicate. Parents that fail are hidden; orphan
 *      children whose parent is hidden are still shown if they match.
 *  - opts.flagged(row): if truthy, parents whose `flagged` matches sort to the top.
 *  - opts.maxDepth: cap (default 2 → 3 visible levels).
 *
 * Returns: [{ ...row, _depth, _isSubtask }]
 */
export function nestRows(rows, opts = {}) {
  const matches = opts.matches || (() => true);
  const maxDepth = typeof opts.maxDepth === "number" ? opts.maxDepth : 2;

  const byParent = new Map(); // parent_id -> [rows]
  rows.forEach((r) => {
    if (r.parent_id) {
      if (!byParent.has(r.parent_id)) byParent.set(r.parent_id, []);
      byParent.get(r.parent_id).push(r);
    }
  });

  const out = [];
  const seen = new Set();

  const pushChain = (row, depth) => {
    if (seen.has(row.id)) return;
    seen.add(row.id);
    out.push({ ...row, _depth: depth, _isSubtask: depth > 0 });
    if (depth >= maxDepth) return;
    const kids = (byParent.get(row.id) || []).filter(matches);
    kids.forEach((k) => pushChain(k, depth + 1));
  };

  // Top-level parents: those with no parent_id (root), sort flagged first.
  const flagged = [];
  const normal = [];
  rows.forEach((r) => {
    if (r.parent_id) return;
    if (!matches(r)) return;
    (r.flagged ? flagged : normal).push(r);
  });
  [...flagged, ...normal].forEach((r) => pushChain(r, 0));

  // Orphan children — parent missing or filtered out — still surface them
  // at depth 0 (visually flat) so users never lose visibility of a row.
  rows.forEach((r) => {
    if (!r.parent_id || seen.has(r.id)) return;
    const parentExists = rows.some((p) => p.id === r.parent_id);
    const parentVisible = out.some((x) => x.id === r.parent_id);
    if (!parentExists && matches(r)) {
      out.push({ ...r, _depth: 0, _isSubtask: false });
      seen.add(r.id);
    } else if (parentExists && !parentVisible && matches(r)) {
      // Parent is hidden by filters — show this child flat.
      out.push({ ...r, _depth: 0, _isSubtask: false });
      seen.add(r.id);
    }
  });

  return out;
}

/** Tailwind padding class for a given depth. Caps at depth 2. */
export function depthPaddingClass(depth) {
  if (depth >= 2) return "pl-20";
  if (depth === 1) return "pl-10";
  return "";
}
