import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Stitcher, buildRejectMarker, parseRejectMarker } from '../src/index.js';

const VALID_ID = 'a'.repeat(32);

function makeError(id, message) {
  return new Error(buildRejectMarker(id, message));
}

test('parseRejectMarker extracts id and message', () => {
  const r = parseRejectMarker('[reject:abc123] boom');
  assert.equal(r.id, 'abc123');
  assert.equal(r.message, 'boom');
});

test('parseRejectMarker handles multiline message', () => {
  const r = parseRejectMarker('[reject:abc123] line1\nline2');
  assert.equal(r.id, 'abc123');
  assert.equal(r.message, 'line1\nline2');
});

test('parseRejectMarker returns null for non-string', () => {
  assert.equal(parseRejectMarker(42), null);
  assert.equal(parseRejectMarker(null), null);
  assert.equal(parseRejectMarker(undefined), null);
});

test('parseRejectMarker returns null for non-marker string', () => {
  assert.equal(parseRejectMarker('just an error'), null);
});

test('parseRejectMarker tolerates leading whitespace', () => {
  const r = parseRejectMarker('  [reject:abc123] trimmed');
  assert.equal(r.id, 'abc123');
  assert.equal(r.message, 'trimmed');
});

test('parseRejectMarker accepts short ids', () => {
  const r = parseRejectMarker('[reject:ab] msg');
  assert.equal(r.id, 'ab');
  assert.equal(r.message, 'msg');
});

test('buildRejectMarker produces parseable output', () => {
  const m = buildRejectMarker('deadbeef', 'fail');
  const r = parseRejectMarker(m);
  assert.equal(r.id, 'deadbeef');
  assert.equal(r.message, 'fail');
});

test('recordRejection throws on invalid id', () => {
  const s = new Stitcher();
  assert.throws(() => s.recordRejection('short', new Error('x')));
});

test('recordRejection throws on non-object error', () => {
  const s = new Stitcher();
  assert.throws(() => s.recordRejection(VALID_ID, 'string'));
  assert.throws(() => s.recordRejection(VALID_ID, null));
});

test('correlate returns entries when id is known', () => {
  const s = new Stitcher();
  const err = makeError(VALID_ID, 'fail');
  s.recordRejection(VALID_ID, err);
  const result = s.correlate(err);
  assert.ok(Array.isArray(result));
  assert.equal(result.length, 1);
  assert.equal(result[0].id, VALID_ID);
});

test('correlate returns null for unknown id', () => {
  const s = new Stitcher();
  const err = makeError('b'.repeat(32), 'nope');
  assert.equal(s.correlate(err), null);
});

test('correlate returns null for non-marker message', () => {
  const s = new Stitcher();
  const err = new Error('plain error');
  assert.equal(s.correlate(err), null);
});

test('correlate returns null for null/undefined input', () => {
  const s = new Stitcher();
  assert.equal(s.correlate(null), null);
  assert.equal(s.correlate(undefined), null);
});

test('multiple rejections with same id accumulate', () => {
  const s = new Stitcher();
  const e1 = makeError(VALID_ID, 'first');
  const e2 = makeError(VALID_ID, 'second');
  s.recordRejection(VALID_ID, e1);
  s.recordRejection(VALID_ID, e2);
  const result = s.correlate(e1);
  assert.equal(result.length, 2);
});

test('maxGroups evicts oldest', () => {
  const s = new Stitcher({ maxGroups: 1 });
  const id1 = '1'.repeat(32);
  const id2 = '2'.repeat(32);
  s.recordRejection(id1, makeError(id1, 'a'));
  s.recordRejection(id2, makeError(id2, 'b'));
  assert.equal(s.getGroup(id1), null);
  assert.ok(s.getGroup(id2) !== null);
});

test('maxGroups of 0 means unlimited', () => {
  const s = new Stitcher({ maxGroups: 0 });
  for (let i = 0; i < 100; i++) {
    const id = i.toString(16).padStart(32, '0');
    s.recordRejection(id, makeError(id, 'x'));
  }
  assert.ok(s.getGroup('0'.repeat(32)) !== null);
});

test('evict removes and returns entries', () => {
  const s = new Stitcher();
  s.recordRejection(VALID_ID, makeError(VALID_ID, 'x'));
  const evicted = s.evict(VALID_ID);
  assert.ok(Array.isArray(evicted));
  assert.equal(evicted.length, 1);
  assert.equal(s.getGroup(VALID_ID), null);
});

test('evict returns null for unknown id', () => {
  const s = new Stitcher();
  assert.equal(s.evict(VALID_ID), null);
});

test('clear removes all groups', () => {
  const s = new Stitcher();
  s.recordRejection(VALID_ID, makeError(VALID_ID, 'x'));
  s.clear();
  assert.equal(s.getGroup(VALID_ID), null);
});
