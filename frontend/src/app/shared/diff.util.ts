/* ============================================================================
   THE DIFF: engine. computeDiff() builds a field-level model from two
   snapshots; the view components render it. Ported from the design handoff.
   ============================================================================ */

export type DiffStatus = 'added' | 'removed' | 'changed' | 'same';

export interface DiffField {
  key: string;
  old: unknown;
  new: unknown;
  hasO: boolean;
  hasN: boolean;
  status: DiffStatus;
}

export interface DiffModel {
  fields: DiffField[];
  counts: { added: number; removed: number; changed: number; same: number };
}

export const GLYPH: Record<DiffStatus, string> = {
  added: '+',
  removed: '−',
  changed: '~',
  same: '·',
};

/** Parse a JSON-string snapshot from the API into an object, or null when empty/absent. */
export function parseSnapshot(raw: string | null | undefined): Record<string, unknown> | null {
  if (raw == null || raw === '') return null;
  try {
    const o = JSON.parse(raw);
    if (o && typeof o === 'object' && Object.keys(o).length > 0) {
      return o as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

export function fmtVal(v: unknown): string {
  if (v === undefined || v === null) return '';
  if (typeof v === 'string') return v;
  return JSON.stringify(v);
}

export function computeDiff(
  oldData: Record<string, unknown> | null,
  newData: Record<string, unknown> | null,
): DiffModel {
  const o = oldData || {};
  const n = newData || {};
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const k of [...Object.keys(o), ...Object.keys(n)]) {
    if (!seen.has(k)) {
      seen.add(k);
      keys.push(k);
    }
  }
  const fields: DiffField[] = keys.map((key) => {
    const hasO = oldData != null && key in o;
    const hasN = newData != null && key in n;
    const ov = o[key];
    const nv = n[key];
    let status: DiffStatus;
    if (!hasO && hasN) status = 'added';
    else if (hasO && !hasN) status = 'removed';
    else if (JSON.stringify(ov) !== JSON.stringify(nv)) status = 'changed';
    else status = 'same';
    return { key, old: ov, new: nv, hasO, hasN, status };
  });
  const counts = { added: 0, removed: 0, changed: 0, same: 0 };
  fields.forEach((f) => counts[f.status]++);
  return { fields, counts };
}

export function changedFields(
  oldData: Record<string, unknown> | null,
  newData: Record<string, unknown> | null,
): DiffField[] {
  return computeDiff(oldData, newData).fields.filter((f) => f.status !== 'same');
}

export const STATUS_TAG: Record<string, string> = { added: 'add', removed: 'rem', changed: 'chg' };

/** Left-accent class for an entry row, keyed by action type. */
export function leftClass(actionType: string): string {
  if (actionType === 'Delete') return 'left-rem';
  if (actionType === 'Insert' || actionType === 'Restore') return 'left-add';
  return 'left-chg';
}

/** Timeline node class, keyed by action type. */
export function nodeClass(actionType: string): string {
  if (actionType === 'Delete') return 'rem';
  if (actionType === 'Insert' || actionType === 'Restore') return 'add';
  return 'chg';
}

/* ── date helpers ───────────────────────────────────────────────────────── */
/**
 * The API returns naive UTC timestamps (e.g. "2026-06-02T10:53:05.135" with no
 * zone). JS would parse those as *local* time, skewing every relative time by the
 * UTC offset. Treat a zone-less timestamp as UTC by appending "Z".
 */
export function toDate(iso: string): Date {
  if (iso && !/[zZ]|[+-]\d\d:?\d\d$/.test(iso)) return new Date(iso + 'Z');
  return new Date(iso);
}

export function fmtDate(iso: string): string {
  const d = toDate(iso);
  return (
    d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
    ' · ' +
    d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  );
}

export function relTime(iso: string): string {
  const diff = (Date.now() - toDate(iso).getTime()) / 1000;
  if (diff < 45) return 'just now';
  const days = Math.floor(diff / 86400);
  if (days >= 1) return `${days}d ago`;
  const hrs = Math.floor(diff / 3600);
  if (hrs >= 1) return `${hrs}h ago`;
  const mins = Math.floor(diff / 60);
  return `${Math.max(1, mins)}m ago`;
}

export function timeOfDay(iso: string): string {
  return toDate(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function dayLabel(iso: string): string {
  const d = toDate(iso);
  const now = new Date();
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(d, now)) return 'Today';
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (same(d, y)) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'long', day: 'numeric' });
}
