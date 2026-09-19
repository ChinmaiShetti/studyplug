/* Tests for the anchoring engine — the part that has to survive ChatGPT
   re-rendering a turn. Run with: npm test
   Uses jsdom and a message DOM shaped like a real ChatGPT assistant turn. */

const assert = require('node:assert');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const SRC = path.join(__dirname, '..', 'src', 'content');
const SHARED = path.join(__dirname, '..', 'src', 'shared');

/* Same order the manifest loads them in: the palette defines itself on
   globalThis and core.js adopts it. */
const SCRIPTS = [
  path.join(SHARED, 'palette.js'),
  path.join(SRC, 'core.js'),
  path.join(SRC, 'anchor.js')
];

/* A turn with the awkward bits that break naive highlighters: inline <code>,
   <strong> mid-sentence, and a list. Text spans several element boundaries. */
const TURN = `
<article data-message-id="msg-a" data-message-author-role="assistant">
  <div class="markdown">
    <p>The <strong>quick brown</strong> fox jumps over the <code>lazy</code> dog.</p>
    <ul><li>First item here</li><li>Second item here</li></ul>
  </div>
</article>
<article data-message-id="msg-b" data-message-author-role="user">
  <div class="markdown"><p>Tell me more about the fox.</p></div>
</article>`;

function freshDom(markup = TURN) {
  const dom = new JSDOM(`<!doctype html><html><body>${markup}</body></html>`, {
    pretendToBeVisual: true
  });
  const { window } = dom;

  global.window = window;
  global.document = window.document;
  global.Node = window.Node;
  global.NodeFilter = window.NodeFilter;
  global.CSS = window.CSS || { escape: (s) => s.replace(/["\\]/g, '\\$&') };
  if (!window.CSS) window.CSS = global.CSS;

  for (const file of SCRIPTS) {
    // eslint-disable-next-line no-eval
    window.eval(fs.readFileSync(file, 'utf8'));
  }
  return { dom, window, CP: window.__chatplug__ };
}

/* Build a highlight for a literal substring of the message's text. */
function spanFor(CP, msgId, needle, color = 'yellow', extra = {}) {
  const msgEl = CP.messageEl(msgId);
  const whole = CP.fullText(msgEl);
  const start = whole.indexOf(needle);
  assert.notStrictEqual(start, -1, `needle not found: ${needle}`);
  return {
    id: 'h1',
    msgId,
    role: 'assistant',
    start,
    end: start + needle.length,
    text: needle,
    color,
    note: '',
    ts: Date.now(),
    ...extra
  };
}

test('paints a span that sits inside one text node', () => {
  const { CP } = freshDom();
  const h = spanFor(CP, 'msg-a', 'fox jumps');
  assert.strictEqual(CP.paint(h), 'ok');
  const marks = [...CP.marksFor('h1')];
  assert.strictEqual(marks.length, 1);
  assert.strictEqual(marks.map((m) => m.textContent).join(''), 'fox jumps');
  assert.strictEqual(marks[0].dataset.cpColor, 'yellow');
});

test('paints across element boundaries (<strong> and <code>)', () => {
  const { CP } = freshDom();
  const h = spanFor(CP, 'msg-a', 'quick brown fox jumps over the lazy');
  assert.strictEqual(CP.paint(h), 'ok');
  const marks = [...CP.marksFor('h1')];
  assert.ok(marks.length >= 3, `expected several marks, got ${marks.length}`);
  assert.strictEqual(marks.map((m) => m.textContent).join(''), 'quick brown fox jumps over the lazy');
  // Existing markup must survive intact.
  assert.ok(CP.messageEl('msg-a').querySelector('strong'));
  assert.ok(CP.messageEl('msg-a').querySelector('code'));
});

test('painting does not change the message text', () => {
  const { CP } = freshDom();
  const before = CP.fullText(CP.messageEl('msg-a'));
  CP.paint(spanFor(CP, 'msg-a', 'quick brown fox'));
  assert.strictEqual(CP.fullText(CP.messageEl('msg-a')), before);
});

test('offsets stay valid for a second highlight painted after the first', () => {
  const { CP } = freshDom();
  const a = spanFor(CP, 'msg-a', 'quick brown', 'yellow', { id: 'ha' });
  const b = spanFor(CP, 'msg-a', 'Second item', 'blue', { id: 'hb' });
  assert.strictEqual(CP.paint(a), 'ok');
  assert.strictEqual(CP.paint(b), 'ok');
  assert.strictEqual([...CP.marksFor('ha')].map((m) => m.textContent).join(''), 'quick brown');
  assert.strictEqual([...CP.marksFor('hb')].map((m) => m.textContent).join(''), 'Second item');
});

test('unpaint restores the original DOM exactly', () => {
  const { CP } = freshDom();
  const msgEl = CP.messageEl('msg-a');
  const before = msgEl.innerHTML;
  const h = spanFor(CP, 'msg-a', 'quick brown fox jumps');
  CP.paint(h);
  assert.notStrictEqual(msgEl.innerHTML, before);
  CP.unpaint('h1');
  assert.strictEqual(msgEl.innerHTML, before);
  assert.strictEqual(CP.isPainted('h1'), false);
});

test('survives a full re-render: repaint lands on the same words', () => {
  const { CP, window } = freshDom();
  const h = spanFor(CP, 'msg-a', 'jumps over the');
  CP.paint(h);

  // React throwing the turn away and rebuilding it from scratch.
  const msgEl = CP.messageEl('msg-a');
  msgEl.innerHTML = msgEl.innerHTML.replace(/<mark[^>]*>(.*?)<\/mark>/g, '$1');
  assert.strictEqual(CP.isPainted('h1'), false);

  assert.strictEqual(CP.paint(h), 'ok');
  assert.strictEqual([...CP.marksFor('h1')].map((m) => m.textContent).join(''), 'jumps over the');
  void window;
});

test('re-anchors when text shifts, instead of marking the wrong words', () => {
  const { CP } = freshDom();
  const h = spanFor(CP, 'msg-a', 'lazy');
  // The turn is regenerated with a sentence prepended: every offset moves.
  const p = CP.messageEl('msg-a').querySelector('p');
  p.insertAdjacentHTML('beforebegin', '<p>An extra opening sentence was added.</p>');

  assert.strictEqual(CP.paint(h), 'moved');
  assert.strictEqual([...CP.marksFor('h1')].map((m) => m.textContent).join(''), 'lazy');
  // The corrected offsets must now agree with the live text.
  assert.strictEqual(CP.fullText(CP.messageEl('msg-a')).slice(h.start, h.end), 'lazy');
});

test('refuses to paint when the passage is gone', () => {
  const { CP } = freshDom();
  const h = spanFor(CP, 'msg-a', 'quick brown fox');
  CP.messageEl('msg-a').querySelector('p').textContent = 'Completely different answer now.';
  assert.strictEqual(CP.paint(h), false);
  assert.strictEqual(CP.isPainted('h1'), false);
});

test('recolor updates every fragment of a multi-node highlight', () => {
  const { CP } = freshDom();
  const h = spanFor(CP, 'msg-a', 'quick brown fox jumps over the lazy');
  CP.paint(h);
  CP.recolor('h1', 'purple', 'a note');
  for (const m of CP.marksFor('h1')) {
    assert.strictEqual(m.dataset.cpColor, 'purple');
    assert.strictEqual(m.getAttribute('title'), 'a note');
    assert.strictEqual(m.dataset.cpNote, '1');
  }
  CP.recolor('h1', 'green', '');
  for (const m of CP.marksFor('h1')) {
    assert.strictEqual(m.dataset.cpColor, 'green');
    assert.strictEqual(m.hasAttribute('title'), false);
  }
});

test('describeSelection trims whitespace and reports the right turn', () => {
  const { CP, window } = freshDom();
  const msgEl = CP.messageEl('msg-a');
  const textNode = [...CP.textNodes(msgEl)].find((n) => n.nodeValue.includes(' fox jumps'));
  const at = textNode.nodeValue.indexOf(' fox jumps');

  const range = window.document.createRange();
  range.setStart(textNode, at);                       // leading space
  range.setEnd(textNode, at + ' fox jumps '.length);  // trailing space
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);

  const desc = CP.describeSelection(sel);
  assert.ok(desc, 'expected a description');
  assert.strictEqual(desc.msgId, 'msg-a');
  assert.strictEqual(desc.role, 'assistant');
  assert.strictEqual(desc.text, 'fox jumps');
  assert.strictEqual(CP.fullText(msgEl).slice(desc.start, desc.end), 'fox jumps');
});

test('describeSelection ignores selections outside a message turn', () => {
  const { CP, window } = freshDom();
  const stray = window.document.createElement('div');
  stray.textContent = 'sidebar text';
  window.document.body.appendChild(stray);

  const range = window.document.createRange();
  range.selectNodeContents(stray);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);

  assert.strictEqual(CP.describeSelection(sel), null);
});

test('messageOrder indexes turns in conversation order', () => {
  const { CP } = freshDom();
  const order = CP.messageOrder();
  assert.strictEqual(order.get('msg-a'), 0);
  assert.strictEqual(order.get('msg-b'), 1);
});

test('describeSelection records the turn index for ordering', () => {
  const { CP, window } = freshDom();
  const msgEl = CP.messageEl('msg-b');
  // Not textNodes()[0] — that is the whitespace between the tags, and a
  // whitespace-only selection is correctly rejected.
  const node = CP.textNodes(msgEl).find((n) => n.nodeValue.includes('Tell me'));
  const range = window.document.createRange();
  range.setStart(node, 0);
  range.setEnd(node, node.nodeValue.length);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);

  assert.strictEqual(CP.describeSelection(sel).turn, 1);
});

test('inReadingOrder sorts by turn, then by offset within the turn', () => {
  const { CP } = freshDom();
  // Deliberately shuffled, and not in the order they were created.
  const items = [
    { id: 'c', msgId: 'msg-b', turn: 1, start: 5, ts: 1 },
    { id: 'b', msgId: 'msg-a', turn: 0, start: 40, ts: 2 },
    { id: 'a', msgId: 'msg-a', turn: 0, start: 4, ts: 3 }
  ];
  assert.deepStrictEqual(CP.inReadingOrder(items).map((h) => h.id), ['a', 'b', 'c']);
});

test('inReadingOrder falls back to the stored turn for unloaded messages', () => {
  const { CP } = freshDom();
  const items = [
    { id: 'gone', msgId: 'msg-zz', turn: 0, start: 0 }, // turn not in the DOM
    { id: 'here', msgId: 'msg-a', turn: 9, start: 0 }
  ];
  // msg-a is loaded at index 0, so it wins over the stale stored turn of 9;
  // the unloaded one keeps its recorded position rather than vanishing.
  const ids = CP.inReadingOrder(items).map((h) => h.id);
  assert.deepStrictEqual(ids, ['here', 'gone']);
  assert.strictEqual(ids.length, 2);
});

test('inReadingOrder does not mutate the array it is given', () => {
  const { CP } = freshDom();
  const items = [
    { id: 'b', msgId: 'msg-b', turn: 1, start: 0 },
    { id: 'a', msgId: 'msg-a', turn: 0, start: 0 }
  ];
  const before = items.map((h) => h.id);
  CP.inReadingOrder(items);
  assert.deepStrictEqual(items.map((h) => h.id), before);
});

/* Rendered markdown carries real whitespace text nodes between block tags.
   Wrapping one puts an inline box between two block boxes, the browser builds
   an anonymous line box for it, and a blank line opens up mid-list. */
const FORMATTED_LIST = `
<div data-message-id="m1" data-message-author-role="assistant">
  <ul>
    <li><strong>Architecture.md</strong> - why the system is structured</li>
    <li><strong>Benchmark_Report.md</strong> - what benchmarks were run</li>
    <li><strong>Configuration.md</strong> - settings needed to reproduce</li>
  </ul>
</div>`;

const CODE_BLOCK = `
<div data-message-id="m1" data-message-author-role="assistant">
  <pre><code>const a = 1;
const b = 2;
</code></pre>
</div>`;

function paintSpan(CP, msgId, from, to, extra = {}) {
  const whole = CP.fullText(CP.messageEl(msgId));
  const start = whole.indexOf(from);
  const end = whole.indexOf(to) + to.length;
  assert.ok(start >= 0 && end > start, 'fixture text not found');
  const h = { id: 'h1', msgId, start, end, text: whole.slice(start, end), color: 'purple', ...extra };
  return { h, status: CP.paint(h) };
}

test('highlighting across list items adds no blank lines', () => {
  const { CP } = freshDom(FORMATTED_LIST);
  paintSpan(CP, 'm1', 'Architecture.md', 'what benchmarks were run');

  const marks = [...CP.messageEl('m1').querySelectorAll('mark.cp-hl')];
  const blanks = marks.filter((m) => !m.textContent.trim());
  assert.deepStrictEqual(blanks.map((m) => m.parentElement.tagName), [],
    'a whitespace-only mark between block tags renders as a blank line');
  assert.ok(marks.length >= 4, `expected the visible runs to be marked, got ${marks.length}`);
  // The words themselves are all still covered.
  assert.match(marks.map((m) => m.textContent).join(''), /^Architecture\.md.*what benchmarks were run$/s);
});

test('skipping the gaps leaves the list markup untouched', () => {
  const { CP } = freshDom(FORMATTED_LIST);
  const msgEl = CP.messageEl('m1');
  const before = msgEl.innerHTML;
  paintSpan(CP, 'm1', 'Architecture.md', 'settings needed to reproduce');
  assert.strictEqual(msgEl.querySelectorAll('li').length, 3);
  CP.unpaint('h1');
  assert.strictEqual(msgEl.innerHTML, before);
});

test('whitespace inside a code block is still painted', () => {
  const { CP } = freshDom(CODE_BLOCK);
  paintSpan(CP, 'm1', 'const a', 'const b = 2;');
  const joined = [...CP.messageEl('m1').querySelectorAll('mark.cp-hl')]
    .map((m) => m.textContent).join('');
  // In <pre> the newline is content, not formatting — dropping it would leave
  // a visible hole across the two lines.
  assert.ok(joined.includes('\n'), 'newline inside <pre> must stay highlighted');
  assert.strictEqual(joined, 'const a = 1;\nconst b = 2;');
});

test('a highlight in one turn does not leak into another', () => {
  const { CP } = freshDom();
  const h = spanFor(CP, 'msg-b', 'fox', 'pink');
  h.role = 'user';
  assert.strictEqual(CP.paint(h), 'ok');
  assert.strictEqual(CP.messageEl('msg-a').querySelectorAll('mark.cp-hl').length, 0);
  assert.strictEqual(CP.messageEl('msg-b').querySelectorAll('mark.cp-hl').length, 1);
});
