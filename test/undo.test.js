/* Tests for the undo stack. The DOM work is injected, so this exercises the
   list handling directly. Run with: npm test */

const assert = require('node:assert');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const SRC = path.join(__dirname, '..', 'src', 'content', 'undo.js');

function loadUndo(options) {
  const CP = {};
  const sandbox = { window: { __studyplug__: CP } };
  new Function('window', fs.readFileSync(SRC, 'utf8'))(sandbox.window);
  return CP.createUndo(options);
}

const hl = (id, extra = {}) => ({ id, msgId: 'm1', start: 0, end: 5, text: 'x', color: 'yellow', note: '', ...extra });

test('nothing to undo returns null', () => {
  const u = loadUndo();
  assert.strictEqual(u.canUndo(), false);
  assert.strictEqual(u.undo([]), null);
});

test('restores a removed highlight', () => {
  const u = loadUndo();
  const gone = hl('a');
  u.push({ undoLabel: 'Highlight restored', restore: [gone] });

  const painted = [];
  const res = u.undo([hl('b')], { onPaint: (h) => { painted.push(h.id); return 'ok'; } });

  assert.deepStrictEqual(res.items.map((h) => h.id), ['b', 'a']);
  assert.deepStrictEqual(painted, ['a']);
  assert.strictEqual(res.label, 'Highlight restored');
  assert.strictEqual(res.unpainted, 0);
  assert.strictEqual(u.canUndo(), false, 'the entry is consumed');
});

test('restores every highlight after a clear', () => {
  const u = loadUndo();
  const all = [hl('a'), hl('b'), hl('c')];
  u.push({ undoLabel: '3 highlights restored', restore: all });

  const res = u.undo([], { onPaint: () => 'ok' });
  assert.deepStrictEqual(res.items.map((h) => h.id), ['a', 'b', 'c']);
});

test('a replacement is undone in both directions at once', () => {
  const u = loadUndo();
  // Re-marking a passage displaced 'old' and added 'new'.
  const old = hl('old', { color: 'blue' });
  u.push({ undoLabel: 'Replacement undone', restore: [old], remove: ['new'] });

  const unpainted = [];
  const res = u.undo([hl('new', { color: 'pink' }), hl('other')], {
    onPaint: () => 'ok',
    onUnpaint: (id) => unpainted.push(id)
  });

  assert.deepStrictEqual(res.items.map((h) => h.id), ['other', 'old'],
    'the new mark goes and the displaced one comes back');
  assert.deepStrictEqual(unpainted, ['new']);
});

test('restoring skips an id that is already present', () => {
  const u = loadUndo();
  u.push({ undoLabel: 'x', restore: [hl('a')] });

  const res = u.undo([hl('a')], { onPaint: () => 'ok' });
  assert.strictEqual(res.items.length, 1, 'no duplicate');
});

test('counts highlights whose turn is no longer loaded', () => {
  const u = loadUndo();
  u.push({ undoLabel: 'x', restore: [hl('a'), hl('b')] });

  // paint() returns false when the message is not in the DOM.
  const res = u.undo([], { onPaint: (h) => h.id !== 'b' });
  assert.strictEqual(res.unpainted, 1);
  assert.strictEqual(res.items.length, 2,
    'the record keeps them either way — they repaint when the turn loads');
});

test('set restores a previous colour in place', () => {
  const u = loadUndo();
  u.push({ undoLabel: 'Colour restored', set: [{ id: 'a', color: 'yellow' }] });

  const live = [hl('a', { color: 'purple' })];
  const touched = [];
  const res = u.undo(live, { onSet: (h) => touched.push(h.id) });

  assert.strictEqual(res.items[0].color, 'yellow');
  assert.strictEqual(live[0].color, 'yellow', 'applied to the caller’s object');
  assert.deepStrictEqual(touched, ['a']);
});

test('set restores a previous note, including clearing it', () => {
  const u = loadUndo();
  u.push({ undoLabel: 'Note restored', set: [{ id: 'a', note: 'the old note' }] });
  let res = u.undo([hl('a', { note: 'replaced' })], {});
  assert.strictEqual(res.items[0].note, 'the old note');

  u.push({ undoLabel: 'Note restored', set: [{ id: 'a', note: '' }] });
  res = u.undo([hl('a', { note: 'added by mistake' })], {});
  assert.strictEqual(res.items[0].note, '');
});

test('a set for a highlight that no longer exists is ignored', () => {
  const u = loadUndo();
  u.push({ undoLabel: 'x', set: [{ id: 'ghost', color: 'blue' }] });
  const res = u.undo([hl('a')], {});
  assert.strictEqual(res.items.length, 1);
  assert.strictEqual(res.items[0].color, 'yellow');
});

test('the stack is bounded and drops the oldest first', () => {
  const u = loadUndo({ limit: 3 });
  for (const id of ['1', '2', '3', '4']) {
    u.push({ undoLabel: id, restore: [hl(id)] });
  }
  assert.strictEqual(u.size(), 3);
  assert.strictEqual(u.undo([], {}).label, '4');
  assert.strictEqual(u.undo([], {}).label, '3');
  assert.strictEqual(u.undo([], {}).label, '2');
  assert.strictEqual(u.undo([], {}), null, 'the oldest was dropped');
});

test('undo is last-in first-out', () => {
  const u = loadUndo();
  u.push({ undoLabel: 'first', restore: [hl('a')] });
  u.push({ undoLabel: 'second', restore: [hl('b')] });
  assert.strictEqual(u.undo([], {}).label, 'second');
  assert.strictEqual(u.undo([], {}).label, 'first');
});

test('undo does not mutate the array it is given', () => {
  const u = loadUndo();
  u.push({ undoLabel: 'x', restore: [hl('b')] });
  const items = [hl('a')];
  u.undo(items, { onPaint: () => 'ok' });
  assert.deepStrictEqual(items.map((h) => h.id), ['a']);
});
