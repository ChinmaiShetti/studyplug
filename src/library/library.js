/* ChatPlug — the library.

   Every highlight across every conversation, searchable. An extension page
   rather than a bigger popup: a popup closes on any outside click, which makes
   reading and searching miserable.

   Read-only over storage. Editing stays where the passage is — this page hands
   you back to the conversation. */

const PALETTE = globalThis.ChatPlugPalette;
const RECORDS = globalThis.ChatPlugRecords;
const SEARCH = globalThis.ChatPlugSearch;

const ARROW = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8h9M8.5 4l4 4-4 4"/></svg>';

const el = {
  q: document.getElementById('q'),
  clearQ: document.getElementById('clearQ'),
  swatches: document.getElementById('swatches'),
  results: document.getElementById('results'),
  tally: document.getElementById('tally')
};

let all = [];                    // every highlight, tagged with its conversation
let query = '';
let role = '';                   // '' | 'user' | 'assistant'
let grouping = 'conversation';   // 'conversation' | 'category'
const colors = new Set();        // empty means every category

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/* ---------- rendering ---------- */

/* Matched runs are marked rather than the whole passage, so you can see why a
   result is in the list. */
const withHits = (node, text, terms) => {
  for (const seg of SEARCH.segments(text, terms)) {
    if (!seg.text) continue;
    if (seg.hit) {
      const m = document.createElement('mark');
      m.textContent = seg.text;
      node.append(m);
    } else {
      node.append(document.createTextNode(seg.text));
    }
  }
  return node;
};

/* Opens the conversation and points it at this passage. The content script
   picks the id out of the hash once the turn has painted. */
const openAt = (h) => {
  const base = (h.convUrl || `https://chatgpt.com/c/${h.convId}`).split('#')[0];
  chrome.tabs.create({ url: `${base}#cp=${encodeURIComponent(h.id)}` });
};

/* Whichever of the two the heading is not already saying: grouped by chat, the
   card names the category; grouped by category, it names the chat. */
const renderCard = (h, terms, groupedBy) => {
  const card = document.createElement('article');
  card.className = 'card';
  card.style.setProperty('--gc', PALETTE.hexOf(h.color));

  const main = document.createElement('div');

  const who = document.createElement('div');
  who.className = 'who';
  who.append(h.role === 'user' ? 'You' : 'ChatGPT');
  if (groupedBy === 'category') {
    who.append(' · ');
    const from = document.createElement('span');
    from.className = 'from';
    from.textContent = h.convTitle || 'Untitled conversation';
    who.append(from);
  } else {
    who.append(' · ');
    const cat = document.createElement('span');
    cat.className = 'cat';
    cat.textContent = PALETTE.labelOf(h.color);
    who.append(cat);
  }
  if (h.ts) {
    who.append(' · ' + new Date(h.ts).toLocaleDateString());
  }

  const quote = document.createElement('blockquote');
  withHits(quote, h.text, terms);

  main.append(who, quote);

  if (h.note) {
    const note = document.createElement('p');
    note.className = 'note';
    withHits(note, h.note, terms);
    main.append(note);
  }

  const go = document.createElement('button');
  go.type = 'button';
  go.className = 'go';
  go.innerHTML = ARROW;
  go.append(document.createTextNode('Open in chat'));
  go.title = 'Open the conversation at this passage';
  go.addEventListener('click', () => openAt(h));

  card.append(main, go);
  return card;
};

const renderGroup = ({ title, subtitle, colorKey, items, terms, href }) => {
  const section = document.createElement('section');
  section.className = 'group';
  if (colorKey) section.style.setProperty('--gc', PALETTE.hexOf(colorKey));

  const head = document.createElement('div');
  head.className = 'ghead';

  if (colorKey) {
    const chip = document.createElement('span');
    chip.className = 'chip';
    head.append(chip);
  }

  const h2 = document.createElement('h2');
  h2.textContent = title;
  h2.title = title;
  head.append(h2);

  const meta = document.createElement('span');
  meta.className = 'meta';
  meta.textContent = subtitle;
  head.append(meta);

  if (href) {
    const open = document.createElement('a');
    open.className = 'open';
    open.href = href;
    open.target = '_blank';
    open.rel = 'noreferrer';
    open.textContent = 'Open chat';
    head.append(open);
  }

  section.append(head);
  for (const h of items) section.append(renderCard(h, terms, colorKey ? 'category' : 'conversation'));
  return section;
};

const showEmpty = (title, body) => {
  const box = document.createElement('div');
  box.className = 'empty';
  const s = document.createElement('strong');
  s.textContent = title;
  const p = document.createElement('p');
  p.textContent = body;
  box.append(s, p);
  el.results.replaceChildren(box);
};

const renderSwatches = () => {
  el.swatches.replaceChildren();
  for (const c of PALETTE.colors) {
    const n = all.filter((h) => h.color === c.key).length;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'swatch';
    b.style.setProperty('--sw', c.hex);
    b.setAttribute('aria-pressed', String(colors.has(c.key)));
    if (!n) b.dataset.empty = '1';

    const dot = document.createElement('i');
    const name = document.createElement('span');
    name.textContent = c.label;
    const count = document.createElement('span');
    count.className = 'n';
    count.textContent = n;
    b.append(dot, name, count);

    b.addEventListener('click', () => {
      if (colors.has(c.key)) colors.delete(c.key);
      else colors.add(c.key);
      render();
    });
    el.swatches.append(b);
  }
};

const render = () => {
  const terms = SEARCH.terms(query);
  const shown = SEARCH.filter(all, { query, colors, role });

  el.clearQ.hidden = !query;
  for (const b of document.querySelectorAll('[data-role]')) {
    b.setAttribute('aria-pressed', String(b.dataset.role === role));
  }
  for (const b of document.querySelectorAll('[data-group]')) {
    b.setAttribute('aria-pressed', String(b.dataset.group === grouping));
  }
  for (const b of el.swatches.children) {
    const key = PALETTE.colors[[...el.swatches.children].indexOf(b)]?.key;
    b.setAttribute('aria-pressed', String(colors.has(key)));
  }

  const filtered = shown.length !== all.length;
  el.tally.textContent = all.length
    ? (filtered
      ? `${shown.length} of ${plural(all.length, 'highlight', 'highlights')}`
      : plural(all.length, 'highlight', 'highlights'))
    : '';

  if (!all.length) {
    showEmpty('Nothing saved yet',
      'Highlight something in a ChatGPT conversation and it will show up here, across every chat you mark.');
    return;
  }

  if (!shown.length) {
    showEmpty('No matches',
      'Nothing here matches that search and those filters. Try fewer words, or clear a category.');
    return;
  }

  const sections = [];

  if (grouping === 'category') {
    for (const c of PALETTE.colors) {
      const items = shown.filter((h) => h.color === c.key);
      if (!items.length) continue;
      /* Within a category, newest conversation first, then reading order. */
      items.sort((a, b) => (b.ts || 0) - (a.ts || 0));
      sections.push(renderGroup({
        title: c.label,
        subtitle: plural(items.length, 'highlight', 'highlights'),
        colorKey: c.key,
        items,
        terms
      }));
    }
  } else {
    const byConv = new Map();
    for (const h of shown) {
      if (!byConv.has(h.convId)) byConv.set(h.convId, []);
      byConv.get(h.convId).push(h);
    }
    for (const [convId, items] of byConv) {
      /* Reading order within a chat: the turn, then the offset in it. */
      items.sort((a, b) => (a.turn ?? 0) - (b.turn ?? 0) || (a.start ?? 0) - (b.start ?? 0));
      const first = items[0];
      sections.push(renderGroup({
        title: first.convTitle || 'Untitled conversation',
        subtitle: plural(items.length, 'highlight', 'highlights'),
        items,
        terms,
        href: first.convUrl || `https://chatgpt.com/c/${convId}`
      }));
    }
  }

  el.results.replaceChildren(...sections);
};

/* ---------- events ---------- */

let typing;
el.q.addEventListener('input', () => {
  clearTimeout(typing);
  typing = setTimeout(() => { query = el.q.value; render(); }, 110);
});

el.q.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && el.q.value) {
    e.preventDefault();
    el.q.value = '';
    query = '';
    render();
  }
});

el.clearQ.addEventListener('click', () => {
  el.q.value = '';
  query = '';
  el.q.focus();
  render();
});

for (const b of document.querySelectorAll('[data-role]')) {
  b.addEventListener('click', () => { role = b.dataset.role; render(); });
}
for (const b of document.querySelectorAll('[data-group]')) {
  b.addEventListener('click', () => { grouping = b.dataset.group; render(); });
}

/* Typing anywhere goes to the search box — this page is for finding things. */
document.addEventListener('keydown', (e) => {
  if (e.target === el.q || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key.length === 1 || e.key === 'Backspace') el.q.focus();
});

/* ---------- boot ---------- */

(async () => {
  await PALETTE.refresh();
  all = await RECORDS.loadAllHighlights();
  renderSwatches();
  render();
  el.q.focus();
})();

/* A rename or a change made in a ChatGPT tab should show up here without a
   reload — this page is likely to be left open. */
try {
  chrome.storage.onChanged.addListener(async (changes, area) => {
    if (area !== 'local') return;
    const touched = Object.keys(changes);
    if (touched.some((k) => k.startsWith(RECORDS.CONV_PREFIX) || k === RECORDS.INDEX_KEY)) {
      all = await RECORDS.loadAllHighlights();
      renderSwatches();
      render();
    } else if (touched.includes(PALETTE.LABELS_KEY)) {
      renderSwatches();
      render();
    }
  });
} catch { /* not an extension context */ }
