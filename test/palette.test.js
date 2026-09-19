/* Tests for the shared palette and custom category names.
   Run with: npm test */

const assert = require('node:assert');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const SRC = path.join(__dirname, '..', 'src', 'shared', 'palette.js');

/* A stand-in for chrome.storage.local that keeps everything in memory. */
function loadPalette({ withStorage = true, seed = {} } = {}) {
  const store = { ...seed };
  const sandbox = { globalThis: {} };
  sandbox.globalThis = sandbox;

  if (withStorage) {
    sandbox.chrome = {
      storage: {
        local: {
          get: (key, cb) => cb({ [key]: store[key] }),
          set: (obj, cb) => { Object.assign(store, obj); cb && cb(); }
        },
        onChanged: { addListener: (fn) => { sandbox._onChanged = fn; } }
      }
    };
  }

  const code = fs.readFileSync(SRC, 'utf8');
  new Function('globalThis', 'chrome', code)(sandbox, sandbox.chrome);
  return { P: sandbox.StudyPlugPalette, store, sandbox };
}

test('exposes the five keys with fixed hexes', () => {
  const { P } = loadPalette();
  assert.deepStrictEqual(P.keys, ['yellow', 'green', 'blue', 'pink', 'purple']);
  assert.strictEqual(P.hexOf('yellow'), '#f5c518');
  assert.strictEqual(P.hexOf('purple'), '#9b7bf0');
});

test('defaults to the colour name until renamed', () => {
  const { P } = loadPalette();
  assert.strictEqual(P.labelOf('blue'), 'Blue');
  assert.strictEqual(P.isRenamed('blue'), false);
});

test('a custom name replaces the colour name', async () => {
  const { P, store } = loadPalette();
  const applied = await P.setLabel('blue', 'Methodology');
  assert.strictEqual(applied, 'Methodology');
  assert.strictEqual(P.labelOf('blue'), 'Methodology');
  assert.strictEqual(P.isRenamed('blue'), true);
  assert.deepStrictEqual(store['cp:labels'], { blue: 'Methodology' });
  // Untouched colours keep their own names.
  assert.strictEqual(P.labelOf('green'), 'Green');
});

test('clearing a name falls back to the colour, and stops being stored', async () => {
  const { P, store } = loadPalette();
  await P.setLabel('blue', 'Methodology');
  await P.setLabel('blue', '   ');
  assert.strictEqual(P.labelOf('blue'), 'Blue');
  assert.strictEqual(P.isRenamed('blue'), false);
  assert.deepStrictEqual(store['cp:labels'], {},
    'a cleared label should not linger in storage');
});

test('a name equal to the default is not stored as a custom name', async () => {
  const { P, store } = loadPalette();
  await P.setLabel('pink', 'Pink');
  assert.strictEqual(P.isRenamed('pink'), false);
  assert.deepStrictEqual(store['cp:labels'], {});
});

test('names are trimmed, collapsed and length-capped', async () => {
  const { P } = loadPalette();
  await P.setLabel('green', '  Open    questions  ');
  assert.strictEqual(P.labelOf('green'), 'Open questions');

  await P.setLabel('green', 'x'.repeat(200));
  assert.strictEqual(P.labelOf('green').length, P.MAX_LABEL);
});

test('newlines cannot break the one-line header', async () => {
  const { P } = loadPalette();
  await P.setLabel('yellow', 'Line one\nLine two');
  assert.strictEqual(P.labelOf('yellow'), 'Line one Line two');
  assert.ok(!P.labelOf('yellow').includes('\n'));
});

test('refresh applies names already in storage', async () => {
  const { P } = loadPalette({ seed: { 'cp:labels': { purple: 'Architecture' } } });
  assert.strictEqual(P.labelOf('purple'), 'Purple'); // not read yet
  await P.refresh();
  assert.strictEqual(P.labelOf('purple'), 'Architecture');
});

test('an unknown colour key never throws', async () => {
  const { P } = loadPalette();
  assert.strictEqual(P.hexOf('chartreuse'), P.hexOf('yellow'));
  assert.strictEqual(P.labelOf('chartreuse'), 'Yellow');
  assert.strictEqual(await P.setLabel('chartreuse', 'Nope'), null);
});

test('colors is one live array, so renders pick renames up', async () => {
  const { P } = loadPalette();
  const ref = P.colors;
  await P.setLabel('blue', 'Methodology');
  assert.strictEqual(P.colors, ref, 'the array identity must be stable');
  assert.strictEqual(ref.find((c) => c.key === 'blue').label, 'Methodology');
});

test('works with no extension storage at all', async () => {
  const { P } = loadPalette({ withStorage: false });
  assert.strictEqual(P.labelOf('blue'), 'Blue');
  await assert.doesNotReject(() => P.refresh());
  // Without storage the rename cannot persist, but must not throw.
  await assert.doesNotReject(() => P.setLabel('blue', 'Methodology'));
  assert.strictEqual(P.labelOf('blue'), 'Methodology');
});

test('a rename in another tab is applied to this one', async () => {
  const { P, sandbox } = loadPalette();
  let notified = 0;
  P.onChange(() => { notified++; });

  sandbox._onChanged({ 'cp:labels': { newValue: { blue: 'Eval' } } }, 'local');
  assert.strictEqual(P.labelOf('blue'), 'Eval');
  assert.strictEqual(notified, 1);

  // Unrelated keys and other storage areas are ignored.
  sandbox._onChanged({ 'cp:panelOpen': { newValue: true } }, 'local');
  sandbox._onChanged({ 'cp:labels': { newValue: { blue: 'X' } } }, 'sync');
  assert.strictEqual(notified, 1);
  assert.strictEqual(P.labelOf('blue'), 'Eval');
});
