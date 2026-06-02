import { describe, it, expect } from 'vitest';
import { computeDiff, parseSnapshot, fmtVal, changedFields } from './diff.util';

/**
 * The signature logic of the app: the field-by-field old-vs-new diff that drives
 * every Change-History view. The UI rendering is thin; these pure functions are
 * where correctness lives.
 */
describe('parseSnapshot', () => {
  it('parses a JSON-string snapshot into an object', () => {
    expect(parseSnapshot('{"Title":"X","Severity":"Low"}')).toEqual({
      Title: 'X',
      Severity: 'Low',
    });
  });

  it('treats an empty {} snapshot as null (the N/A sentinel)', () => {
    expect(parseSnapshot('{}')).toBeNull();
  });

  it('treats empty / null / malformed input as null', () => {
    expect(parseSnapshot('')).toBeNull();
    expect(parseSnapshot(null)).toBeNull();
    expect(parseSnapshot(undefined)).toBeNull();
    expect(parseSnapshot('not json')).toBeNull();
  });
});

describe('computeDiff', () => {
  it('flags a key that differs between old and new as "changed", not the identical one', () => {
    const { fields } = computeDiff(
      { title: 'Old Title', severity: 'Low' },
      { title: 'New Title', severity: 'Low' },
    );
    const byKey = Object.fromEntries(fields.map((f) => [f.key, f.status]));
    expect(byKey['title']).toBe('changed');
    expect(byKey['severity']).toBe('same');
  });

  it('treats an Insert (old = null) as every key added', () => {
    const { fields, counts } = computeDiff(null, { title: 'Created', severity: 'High' });
    expect(fields.every((f) => f.status === 'added')).toBe(true);
    expect(counts.added).toBe(2);
    expect(counts.removed).toBe(0);
  });

  it('treats a Delete (new = null) as every key removed', () => {
    const { fields, counts } = computeDiff({ title: 'Removed', severity: 'Critical' }, null);
    expect(fields.every((f) => f.status === 'removed')).toBe(true);
    expect(counts.removed).toBe(2);
    expect(counts.added).toBe(0);
  });

  it('counts a mix of added / changed / same correctly', () => {
    const { counts } = computeDiff(
      { a: 1, b: 2, c: 3 },
      { a: 1, b: 99, d: 4 }, // a same, b changed, c removed, d added
    );
    expect(counts).toEqual({ added: 1, removed: 1, changed: 1, same: 1 });
  });
});

describe('changedFields', () => {
  it('returns only the non-"same" fields', () => {
    const changed = changedFields({ a: 1, b: 2 }, { a: 1, b: 3, c: 4 });
    const keys = changed.map((f) => f.key).sort();
    expect(keys).toEqual(['b', 'c']);
  });
});

describe('fmtVal', () => {
  it('renders strings as-is and serializes non-strings', () => {
    expect(fmtVal('hello')).toBe('hello');
    expect(fmtVal(3)).toBe('3');
    expect(fmtVal(true)).toBe('true');
    expect(fmtVal(null)).toBe('');
    expect(fmtVal({ a: 1 })).toBe('{"a":1}');
  });
});
