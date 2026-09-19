/* StudyPlug — the in-page panel.

   Docks to the right of the conversation and lists every highlight in the chat,
   grouped by colour and ordered the way they appear in the conversation, not
   the order they were made in. Each entry opens to show the whole passage, its
   note, and the controls for acting on it.

   Overlays rather than reflows: ChatGPT's layout is a nest of flex containers
   and pushing it around is the kind of thing that breaks on their next deploy. */
(() => {
  const CP = window.__studyplug__;

  const WIDTH = 336;

  const CSS_TEXT = `
    :host { all: initial; }
    * { box-sizing: border-box; }

    :host {
      --paper: #fcfcfa;
      --paper-sunk: #f4f3ef;
      --ink: #1b1a16;
      --ink-soft: #565248;
      --ink-faint: #8d887c;
      --edge: rgba(27,26,22,.11);
      --edge-soft: rgba(27,26,22,.06);
      --focus: #3b6fd4;
      --sans: ui-sans-serif, "Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif;
      --serif: "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif;
      --mono: ui-monospace, "Cascadia Code", Consolas, monospace;
    }
    :host([data-theme="dark"]) {
      --paper: #191917;
      --paper-sunk: #201f1c;
      --ink: #f1efe8;
      --ink-soft: #a8a396;
      --ink-faint: #736e63;
      --edge: rgba(255,255,255,.12);
      --edge-soft: rgba(255,255,255,.06);
      --focus: #8fb7ff;
    }

    /* ---------- the edge handle ---------- */

    .handle {
      position: fixed;
      z-index: 2147483640;
      right: 0;
      top: 50%;
      transform: translateY(-50%);
      display: none;
      align-items: center;
      gap: 6px;
      padding: 11px 7px;
      border: 1px solid var(--edge);
      border-right: 0;
      border-radius: 9px 0 0 9px;
      background: var(--paper);
      color: var(--ink-soft);
      box-shadow: -3px 0 14px rgba(0,0,0,.13);
      cursor: pointer;
      font-family: var(--mono);
      font-size: 10px;
      letter-spacing: .1em;
      writing-mode: vertical-rl;
      transition: color .12s ease, padding .12s ease;
    }
    .handle[data-show="1"] { display: flex; }
    .handle:hover { color: var(--ink); padding-right: 10px; }
    .handle:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
    .handle b { font-weight: 600; font-variant-numeric: tabular-nums; }
    :host([data-open="1"]) .handle { display: none; }

    /* ---------- the panel ---------- */

    .panel {
      position: fixed;
      z-index: 2147483641;
      top: 0;
      right: 0;
      bottom: 0;
      width: ${WIDTH}px;
      display: flex;
      flex-direction: column;
      background: var(--paper);
      color: var(--ink);
      border-left: 1px solid var(--edge);
      box-shadow: -8px 0 32px rgba(0,0,0,.16);
      font-family: var(--sans);
      font-size: 13px;
      transform: translateX(100%);
      transition: transform .18s cubic-bezier(.4,0,.2,1);
    }
    :host([data-open="1"]) .panel { transform: translateX(0); }

    .head {
      padding: 13px 14px 11px;
      border-bottom: 1px solid var(--edge);
      flex: 0 0 auto;
    }
    .eyebrow {
      display: flex;
      align-items: center;
      gap: 8px;
      font-family: var(--mono);
      font-size: 10px;
      letter-spacing: .13em;
      text-transform: uppercase;
      color: var(--ink-faint);
    }
    .eyebrow .spacer { flex: 1; }
    .title {
      margin: 5px 0 0;
      font-family: var(--serif);
      font-size: 15px;
      font-weight: 400;
      line-height: 1.32;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .iconbtn {
      width: 24px;
      height: 24px;
      display: grid;
      place-items: center;
      border: 0;
      border-radius: 6px;
      background: transparent;
      color: var(--ink-faint);
      cursor: pointer;
    }
    .iconbtn:hover { background: var(--paper-sunk); color: var(--ink); }
    .iconbtn:focus-visible { outline: 2px solid var(--focus); outline-offset: 1px; }
    .iconbtn svg { width: 14px; height: 14px; }

    .body { flex: 1; overflow-y: auto; overscroll-behavior: contain; }

    /* ---------- colour group ---------- */

    .group { border-bottom: 1px solid var(--edge-soft); }

    .ghead {
      position: sticky;
      top: 0;
      z-index: 1;
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 9px 14px;
      background: var(--paper);
      color: var(--ink-soft);
      font-family: var(--mono);
      font-size: 10px;
      letter-spacing: .12em;
    }
    .ghead:hover { background: var(--paper-sunk); }

    /* The toggle and the rename control are siblings: a button cannot nest
       inside another button. */
    .gtoggle {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 1;
      min-width: 0;
      padding: 0;
      border: 0;
      background: transparent;
      color: inherit;
      font: inherit;
      letter-spacing: inherit;
      text-align: left;
      text-transform: uppercase;
      cursor: pointer;
    }
    .gtoggle:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
    .gtoggle .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    .ghead .chip {
      width: 11px;
      height: 11px;
      border-radius: 3px;
      background: var(--gc);
      flex: 0 0 auto;
    }
    .ghead .n { font-variant-numeric: tabular-nums; opacity: .8; }
    .ghead .caret { transition: transform .14s ease; opacity: .6; flex: 0 0 auto; }
    .group[data-collapsed="1"] .caret { transform: rotate(-90deg); }
    .group[data-collapsed="1"] .entries { display: none; }

    .grename {
      width: 20px;
      height: 20px;
      flex: 0 0 auto;
      display: none;
      place-items: center;
      padding: 0;
      border: 0;
      border-radius: 5px;
      background: transparent;
      color: var(--ink-faint);
      cursor: pointer;
    }
    .ghead:hover .grename,
    .ghead:focus-within .grename { display: grid; }
    .grename:hover { background: var(--edge); color: var(--ink); }
    .grename:focus-visible { outline: 2px solid var(--focus); outline-offset: 1px; }
    .grename svg { width: 11px; height: 11px; }

    /* Typing a category name: normal case and no tracking, because you are
       writing words here rather than reading a label. */
    .gname {
      flex: 1;
      min-width: 0;
      padding: 3px 6px;
      border: 1px solid var(--focus);
      border-radius: 5px;
      background: var(--paper);
      color: var(--ink);
      font-family: var(--mono);
      font-size: 11px;
      letter-spacing: 0;
      text-transform: none;
    }
    .gname:focus { outline: none; }

    /* ---------- entry ---------- */

    .entry {
      position: relative;
      border-top: 1px solid var(--edge-soft);
      padding-left: 3px;
      background: linear-gradient(to right, var(--gc) 0 3px, transparent 3px);
    }
    .entry:hover { background-color: var(--paper-sunk); }

    .summary {
      display: flex;
      gap: 9px;
      width: 100%;
      padding: 9px 12px 10px;
      border: 0;
      background: transparent;
      color: inherit;
      cursor: pointer;
      text-align: left;
      font: inherit;
    }
    .summary:focus-visible { outline: 2px solid var(--focus); outline-offset: -2px; }

    .idx {
      flex: 0 0 auto;
      min-width: 15px;
      padding-top: 1px;
      font-family: var(--mono);
      font-size: 10px;
      color: var(--ink-faint);
      font-variant-numeric: tabular-nums;
    }

    .snippet {
      flex: 1;
      min-width: 0;
      font-family: var(--serif);
      font-size: 13px;
      line-height: 1.46;
      color: var(--ink);
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .entry[data-open="1"] .snippet {
      display: block;
      -webkit-line-clamp: unset;
    }

    .who {
      display: block;
      margin-bottom: 3px;
      font-family: var(--mono);
      font-size: 9px;
      letter-spacing: .1em;
      text-transform: uppercase;
      color: var(--ink-faint);
    }

    .hasnote {
      flex: 0 0 auto;
      padding-top: 2px;
      color: var(--ink-faint);
    }
    .hasnote svg { width: 11px; height: 11px; display: block; }
    .entry[data-open="1"] .hasnote { display: none; }

    /* ---------- expanded detail ---------- */

    .detail { display: none; padding: 0 12px 11px 36px; }
    .entry[data-open="1"] .detail { display: block; }

    .noteshow {
      margin: 0 0 9px;
      padding: 7px 9px;
      border-left: 2px solid var(--gc);
      border-radius: 0 5px 5px 0;
      background: var(--paper-sunk);
      font-size: 12px;
      line-height: 1.45;
      color: var(--ink-soft);
      white-space: pre-wrap;
    }

    .acts { display: flex; flex-wrap: wrap; align-items: center; gap: 5px; }

    .act {
      height: 25px;
      padding: 0 9px;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      border: 1px solid var(--edge);
      border-radius: 6px;
      background: transparent;
      color: var(--ink);
      font-family: var(--sans);
      font-size: 11.5px;
      cursor: pointer;
      white-space: nowrap;
    }
    .act:hover { background: var(--paper-sunk); }
    .act:focus-visible { outline: 2px solid var(--focus); outline-offset: 1px; }
    .act svg { width: 12px; height: 12px; }
    .act[data-primary] { border-color: transparent; background: var(--gc); color: #1a1810; font-weight: 600; }
    .act[data-primary]:hover { filter: brightness(1.06); }
    .act[data-danger] { border-color: transparent; color: var(--ink-faint); margin-left: auto; }
    .act[data-danger]:hover { background: rgba(201,69,58,.13); color: #c9453a; }

    .recolor { display: flex; gap: 3px; margin-left: 2px; }
    .dot {
      width: 17px; height: 17px;
      padding: 0;
      border: 0;
      border-radius: 5px;
      background: transparent;
      cursor: pointer;
      display: grid;
      place-items: center;
    }
    .dot:hover { background: var(--paper-sunk); }
    .dot:focus-visible { outline: 2px solid var(--focus); outline-offset: 1px; }
    .dot i {
      width: 10px; height: 10px;
      border-radius: 50%;
      background: var(--d);
      box-shadow: inset 0 -2px 0 rgba(0,0,0,.15);
      opacity: .45;
    }
    .dot[aria-pressed="true"] i { opacity: 1; box-shadow: inset 0 -2px 0 rgba(0,0,0,.15), 0 0 0 1.5px var(--paper), 0 0 0 2.5px var(--d); }

    /* ---------- note editor ---------- */

    .noteedit { display: none; margin-top: 8px; }
    .entry[data-note="1"] .noteedit { display: block; }
    /* While editing, the editor holds the note — showing it twice reads as a
       bug rather than as context. */
    .entry[data-note="1"] .acts,
    .entry[data-note="1"] .noteshow { display: none; }

    .noteedit textarea {
      width: 100%;
      min-height: 62px;
      resize: vertical;
      padding: 7px 8px;
      border: 1px solid var(--edge);
      border-radius: 6px;
      background: var(--paper-sunk);
      color: var(--ink);
      font-family: var(--serif);
      font-size: 12.5px;
      line-height: 1.45;
    }
    .noteedit textarea:focus { outline: none; border-color: var(--focus); }
    .noteedit .row { display: flex; justify-content: flex-end; gap: 5px; margin-top: 6px; }

    /* ---------- empty ---------- */

    .empty { padding: 40px 26px; text-align: center; color: var(--ink-soft); }
    .empty strong {
      display: block;
      margin-bottom: 6px;
      font-family: var(--serif);
      font-size: 14.5px;
      font-weight: 400;
      color: var(--ink);
    }
    .empty p { margin: 0; font-size: 12.5px; line-height: 1.55; }

    /* ---------- selecting several at once ---------- */

    .tick {
      flex: 0 0 auto;
      width: 15px;
      height: 15px;
      margin-top: 1px;
      border: 1.5px solid var(--ink-faint);
      border-radius: 4px;
      display: none;
      place-items: center;
      color: transparent;
    }
    :host([data-selecting="1"]) .tick { display: grid; }
    .entry[data-picked="1"] .tick {
      background: var(--gc);
      border-color: var(--gc);
      color: #1a1810;
    }
    .tick svg { width: 10px; height: 10px; }
    .entry[data-picked="1"] { background-color: var(--paper-sunk); }

    /* In select mode the row is a target, not a disclosure. */
    :host([data-selecting="1"]) .detail { display: none; }

    .bulk {
      flex: 0 0 auto;
      display: none;
      align-items: center;
      flex-wrap: wrap;
      gap: 6px;
      padding: 9px 12px;
      border-top: 1px solid var(--edge);
      background: var(--paper);
    }
    :host([data-selecting="1"]) .bulk { display: flex; }
    /* The count takes its own line: the panel is 336px and the controls do not
       fit beside it without clipping the last one. */
    .bulk .count {
      flex: 1 0 100%;
      font-family: var(--mono);
      font-size: 10px;
      letter-spacing: .1em;
      text-transform: uppercase;
      color: var(--ink-faint);
    }
    .bulk .spacer { flex: 1; }
    .bulk .recolor { gap: 2px; }

    @media (prefers-reduced-motion: reduce) {
      .panel, .caret, .handle { transition: none; }
    }
  `;

  const ICONS = {
    close: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg>',
    tick:  '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 8.4l3 3 6-6.5"/></svg>',
    pick:  '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2.3" y="2.3" width="11.4" height="11.4" rx="2.4"/><path d="M5.2 8.2l2.1 2.1 3.6-4"/></svg>',
    library: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2.6 3.4h3.1v9.2H2.6zM6.9 3.4H10v9.2H6.9zM11.4 4l2.1 8.4"/></svg>',
    undo:  '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3.2 7.4h6.4a3.2 3.2 0 0 1 0 6.4H6.5M3.2 7.4l3-3M3.2 7.4l3 3"/></svg>',
    caret: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6.5l4 4 4-4"/></svg>',
    jump:  '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2.5v11M4 9.5l4 4 4-4"/></svg>',
    note:  '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11.2 1.8a1.7 1.7 0 0 1 2.4 2.4L5.5 12.3l-3.2.9.9-3.2z"/></svg>',
    pencil: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M11.2 1.8a1.7 1.7 0 0 1 2.4 2.4L5.5 12.3l-3.2.9.9-3.2z"/></svg>',
    copy:  '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="5.5" y="5.5" width="8" height="8" rx="1.6"/><path d="M10.5 3.2A1.7 1.7 0 0 0 8.9 2H3.6A1.6 1.6 0 0 0 2 3.6v5.3c0 .8.5 1.4 1.2 1.6"/></svg>',
    trash: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2.8 4.3h10.4M6.4 4.3V3a1 1 0 0 1 1-1h1.2a1 1 0 0 1 1 1v1.3M4.2 4.3l.5 8.2a1.2 1.2 0 0 0 1.2 1.1h4.2a1.2 1.2 0 0 0 1.2-1.1l.5-8.2"/></svg>'
  };

  const panel = (CP.panel = {});
  let host, root, shell, bodyEl, titleEl, countEl, handleEl, handleCount;
  let undoBtn, pickBtn, bulkEl, bulkCount;
  let api = null;
  let open = false;
  const expanded = new Set();     // entry ids currently opened
  const collapsed = new Set();    // colour groups the user folded away
  let editing = null;             // id of the entry whose note is being edited
  let renaming = null;            // colour key whose category name is being typed
  let selecting = false;          // multi-select mode
  const picked = new Set();       // entry ids ticked while selecting

  const hexOf = (key) => CP.PALETTE.hexOf(key);
  const labelOf = (key) => CP.PALETTE.labelOf(key);

  const syncTheme = () => {
    const cl = document.documentElement.classList;
    const dark = cl.contains('dark') ||
      (!cl.contains('light') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    host.setAttribute('data-theme', dark ? 'dark' : 'light');
  };

  const mkIcon = (cls, title, svg, onClick) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = cls;
    b.title = title;
    b.setAttribute('aria-label', title);
    b.innerHTML = svg;
    b.addEventListener('click', onClick);
    return b;
  };

  const mkAct = (label, svg, onClick, flag) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'act';
    if (flag) b.dataset[flag] = '1';
    b.innerHTML = svg ? svg + '<span></span>' : '<span></span>';
    b.querySelector('span').textContent = label;
    b.addEventListener('click', onClick);
    return b;
  };

  const renderEntry = (h, index) => {
    const wrap = document.createElement('div');
    wrap.className = 'entry';
    wrap.style.setProperty('--gc', hexOf(h.color));
    if (expanded.has(h.id)) wrap.dataset.open = '1';
    if (editing === h.id) wrap.dataset.note = '1';

    /* Summary — click to open the passage in full. */
    if (picked.has(h.id)) wrap.dataset.picked = '1';

    const sum = document.createElement('button');
    sum.type = 'button';
    sum.className = 'summary';
    sum.setAttribute('aria-expanded', String(expanded.has(h.id)));
    if (selecting) {
      sum.removeAttribute('aria-expanded');
      sum.setAttribute('aria-pressed', String(picked.has(h.id)));
    }

    const tick = document.createElement('span');
    tick.className = 'tick';
    tick.innerHTML = ICONS.tick;
    sum.append(tick);

    const idx = document.createElement('span');
    idx.className = 'idx';
    idx.textContent = index;

    const snip = document.createElement('span');
    snip.className = 'snippet';
    const who = document.createElement('span');
    who.className = 'who';
    who.textContent = h.role === 'user' ? 'You' : 'ChatGPT';
    snip.append(who, document.createTextNode(h.text));

    sum.append(idx, snip);

    if (h.note) {
      const flag = document.createElement('span');
      flag.className = 'hasnote';
      flag.title = 'Has a note';
      flag.innerHTML = ICONS.note;
      sum.appendChild(flag);
    }

    sum.addEventListener('click', () => {
      if (selecting) {
        if (picked.has(h.id)) picked.delete(h.id);
        else picked.add(h.id);
        panel.refresh();
        return;
      }
      if (expanded.has(h.id)) expanded.delete(h.id);
      else expanded.add(h.id);
      if (editing === h.id) editing = null;
      panel.refresh();
    });

    /* Hovering an entry marks the passage in the page, so the list and the
       conversation stay connected without having to jump. */
    wrap.addEventListener('mouseenter', () => api?.peek(h.id, true));
    wrap.addEventListener('mouseleave', () => api?.peek(h.id, false));

    /* Detail — the whole passage, its note, and what you can do with it. */
    const detail = document.createElement('div');
    detail.className = 'detail';

    if (h.note) {
      const n = document.createElement('p');
      n.className = 'noteshow';
      n.textContent = h.note;
      detail.appendChild(n);
    }

    const acts = document.createElement('div');
    acts.className = 'acts';
    acts.append(
      mkAct('Go to text', ICONS.jump, () => api.jump(h.id), 'primary'),
      mkAct(h.note ? 'Edit note' : 'Add note', ICONS.note, () => {
        editing = h.id;
        panel.refresh();
        root.querySelector(`[data-entry="${h.id}"] textarea`)?.focus();
      }),
      mkAct('Copy', ICONS.copy, () => api.copy(h.note ? `${h.text}\n\n— ${h.note}` : h.text))
    );

    const recolor = document.createElement('div');
    recolor.className = 'recolor';
    for (const c of CP.COLORS) {
      const d = document.createElement('button');
      d.type = 'button';
      d.className = 'dot';
      d.style.setProperty('--d', c.hex);
      d.title = `Move to ${c.label}`;
      d.setAttribute('aria-label', d.title);
      d.setAttribute('aria-pressed', String(c.key === h.color));
      d.innerHTML = '<i></i>';
      d.addEventListener('click', () => api.setColor(h.id, c.key));
      recolor.appendChild(d);
    }
    acts.appendChild(recolor);
    acts.appendChild(mkAct('Remove', ICONS.trash, () => {
      expanded.delete(h.id);
      api.remove(h.id);
    }, 'danger'));

    detail.appendChild(acts);

    /* Note editor */
    const ed = document.createElement('div');
    ed.className = 'noteedit';
    const ta = document.createElement('textarea');
    ta.value = h.note || '';
    ta.placeholder = 'Note on this passage...';
    ta.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save();
      if (e.key === 'Escape') { editing = null; panel.refresh(); }
    });
    const row = document.createElement('div');
    row.className = 'row';
    const save = () => { editing = null; api.setNote(h.id, ta.value.trim()); };
    row.append(
      mkAct('Cancel', null, () => { editing = null; panel.refresh(); }),
      mkAct('Save note', null, save, 'primary')
    );
    ed.append(ta, row);
    detail.appendChild(ed);

    wrap.dataset.entry = h.id;
    wrap.append(sum, detail);
    return wrap;
  };

  /* An empty field means "use the colour's own name", so the current custom
     name is the value and the default is only the placeholder. */
  const renameField = (colorKey) => {
    const input = document.createElement('input');
    input.className = 'gname';
    input.type = 'text';
    input.value = CP.PALETTE.isRenamed(colorKey) ? labelOf(colorKey) : '';
    input.placeholder = CP.PALETTE.defaultLabelOf(colorKey);
    input.maxLength = CP.PALETTE.MAX_LABEL;
    input.setAttribute('aria-label', 'Category name');

    let done = false;
    const commit = async () => {
      if (done) return;
      done = true;
      renaming = null;
      await CP.PALETTE.setLabel(colorKey, input.value);
      panel.refresh();
    };

    input.addEventListener('keydown', (e) => {
      e.stopPropagation(); // Alt+1..5 and Esc belong to the page, not to typing
      if (e.key === 'Enter') { e.preventDefault(); commit(); }
      if (e.key === 'Escape') {
        e.preventDefault();
        done = true;
        renaming = null;
        panel.refresh();
      }
    });
    /* Clicking away saves, but focus leaving because the *page* grabbed it must
       not: that would store half a word, or wipe the name with an empty one.
       In that case leave the field open, still holding what was typed. */
    input.addEventListener('blur', (e) => {
      const next = e.relatedTarget;
      if (next && !root.contains(next)) return; // root.contains sees our shadow tree
      commit();
    });

    /* The field is created during a render, so focus after it is in the DOM. */
    queueMicrotask(() => { input.focus(); input.select(); });
    return input;
  };

  const renderGroup = (colorKey, items) => {
    const g = document.createElement('section');
    g.className = 'group';
    g.style.setProperty('--gc', hexOf(colorKey));
    if (collapsed.has(colorKey)) g.dataset.collapsed = '1';

    const head = document.createElement('div');
    head.className = 'ghead';

    const count = document.createElement('span');
    count.className = 'n';
    count.textContent = items.length;

    /* Renaming happens in place, on the name you are already looking at,
       rather than behind a settings screen. */
    if (renaming === colorKey) {
      /* Keep the chip: you need to see which colour you are naming. */
      const chip = document.createElement('span');
      chip.className = 'chip';
      head.append(chip, renameField(colorKey), count);
    } else {
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'gtoggle';
      toggle.setAttribute('aria-expanded', String(!collapsed.has(colorKey)));

      const caret = document.createElement('span');
      caret.className = 'caret';
      caret.innerHTML = ICONS.caret;
      const chip = document.createElement('span');
      chip.className = 'chip';
      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = labelOf(colorKey);

      toggle.append(caret, chip, name);
      toggle.addEventListener('click', () => {
        if (collapsed.has(colorKey)) collapsed.delete(colorKey);
        else collapsed.add(colorKey);
        panel.refresh();
      });

      const rename = mkIcon('grename', `Rename ${labelOf(colorKey)}`, ICONS.pencil, () => {
        renaming = colorKey;
        panel.refresh();
      });

      head.append(toggle, rename, count);
    }

    const entries = document.createElement('div');
    entries.className = 'entries';
    items.forEach((h, i) => entries.appendChild(renderEntry(h, i + 1)));

    g.append(head, entries);
    return g;
  };

  const build = () => {
    if (host) return;
    host = document.createElement('div');
    host.setAttribute('data-cp-ui', 'panel');
    root = host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = CSS_TEXT;

    handleEl = document.createElement('button');
    handleEl.type = 'button';
    handleEl.className = 'handle';
    handleEl.title = 'Show highlights (Alt+H)';
    handleEl.innerHTML = '<span>Highlights</span> <b></b>';
    handleCount = handleEl.querySelector('b');
    handleEl.addEventListener('click', () => panel.setOpen(true));

    shell = document.createElement('aside');
    shell.className = 'panel';
    shell.setAttribute('aria-label', 'Highlights in this conversation');

    const head = document.createElement('div');
    head.className = 'head';
    const eyebrow = document.createElement('div');
    eyebrow.className = 'eyebrow';
    const label = document.createElement('span');
    label.textContent = 'Highlights';
    countEl = document.createElement('span');
    const spacer = document.createElement('span');
    spacer.className = 'spacer';
    pickBtn = mkIcon('iconbtn', 'Select several', ICONS.pick, () => panel.setSelecting(!selecting));

    const libraryBtn = mkIcon('iconbtn', 'Everything you have marked, across all chats',
      ICONS.library, () => api?.openLibrary?.());

    undoBtn = mkIcon('iconbtn', 'Undo (Ctrl+Z)', ICONS.undo, () => api?.undo?.());
    undoBtn.hidden = true;

    eyebrow.append(label, countEl, spacer, pickBtn, libraryBtn, undoBtn,
      mkIcon('iconbtn', 'Close (Alt+H)', ICONS.close, () => panel.setOpen(false)));

    titleEl = document.createElement('h2');
    titleEl.className = 'title';
    head.append(eyebrow, titleEl);

    bodyEl = document.createElement('div');
    bodyEl.className = 'body';

    /* Acts on everything ticked, so it sits where the ticks are. */
    bulkEl = document.createElement('div');
    bulkEl.className = 'bulk';

    bulkCount = document.createElement('span');
    bulkCount.className = 'count';

    const bulkSpacer = document.createElement('span');
    bulkSpacer.className = 'spacer';

    const bulkInks = document.createElement('div');
    bulkInks.className = 'recolor';
    for (const c of CP.COLORS) {
      const d = document.createElement('button');
      d.type = 'button';
      d.className = 'dot';
      d.style.setProperty('--d', c.hex);
      d.title = `Move ${c.label}`;
      d.setAttribute('aria-label', d.title);
      d.innerHTML = '<i></i>';
      d.addEventListener('click', () => {
        if (!picked.size) return;
        api?.setColorMany?.([...picked], c.key);
        panel.setSelecting(false);
      });
      bulkInks.append(d);
    }

    bulkEl.append(
      bulkCount,
      bulkSpacer,
      bulkInks,
      mkAct('Copy', ICONS.copy, () => {
        api?.copyMany?.([...picked]);
        panel.setSelecting(false);
      }),
      mkAct('Remove', ICONS.trash, () => {
        if (!picked.size) return;
        api?.removeMany?.([...picked]);
        panel.setSelecting(false);
      }, 'danger'),
      mkAct('Done', null, () => panel.setSelecting(false))
    );

    shell.append(head, bodyEl, bulkEl);
    root.append(style, handleEl, shell);
    document.body.appendChild(host);
    wireKeys();
    syncTheme();
  };

  /* Keyboard work happens inside the panel only, so reading the conversation
     is never interrupted by a stray keystroke. Moving the cursor moves real
     focus, which keeps the focus ring and screen readers in step for free. */
  const wireKeys = () => {
    shell.addEventListener('keydown', (e) => {
      const target = e.target;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const rows = [...root.querySelectorAll('.summary')];
      if (!rows.length) return;

      const here = root.activeElement?.closest?.('.summary');
      const at = here ? rows.indexOf(here) : -1;
      const focusAt = (i) => {
        const next = rows[Math.max(0, Math.min(rows.length - 1, i))];
        next?.focus();
        next?.scrollIntoView({ block: 'nearest' });
      };

      switch (e.key) {
        case 'j': case 'ArrowDown':
          e.preventDefault(); focusAt(at + 1); break;
        case 'k': case 'ArrowUp':
          e.preventDefault(); focusAt(at <= 0 ? 0 : at - 1); break;
        case 'g': {
          const id = here?.closest('[data-entry]')?.dataset.entry;
          if (id) { e.preventDefault(); api?.jump?.(id); }
          break;
        }
        case 'x': {
          const id = here?.closest('[data-entry]')?.dataset.entry;
          if (!id) break;
          e.preventDefault();
          if (!selecting) { selecting = true; host.setAttribute('data-selecting', '1'); }
          if (picked.has(id)) picked.delete(id); else picked.add(id);
          panel.refresh();
          /* The list was rebuilt; put the cursor back where it was. */
          [...root.querySelectorAll('.summary')][at]?.focus();
          break;
        }
        case 'Escape':
          if (selecting) { e.preventDefault(); panel.setSelecting(false); }
          break;
        default:
          break;
      }
    });
  };

  panel.setSelecting = (on) => {
    selecting = !!on;
    picked.clear();
    host.setAttribute('data-selecting', selecting ? '1' : '');
    if (selecting) expanded.clear();
    panel.refresh();
  };

  panel.init = (a) => {
    api = a;
    build();
    panel.refresh();
  };

  panel.syncTheme = () => { if (host) syncTheme(); };

  panel.setOpen = (next) => {
    build();
    open = next;
    host.setAttribute('data-open', open ? '1' : '');
    if (open) panel.refresh();
    try {
      chrome.storage.local.set({ 'cp:panelOpen': open });
    } catch { /* storage can be unavailable if the extension reloaded */ }
  };

  panel.toggle = () => panel.setOpen(!open);
  panel.isOpen = () => open;
  panel.contains = (node) => !!host && (host === node || host.contains(node));

  panel.refresh = () => {
    if (!host || !api) return;
    syncTheme();

    const items = api.items();
    titleEl.textContent = api.title();
    titleEl.title = api.title();
    /* Only offered when there is actually something to take back. */
    undoBtn.hidden = !api.canUndo?.();
    pickBtn.hidden = !items.length;
    pickBtn.setAttribute('aria-pressed', String(selecting));
    bulkCount.textContent = picked.size
      ? `${picked.size} selected`
      : 'Tick the ones to act on';
    countEl.textContent = items.length ? String(items.length) : '';
    handleCount.textContent = items.length ? String(items.length) : '';
    handleEl.dataset.show = items.length ? '1' : '';

    const keepScroll = bodyEl.scrollTop;
    bodyEl.innerHTML = '';

    if (!items.length) {
      const box = document.createElement('div');
      box.className = 'empty';
      const s = document.createElement('strong');
      s.textContent = 'Nothing marked yet';
      const p = document.createElement('p');
      p.textContent = 'Select text in any message, then pick a colour. Marks show up here grouped by colour, in the order they appear in the chat.';
      box.append(s, p);
      bodyEl.appendChild(box);
      return;
    }

    /* Group in palette order so the sections do not reshuffle as marks are
       added, and order within a group by position in the conversation. */
    for (const c of CP.COLORS) {
      const mine = CP.inReadingOrder(items.filter((h) => h.color === c.key));
      if (mine.length) bodyEl.appendChild(renderGroup(c.key, mine));
    }
    bodyEl.scrollTop = keepScroll;
  };

  /* Restore the last open/closed state for this browser. */
  panel.restoreState = () => {
    try {
      chrome.storage.local.get('cp:panelOpen', (v) => {
        if (v && v['cp:panelOpen']) panel.setOpen(true);
      });
    } catch { /* ignore */ }
  };
})();
