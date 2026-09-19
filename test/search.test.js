/* Tests for the search matcher. Run with: npm test */

const assert = require('node:assert');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const SRC = path.join(__dirname, '..', 'src', 'shared', 'search.js');

const load = () => {
  const sandbox = {};
  sandbox.globalThis = sandbox;
  new Function('globalThis', fs.readFileSync(SRC, 'utf8'))(sandbox);
  return sandbox.StudyPlugSearch;
};

const S = load();
const hl = (text, note = '', extra = {}) => ({ text, note, color: 'blue', role: 'assistant', ...extra });

test('splits a query into terms, keeping quoted phrases whole', () => {
  assert.deepStrictEqual(S.terms('eval gate'), ['eval', 'gate']);
  assert.deepStrictEqual(S.terms('  spaced   out  '), ['spaced', 'out']);
  assert.deepStrictEqual(S.terms('"candidate pool" size'), ['candidate pool', 'size']);
  assert.deepStrictEqual(S.terms(''), []);
  assert.deepStrictEqual(S.terms(null), []);
});

test('an empty query matches everything', () => {
  assert.strictEqual(S.matches(hl('anything'), S.terms('')), true);
});

test('matching is case-insensitive', () => {
  assert.strictEqual(S.matches(hl('The Reranker Stage'), S.terms('reranker')), true);
  assert.strictEqual(S.matches(hl('the reranker stage'), S.terms('RERANKER')), true);
});

test('several terms are AND-ed, not OR-ed', () => {
  const h = hl('the reranker scores the candidate pool');
  assert.strictEqual(S.matches(h, S.terms('reranker pool')), true);
  assert.strictEqual(S.matches(h, S.terms('reranker missing')), false);
});

test('terms may be split across the passage and its note', () => {
  const h = hl('the evaluation gate', 'decided in the March review');
  assert.strictEqual(S.matches(h, S.terms('gate March')), true,
    'one term in the passage, one in the note');
});

test('a quoted phrase must appear whole', () => {
  const h = hl('the candidate pool size was fifty');
  assert.strictEqual(S.matches(h, S.terms('"candidate pool"')), true);
  assert.strictEqual(S.matches(h, S.terms('"pool candidate"')), false);
});

test('a missing note never breaks matching', () => {
  const h = { text: 'no note here', color: 'blue' };
  assert.strictEqual(S.matches(h, S.terms('note')), true);
  assert.strictEqual(S.matches(h, S.terms('absent')), false);
});

test('segments marks the matched runs and nothing else', () => {
  const segs = S.segments('the reranker stage', S.terms('reranker'));
  assert.deepStrictEqual(segs, [
    { text: 'the ', hit: false },
    { text: 'reranker', hit: true },
    { text: ' stage', hit: false }
  ]);
});

test('segments rebuild the original text exactly', () => {
  const text = 'Reranker scores the reranked pool';
  for (const q of ['', 'rerank', 'pool scores', '"the reranked"']) {
    const joined = S.segments(text, S.terms(q)).map((s) => s.text).join('');
    assert.strictEqual(joined, text, `lost text for query ${JSON.stringify(q)}`);
  }
});

test('overlapping matches are merged rather than double-wrapped', () => {
  // "ever" and "every" both hit the same run.
  const segs = S.segments('everything', S.terms('ever every'));
  assert.strictEqual(segs.filter((s) => s.hit).length, 1);
  assert.strictEqual(segs.map((s) => s.text).join(''), 'everything');
});

test('every occurrence is marked, not just the first', () => {
  const segs = S.segments('pool and pool again', S.terms('pool'));
  assert.strictEqual(segs.filter((s) => s.hit).length, 2);
});

test('filter applies query, category and role together', () => {
  const items = [
    hl('reranker notes', '', { color: 'blue', role: 'assistant' }),
    hl('reranker question', '', { color: 'green', role: 'user' }),
    hl('unrelated text', '', { color: 'blue', role: 'assistant' })
  ];

  assert.strictEqual(S.filter(items, { query: 'reranker' }).length, 2);
  assert.strictEqual(S.filter(items, { colors: new Set(['blue']) }).length, 2);
  assert.strictEqual(S.filter(items, { role: 'user' }).length, 1);
  assert.strictEqual(
    S.filter(items, { query: 'reranker', colors: new Set(['blue']) }).length, 1);
  assert.strictEqual(S.filter(items, {}).length, 3, 'no filters keeps everything');
});

test('an empty colour set is treated as no colour filter', () => {
  const items = [hl('a', '', { color: 'blue' }), hl('b', '', { color: 'pink' })];
  assert.strictEqual(S.filter(items, { colors: new Set() }).length, 2);
});

test('filter tolerates a missing list', () => {
  assert.deepStrictEqual(S.filter(null, { query: 'x' }), []);
});
