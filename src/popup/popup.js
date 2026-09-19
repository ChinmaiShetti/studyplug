/* ChatPlug — popup.

   The content script is the source of truth: it owns both the painted DOM and
   the stored record, so every mutation goes through it and comes back as the
   new list. The popup only renders and asks. */

/* Shared with the content scripts — see src/shared/palette.js. Custom category
   names are loaded before the first render in boot(). */
const PALETTE = globalThis.ChatPlugPalette;
const COLORS = PALETTE.colors;

const TRASH = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2.8 4.3h10.4M6.4 4.3V3a1 1 0 0 1 1-1h1.2a1 1 0 0 1 1 1v1.3M4.2 4.3l.5 8.2a1.2 1.2 0 0 0 1.2 1.1h4.2a1.2 1.2 0 0 0 1.2-1.1l.5-8.2"/></svg>';

const el = {
  count: document.getElementById('count'),
  convo: document.getElementById('convo'),
  filters: document.getElementById('filters'),
  list: document.getElementById('list'),
  foot: document.getElementById('foot'),
  openPanel: document.getElementById('openPanel'),
  copyAll: document.getElementById('copyAll'),
  exportMd: document.getElementById('exportMd'),
  clear: document.getElementById('clear'),
  confirm: document.getElementById('confirm'),
  clearYes: document.getElementById('clearYes'),
  clearNo: document.getElementById('clearNo')
};

let tabId = null;
let state = { title: '', items: [] };
let filter = null; // colour key, or null for all

const hexOf = (key) => PALETTE.hexOf(key);
const labelOf = (key) => PALETTE.labelOf(key);

const timeOf = (ts) =>
  new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const send = (msg) =>
  new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, msg, (res) => {
      void chrome.runtime.lastError; // tab may not have the content script
      resolve(res || null);
    });
  });

/* ---------- rendering ---------- */

const showMessage = (title, body) => {
  el.list.innerHTML = '';
  const box = document.createElement('div');
  box.className = 'empty';
  const h = document.createElement('strong');
  h.textContent = title;
  const p = document.createElement('p');
  p.innerHTML = body; // only ever built from the literals below
  box.append(h, p);
  el.list.appendChild(box);
  el.foot.hidden = true;
  el.filters.hidden = true;
  el.count.textContent = '';
};

const renderFilters = () => {
  const present = new Set(state.items.map((h) => h.color));
  el.filters.hidden = state.items.length === 0;
  el.filters.innerHTML = '';

  for (const c of COLORS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'swatch';
    b.style.setProperty('--sw', c.hex);
    const n = state.items.filter((h) => h.color === c.key).length;
    b.title = n ? `${c.label} — ${n}` : `${c.label} — none`;
    b.setAttribute('aria-label', b.title);
    b.setAttribute('aria-pressed', String(filter === c.key));
    if (!present.has(c.key)) b.dataset.empty = '1';
    else if (filter && filter !== c.key) b.dataset.dim = '1';
    b.innerHTML = '<i></i>';
    b.addEventListener('click', () => {
      filter = filter === c.key ? null : c.key;
      render();
    });
    el.filters.appendChild(b);
  }

  const reset = document.createElement('button');
  reset.type = 'button';
  reset.className = 'filter-note';
  reset.textContent = 'Show all';
  reset.hidden = filter === null;
  reset.addEventListener('click', () => { filter = null; render(); });
  el.filters.appendChild(reset);
};

const renderEntry = (h) => {
  const row = document.createElement('div');
  row.className = 'entry';
  row.style.setProperty('--rule', hexOf(h.color));
  row.tabIndex = 0;
  row.setAttribute('role', 'button');
  row.title = 'Jump to this passage';

  const meta = document.createElement('div');
  meta.className = 'meta';
  const role = document.createElement('span');
  role.textContent = h.role === 'user' ? 'You' : h.role === 'assistant' ? 'ChatGPT' : 'Message';
  const dot = document.createElement('span');
  dot.className = 'dot';
  dot.textContent = '·';
  const when = document.createElement('span');
  when.textContent = timeOf(h.ts);
  meta.append(role, dot, when);

  const quote = document.createElement('p');
  quote.className = 'quote';
  quote.textContent = h.text;

  row.append(meta, quote);

  if (h.note) {
    const note = document.createElement('p');
    note.className = 'note';
    note.textContent = h.note;
    row.appendChild(note);
  }

  const kill = document.createElement('button');
  kill.type = 'button';
  kill.className = 'kill';
  kill.title = 'Remove highlight';
  kill.setAttribute('aria-label', 'Remove highlight');
  kill.innerHTML = TRASH;
  kill.addEventListener('click', async (e) => {
    e.stopPropagation();
    const res = await send({ type: 'CP_REMOVE', id: h.id });
    if (res?.ok) { state.items = res.items; render(); }
  });
  row.appendChild(kill);

  const jump = async () => {
    const res = await send({ type: 'CP_SCROLL', id: h.id });
    if (res?.ok) window.close();
    else showTransient('That turn is not on screen yet — scroll it into view first.');
  };
  row.addEventListener('click', jump);
  row.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); jump(); }
  });

  return row;
};

let transientTimer;
const showTransient = (text) => {
  clearTimeout(transientTimer);
  el.convo.dataset.was = el.convo.dataset.was || el.convo.textContent;
  el.convo.textContent = text;
  transientTimer = setTimeout(() => {
    el.convo.textContent = el.convo.dataset.was;
    delete el.convo.dataset.was;
  }, 2600);
};

const render = () => {
  const items = [...state.items].sort((a, b) => b.ts - a.ts);
  const shown = filter ? items.filter((h) => h.color === filter) : items;

  const total = state.items.length;
  el.count.textContent = !total
    ? ''
    : filter
      ? `${shown.length} of ${total}`
      : `${total} ${total === 1 ? 'mark' : 'marks'}`;

  if (!total) {
    showMessage(
      'Nothing marked yet',
      'Select any text in a ChatGPT message, then pick a colour. Or press <kbd>Alt</kbd>+<kbd>1</kbd>–<kbd>5</kbd> with text selected.'
    );
    return;
  }

  renderFilters();
  el.foot.hidden = false;
  el.list.innerHTML = '';

  if (!shown.length) {
    const box = document.createElement('div');
    box.className = 'empty';
    box.innerHTML = '<p>No marks in this colour.</p>';
    el.list.appendChild(box);
    return;
  }

  const frag = document.createDocumentFragment();
  for (const h of shown) frag.appendChild(renderEntry(h));
  el.list.appendChild(frag);
};

/* ---------- export ---------- */

const asMarkdown = () => {
  const items = [...state.items].sort((a, b) => a.ts - b.ts);
  const lines = [`# ${state.title}`, '', `${items.length} highlights · ${new Date().toLocaleDateString()}`, ''];
  for (const h of items) {
    const who = h.role === 'user' ? 'You' : 'ChatGPT';
    lines.push(`**${who}** · ${labelOf(h.color)}`);
    lines.push('');
    lines.push(h.text.split('\n').map((l) => '> ' + l).join('\n'));
    if (h.note) { lines.push(''); lines.push(`*Note: ${h.note}*`); }
    lines.push('');
    lines.push('---');
    lines.push('');
  }
  return lines.join('\n');
};

const asPlain = () =>
  [...state.items]
    .sort((a, b) => a.ts - b.ts)
    .map((h) => (h.note ? `${h.text}\n— ${h.note}` : h.text))
    .join('\n\n');

const flash = (btn, word) => {
  const was = btn.textContent;
  btn.textContent = word;
  setTimeout(() => { btn.textContent = was; }, 1200);
};

/* The in-page panel is the better place to work through a long list, so hand
   the reader over to it and get out of the way. */
el.openPanel.addEventListener('click', async () => {
  await send({ type: 'CP_PANEL', open: true });
  window.close();
});

el.copyAll.addEventListener('click', async () => {
  await navigator.clipboard.writeText(asPlain());
  flash(el.copyAll, 'Copied');
});

el.exportMd.addEventListener('click', () => {
  const blob = new Blob([asMarkdown()], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const safe = (state.title || 'chatgpt-highlights').replace(/[^\w\s-]/g, '').trim().slice(0, 60) || 'chatgpt-highlights';
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safe} — highlights.md`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  flash(el.exportMd, 'Saved');
});

el.clear.addEventListener('click', () => {
  el.clear.hidden = true;
  el.confirm.hidden = false;
});

el.clearNo.addEventListener('click', () => {
  el.confirm.hidden = true;
  el.clear.hidden = false;
});

el.clearYes.addEventListener('click', async () => {
  const res = await send({ type: 'CP_CLEAR' });
  el.confirm.hidden = true;
  el.clear.hidden = false;
  if (res?.ok) { state.items = []; filter = null; render(); }
});

/* ---------- boot ---------- */

(async () => {
  await PALETTE.refresh(); // custom category names, before anything renders
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  tabId = tab?.id ?? null;
  const url = tab?.url || '';

  if (!/^https:\/\/(chatgpt\.com|chat\.openai\.com)\//.test(url)) {
    el.convo.textContent = 'Not a ChatGPT tab';
    showMessage('Open ChatGPT to start', 'Highlights are saved per conversation. Open a conversation at chatgpt.com and select some text.');
    return;
  }

  const res = await send({ type: 'CP_QUERY' });

  if (!res?.ok) {
    el.convo.textContent = 'Reload the page';
    showMessage('ChatPlug is not running here', 'The page was probably open before the extension loaded. Reload the ChatGPT tab and try again.');
    return;
  }

  if (!res.convId) {
    el.convo.textContent = 'New conversation';
    showMessage('No conversation yet', 'Send a message first — highlights are saved against a conversation.');
    return;
  }

  state = { title: res.title, items: res.items };
  el.convo.textContent = res.title;
  el.convo.title = res.title;
  render();
})();
