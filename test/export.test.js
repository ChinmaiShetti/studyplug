/* Tests for Markdown export and backup/restore. Run with: npm test */

const assert = require('node:assert');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const SRC = path.join(__dirname, '..', 'src', 'shared', 'export.js');

const load = () => {
  const sandbox = {};
  sandbox.globalThis = sandbox;
  new Function('globalThis', fs.readFileSync(SRC, 'utf8'))(sandbox);
  return sandbox.StudyPlugExport;
};

const X = load();
const LABELS = { blue: 'Methodology', purple: 'Architecture' };
const labelOf = (k) => LABELS[k] || k;

const hl = (id, text, extra = {}) =>
  ({ id, text, note: '', color: 'blue', role: 'assistant', ...extra });

const conv = (convId, items, extra = {}) =>
  ({ convId, title: 'Chat ' + convId, url: 'https://chatgpt.com/c/' + convId, updated: 1000, items, ...extra });

/* ---------- markdown ---------- */

test('markdown carries a title, a count and the passages', () => {
  const md = X.toMarkdown([hl('a', 'first passage'), hl('b', 'second passage')],
    { title: 'My chat', labelOf, date: new Date('2026-03-04T00:00:00Z') });

  assert.match(md, /^# My chat\n/);
  assert.match(md, /2 highlights/);
  assert.match(md, /^> first passage$/m);
  assert.match(md, /^> second passage$/m);
});

test('a single highlight is not called "1 highlights"', () => {
  assert.match(X.toMarkdown([hl('a', 'x')], { labelOf }), /1 highlight ·/);
});

test('the attribution uses the category name, not the colour key', () => {
  const md = X.toMarkdown([hl('a', 'x', { color: 'blue' })], { labelOf });
  assert.match(md, /\*\*ChatGPT\*\* · Methodology/);
  assert.ok(!md.includes('· blue'), 'the raw key must not leak into the document');
});

test('a user passage is attributed to You', () => {
  const md = X.toMarkdown([hl('a', 'x', { role: 'user' })], { labelOf });
  assert.match(md, /\*\*You\*\*/);
});

test('notes are included, and omitted when absent', () => {
  assert.match(X.toMarkdown([hl('a', 'x', { note: 'remember this' })], { labelOf }),
    /\*Note: remember this\*/);
  assert.ok(!X.toMarkdown([hl('a', 'x')], { labelOf }).includes('*Note:'));
});

test('a multi-line passage is quoted on every line', () => {
  const md = X.toMarkdown([hl('a', 'line one\nline two')], { labelOf });
  assert.match(md, /^> line one$/m);
  assert.match(md, /^> line two$/m,
    'an unquoted second line would break out of the blockquote');
});

test('grouping by category uses headings and drops the repeated label', () => {
  const md = X.toMarkdown(
    [hl('a', 'alpha', { color: 'blue' }), hl('b', 'beta', { color: 'purple' })],
    { labelOf, groupBy: 'category', colorOrder: ['purple', 'blue'] });

  assert.match(md, /^## Architecture$/m);
  assert.match(md, /^## Methodology$/m);
  assert.ok(md.indexOf('## Architecture') < md.indexOf('## Methodology'),
    'colorOrder decides the section order');
  assert.ok(!md.includes('**ChatGPT** · Methodology'),
    'the category is the heading, so repeating it per passage is noise');
});

test('grouping by conversation uses the chat titles as headings', () => {
  const md = X.toMarkdown([
    hl('a', 'alpha', { convId: 'c1', convTitle: 'First chat' }),
    hl('b', 'beta', { convId: 'c2', convTitle: 'Second chat' })
  ], { labelOf, groupBy: 'conversation' });

  assert.match(md, /^## First chat$/m);
  assert.match(md, /^## Second chat$/m);
});

test('showSource cites the chat when it is not already the heading', () => {
  const items = [hl('a', 'alpha', { convId: 'c1', convTitle: 'First chat' })];
  assert.match(X.toMarkdown(items, { labelOf, groupBy: 'category', showSource: true }),
    /First chat/);
  assert.ok(!X.toMarkdown(items, { labelOf, groupBy: 'conversation', showSource: true })
    .includes('**ChatGPT** · Methodology · First chat'),
    'grouped by conversation the source is already the heading');
});

test('an empty export is still a valid document', () => {
  const md = X.toMarkdown([], { title: 'Nothing', labelOf });
  assert.match(md, /^# Nothing/);
  assert.match(md, /0 highlights/);
});

test('the document ends with exactly one newline', () => {
  const md = X.toMarkdown([hl('a', 'x')], { labelOf });
  assert.ok(md.endsWith('\n'));
  assert.ok(!md.endsWith('\n\n'));
});

test('plain text joins passages and their notes', () => {
  const out = X.toPlain([hl('a', 'first'), hl('b', 'second', { note: 'why' })]);
  assert.strictEqual(out, 'first\n\nsecond\n— why');
});

/* ---------- backup ---------- */

test('a backup round-trips unchanged', () => {
  const conversations = [conv('c1', [hl('a', 'alpha', { note: 'n' })]), conv('c2', [hl('b', 'beta')])];
  const labels = { blue: 'Methodology' };

  const parsed = X.parseBackup(JSON.stringify(X.toBackup({ conversations, labels })));
  assert.strictEqual(parsed.ok, true);
  assert.deepStrictEqual(parsed.data.conversations, conversations);
  assert.deepStrictEqual(parsed.data.labels, labels);
});

test('a backup is stamped with its format and version', () => {
  const b = X.toBackup({ conversations: [], labels: {} });
  assert.strictEqual(b.format, 'studyplug-backup');
  assert.strictEqual(b.version, X.BACKUP_VERSION);
  assert.ok(Date.parse(b.exported) > 0);
});

test('bad input is reported, never thrown', () => {
  for (const bad of ['not json', '[]', 'null', '{"format":"something-else"}', '{"format":"studyplug-backup","version":1}']) {
    const res = X.parseBackup(bad);
    assert.strictEqual(res.ok, false, `should have rejected: ${bad}`);
    assert.ok(res.error && typeof res.error === 'string');
  }
});

test('a backup from a newer version is refused rather than half-read', () => {
  const res = X.parseBackup(JSON.stringify({
    format: 'studyplug-backup', version: 99, conversations: []
  }));
  assert.strictEqual(res.ok, false);
  assert.match(res.error, /newer version/);
});

test('malformed conversations are dropped and counted', () => {
  const res = X.parseBackup(JSON.stringify({
    format: 'studyplug-backup',
    version: 1,
    conversations: [conv('c1', [hl('a', 'x')]), { nope: true }, null]
  }));
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.data.conversations.length, 1);
  assert.strictEqual(res.skipped, 2);
});

/* ---------- restore ---------- */

test('merge adds conversations that are not there', () => {
  const { conversations, stats } = X.planRestore([], [conv('c1', [hl('a', 'x')])], 'merge');
  assert.strictEqual(conversations.length, 1);
  assert.strictEqual(stats.conversationsAdded, 1);
  assert.strictEqual(stats.highlightsAdded, 1);
});

test('merge keeps existing highlights and skips duplicate ids', () => {
  const existing = [conv('c1', [hl('a', 'mine')])];
  const incoming = [conv('c1', [hl('a', 'theirs'), hl('b', 'new one')])];

  const { conversations, stats } = X.planRestore(existing, incoming, 'merge');
  const items = conversations[0].items;

  assert.strictEqual(items.length, 2);
  assert.strictEqual(items.find((h) => h.id === 'a').text, 'mine',
    'an id already present is left alone, not overwritten');
  assert.ok(items.find((h) => h.id === 'b'));
  assert.strictEqual(stats.highlightsAdded, 1);
  assert.strictEqual(stats.highlightsSkipped, 1);
});

test('replace takes the backup version of a conversation it names', () => {
  const existing = [conv('c1', [hl('a', 'mine'), hl('z', 'also mine')])];
  const incoming = [conv('c1', [hl('a', 'theirs')])];

  const { conversations } = X.planRestore(existing, incoming, 'replace');
  assert.deepStrictEqual(conversations[0].items.map((h) => h.id), ['a']);
  assert.strictEqual(conversations[0].items[0].text, 'theirs');
});

test('restore never touches a conversation the backup does not mention', () => {
  const existing = [conv('c1', [hl('a', 'keep me')]), conv('c2', [hl('b', 'me too')])];
  for (const mode of ['merge', 'replace']) {
    const { conversations } = X.planRestore(existing, [conv('c1', [hl('c', 'new')])], mode);
    const untouched = conversations.find((c) => c.convId === 'c2');
    assert.deepStrictEqual(untouched.items.map((h) => h.id), ['b'], `mode ${mode}`);
  }
});

test('planRestore does not mutate what it was given', () => {
  const existing = [conv('c1', [hl('a', 'x')])];
  const snapshot = JSON.stringify(existing);
  X.planRestore(existing, [conv('c1', [hl('b', 'y')])], 'merge');
  assert.strictEqual(JSON.stringify(existing), snapshot);
});

test('restoring the same backup twice changes nothing the second time', () => {
  const incoming = [conv('c1', [hl('a', 'x'), hl('b', 'y')])];
  const first = X.planRestore([], incoming, 'merge');
  const second = X.planRestore(first.conversations, incoming, 'merge');

  assert.strictEqual(second.stats.highlightsAdded, 0);
  assert.strictEqual(second.stats.highlightsSkipped, 2);
  assert.deepStrictEqual(second.conversations, first.conversations);
});

test('a backup written before the rename is still readable', () => {
  const res = X.parseBackup(JSON.stringify({
    format: 'chatplug-backup',
    version: 1,
    labels: { blue: 'Methodology' },
    conversations: [conv('c1', [hl('a', 'x')])]
  }));
  assert.strictEqual(res.ok, true, 'a rename must not orphan existing backups');
  assert.strictEqual(res.data.conversations.length, 1);
});

test('a file from some other tool is still refused', () => {
  const res = X.parseBackup(JSON.stringify({ format: 'notes-backup', version: 1, conversations: [] }));
  assert.strictEqual(res.ok, false);
});
