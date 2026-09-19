/* StudyPlug — the floating toolbar.

   Lives in a shadow root so ChatGPT's stylesheet cannot reach it and ours
   cannot leak out. Reads as a graphite instrument resting on the page: the
   inks are the only colour, everything else stays quiet. */
(() => {
  const CP = window.__studyplug__;

  const CSS_TEXT = `
    :host { all: initial; }
    * { box-sizing: border-box; }

    .tray {
      position: fixed;
      z-index: 2147483646;
      top: -9999px;
      transform: translateX(-50%);
      display: flex;
      align-items: center;
      gap: 2px;
      padding: 5px 6px;
      border-radius: 11px;
      background: #23211a;
      border: 1px solid rgba(255,255,255,.09);
      box-shadow: 0 8px 28px rgba(0,0,0,.30), 0 2px 6px rgba(0,0,0,.22);
      font-family: ui-sans-serif, "Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif;
      opacity: 0;
      transition: opacity .09s ease;
    }
    :host([data-theme="dark"]) .tray {
      background: #2b2925;
      border-color: rgba(255,255,255,.14);
    }
    .tray[data-open="1"] { opacity: 1; }

    /* The notch is what makes the tray feel attached to the text. */
    .tray::after {
      content: "";
      position: absolute;
      left: 50%;
      width: 9px;
      height: 9px;
      background: inherit;
      border: inherit;
      transform: translateX(-50%) rotate(45deg);
    }
    .tray[data-side="top"]::after { bottom: -5px; border-top: 0; border-left: 0; }
    .tray[data-side="bottom"]::after { top: -5px; border-bottom: 0; border-right: 0; }

    .inks, .acts { display: flex; align-items: center; gap: 2px; }

    .ink {
      width: 22px;
      height: 22px;
      padding: 0;
      border: 0;
      border-radius: 7px;
      background: transparent;
      cursor: pointer;
      display: grid;
      place-items: center;
      transition: background .1s ease;
    }
    .ink:hover { background: rgba(255,255,255,.10); }
    .ink:focus-visible { outline: 2px solid #8fb7ff; outline-offset: 1px; }
    .ink i {
      display: block;
      width: 13px;
      height: 13px;
      border-radius: 50%;
      background: var(--ink);
      box-shadow: inset 0 -3px 0 rgba(0,0,0,.16);
    }
    .ink[aria-pressed="true"] i {
      box-shadow: inset 0 -3px 0 rgba(0,0,0,.16), 0 0 0 2px #23211a, 0 0 0 3.5px var(--ink);
    }
    :host([data-theme="dark"]) .ink[aria-pressed="true"] i {
      box-shadow: inset 0 -3px 0 rgba(0,0,0,.16), 0 0 0 2px #2b2925, 0 0 0 3.5px var(--ink);
    }

    .rule { width: 1px; height: 17px; margin: 0 4px; background: rgba(255,255,255,.15); }

    .act {
      height: 22px;
      min-width: 22px;
      padding: 0 5px;
      border: 0;
      border-radius: 7px;
      background: transparent;
      color: rgba(255,255,255,.72);
      cursor: pointer;
      display: grid;
      place-items: center;
      transition: background .1s ease, color .1s ease;
    }
    .act:hover { background: rgba(255,255,255,.10); color: #fff; }
    .act:focus-visible { outline: 2px solid #8fb7ff; outline-offset: 1px; }
    .act svg { width: 14px; height: 14px; display: block; }
    .act[data-danger]:hover { background: rgba(255,120,110,.18); color: #ffb3ad; }

    /* Note editor swaps in place of the ink row. */
    .note { display: none; flex-direction: column; gap: 6px; width: 252px; padding: 2px; }
    .tray[data-mode="note"] .inks,
    .tray[data-mode="note"] .rule,
    .tray[data-mode="note"] .acts { display: none; }
    .tray[data-mode="note"] .note { display: flex; }

    .note textarea {
      width: 100%;
      min-height: 58px;
      resize: vertical;
      padding: 7px 8px;
      border-radius: 7px;
      border: 1px solid rgba(255,255,255,.14);
      background: rgba(0,0,0,.28);
      color: #f4f2ec;
      font-family: "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif;
      font-size: 13px;
      line-height: 1.45;
    }
    .note textarea:focus { outline: none; border-color: rgba(255,255,255,.32); }
    .note textarea::placeholder { color: rgba(255,255,255,.34); }
    .note .row { display: flex; justify-content: flex-end; gap: 6px; }
    .note button {
      height: 25px;
      padding: 0 11px;
      border-radius: 7px;
      border: 1px solid rgba(255,255,255,.14);
      background: transparent;
      color: rgba(255,255,255,.78);
      font-family: inherit;
      font-size: 12px;
      cursor: pointer;
    }
    .note button:hover { background: rgba(255,255,255,.09); color: #fff; }
    .note button[data-primary] {
      background: #f5c518;
      border-color: #f5c518;
      color: #23211a;
      font-weight: 600;
    }
    .note button[data-primary]:hover { background: #ffd633; }

    .toast {
      position: fixed;
      z-index: 2147483647;
      left: 50%;
      bottom: 92px;
      transform: translateX(-50%) translateY(6px);
      padding: 7px 13px;
      border-radius: 9px;
      background: #23211a;
      color: #f4f2ec;
      border: 1px solid rgba(255,255,255,.12);
      box-shadow: 0 8px 24px rgba(0,0,0,.28);
      font-family: ui-monospace, "Cascadia Code", Consolas, monospace;
      font-size: 11px;
      letter-spacing: .04em;
      text-transform: uppercase;
      opacity: 0;
      pointer-events: none;
      transition: opacity .14s ease, transform .14s ease;
    }
    .toast[data-open="1"] { opacity: 1; transform: translateX(-50%) translateY(0); }
    .toast .msg { opacity: .82; }

    /* The toast itself ignores the pointer; only its action takes clicks. */
    .toast-action {
      pointer-events: auto;
      margin-left: 10px;
      padding: 2px 7px;
      border: 0;
      border-radius: 5px;
      background: rgba(245,197,24,.16);
      color: #f5c518;
      font-family: inherit;
      font-size: inherit;
      letter-spacing: inherit;
      text-transform: inherit;
      font-weight: 600;
      cursor: pointer;
    }
    .toast-action:hover { background: rgba(245,197,24,.28); }
    .toast-action:focus-visible { outline: 2px solid #8fb7ff; outline-offset: 1px; }

    @media (prefers-reduced-motion: reduce) {
      .tray, .toast { transition: none; }
    }
  `;

  const ICONS = {
    note: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11.2 1.8a1.7 1.7 0 0 1 2.4 2.4L5.5 12.3l-3.2.9.9-3.2z"/></svg>',
    copy: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="5.5" y="5.5" width="8" height="8" rx="1.6"/><path d="M10.5 3.2A1.7 1.7 0 0 0 8.9 2H3.6A1.6 1.6 0 0 0 2 3.6v5.3c0 .8.5 1.4 1.2 1.6"/></svg>',
    trash: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2.8 4.3h10.4M6.4 4.3V3a1 1 0 0 1 1-1h1.2a1 1 0 0 1 1 1v1.3M4.2 4.3l.5 8.2a1.2 1.2 0 0 0 1.2 1.1h4.2a1.2 1.2 0 0 0 1.2-1.1l.5-8.2"/></svg>'
  };

  const ui = (CP.ui = {});
  let host, root, tray, noteArea, toastEl, toastTimer;
  let ctx = null; // { mode: 'new' | 'edit', rect, payload, handlers }

  const syncTheme = () => {
    const cl = document.documentElement.classList;
    const dark = cl.contains('dark') ||
      (!cl.contains('light') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    host.setAttribute('data-theme', dark ? 'dark' : 'light');
  };

  /* Below the selection by default. ChatGPT puts its own "Ask ChatGPT" bubble
     above a selection, so sitting above would collide with it. Only flip up
     when there is genuinely no room below. */
  const place = (rect) => {
    const GAP = 10;
    const w = tray.offsetWidth || 190;
    const h = tray.offsetHeight || 34;

    let left = rect.left + rect.width / 2;
    left = Math.max(w / 2 + 8, Math.min(window.innerWidth - w / 2 - 8, left));

    let top = rect.bottom + GAP;
    let side = 'bottom';
    if (top + h > window.innerHeight - 8) {
      const above = rect.top - h - GAP;
      if (above >= 8) {
        top = above;
        side = 'top';
      } else {
        /* Nowhere clear: pin inside the viewport rather than off-screen. */
        top = Math.max(8, window.innerHeight - h - 8);
      }
    }
    tray.dataset.side = side;
    tray.style.left = left + 'px';
    tray.style.top = top + 'px';
  };

  const openNote = () => {
    tray.dataset.mode = 'note';
    noteArea.value = ctx?.payload?.note || '';
    place(ctx.rect);
    noteArea.focus();
  };

  const build = () => {
    if (host) return;
    host = document.createElement('div');
    host.setAttribute('data-cp-ui', 'toolbar');
    root = host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = CSS_TEXT;

    tray = document.createElement('div');
    tray.className = 'tray';
    tray.setAttribute('role', 'toolbar');
    tray.setAttribute('aria-label', 'Highlight');

    const inks = document.createElement('div');
    inks.className = 'inks';
    for (const c of CP.COLORS) {
      const b = document.createElement('button');
      b.className = 'ink';
      b.type = 'button';
      b.dataset.color = c.key;
      b.title = c.label;
      b.setAttribute('aria-label', c.label);
      b.style.setProperty('--ink', c.hex);
      b.innerHTML = '<i></i>';
      b.addEventListener('mousedown', (e) => e.preventDefault());
      b.addEventListener('click', () => ctx?.handlers.onColor?.(c.key));
      inks.appendChild(b);
    }

    const rule = document.createElement('div');
    rule.className = 'rule';

    const mkAct = (name, title, html, danger) => {
      const b = document.createElement('button');
      b.className = 'act';
      b.type = 'button';
      b.dataset.act = name;
      b.title = title;
      b.setAttribute('aria-label', title);
      b.innerHTML = html;
      if (danger) b.dataset.danger = '1';
      b.addEventListener('mousedown', (e) => e.preventDefault());
      return b;
    };

    const acts = document.createElement('div');
    acts.className = 'acts';
    const bNote = mkAct('note', 'Add note', ICONS.note);
    const bCopy = mkAct('copy', 'Copy text', ICONS.copy);
    const bDel = mkAct('remove', 'Remove highlight', ICONS.trash, true);
    bNote.addEventListener('click', () => openNote());
    bCopy.addEventListener('click', () => ctx?.handlers.onCopy?.());
    bDel.addEventListener('click', () => ctx?.handlers.onRemove?.());
    acts.append(bNote, bCopy, bDel);

    const note = document.createElement('div');
    note.className = 'note';
    noteArea = document.createElement('textarea');
    noteArea.placeholder = 'Note on this passage...';
    noteArea.rows = 3;

    const row = document.createElement('div');
    row.className = 'row';
    const bCancel = document.createElement('button');
    bCancel.type = 'button';
    bCancel.textContent = 'Cancel';
    bCancel.addEventListener('click', () => { tray.dataset.mode = 'inks'; place(ctx.rect); });
    const bSave = document.createElement('button');
    bSave.type = 'button';
    bSave.dataset.primary = '1';
    bSave.textContent = 'Save note';
    bSave.addEventListener('click', () => ctx?.handlers.onNote?.(noteArea.value.trim()));
    row.append(bCancel, bSave);

    noteArea.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) ctx?.handlers.onNote?.(noteArea.value.trim());
      if (e.key === 'Escape') { tray.dataset.mode = 'inks'; place(ctx.rect); }
    });
    note.append(noteArea, row);

    tray.append(inks, rule, acts, note);

    toastEl = document.createElement('div');
    toastEl.className = 'toast';

    root.append(style, tray, toastEl);
    document.body.appendChild(host);
    syncTheme();
  };

  ui.syncTheme = () => { if (host) syncTheme(); };

  /* mode: 'new' (from a selection) or 'edit' (clicked an existing mark) */
  ui.open = ({ mode, rect, payload, handlers }) => {
    build();
    syncTheme();
    ctx = { mode, rect, payload, handlers };
    tray.dataset.mode = 'inks';
    tray.dataset.open = '1';

    /* Names are re-read on every open: a category renamed in the panel has to
       show up in the tray's tooltips too, and the buttons are built once. */
    root.querySelectorAll('.ink').forEach((b) => {
      const label = CP.PALETTE.labelOf(b.dataset.color);
      b.title = label;
      b.setAttribute('aria-label', label);
      b.setAttribute('aria-pressed', String(mode === 'edit' && b.dataset.color === payload?.color));
    });
    const editOnly = mode === 'edit' ? '' : 'none';
    root.querySelector('[data-act="remove"]').style.display = editOnly;
    root.querySelector('[data-act="note"]').style.display = editOnly;

    place(rect);
  };

  ui.reposition = (rect) => {
    if (!ctx) return;
    ctx.rect = rect;
    place(rect);
  };

  ui.close = () => {
    if (!tray) return;
    tray.dataset.open = '';
    tray.dataset.mode = 'inks';
    tray.style.top = '-9999px';
    ctx = null;
  };

  ui.isOpen = () => !!ctx;
  ui.mode = () => ctx?.mode || null;
  ui.payload = () => ctx?.payload || null;
  ui.contains = (node) => !!host && (host === node || host.contains(node));

  /* action: { label, onAction } turns the toast into the undo affordance.
     It stays up longer, because a message you might act on needs reaching. */
  ui.toast = (msg, action) => {
    build();
    toastEl.textContent = '';

    const text = document.createElement('span');
    text.className = 'msg';
    text.textContent = msg;
    toastEl.append(text);

    if (action?.label && action.onAction) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'toast-action';
      b.textContent = action.label;
      b.addEventListener('click', () => {
        toastEl.dataset.open = '';
        action.onAction();
      });
      toastEl.append(b);
    }

    toastEl.dataset.open = '1';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.dataset.open = ''; }, action ? 6000 : 1600);
  };
})();
