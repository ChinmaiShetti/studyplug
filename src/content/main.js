/* ChatPlug — wiring.

   Owns the in-page state, listens for selections and clicks, keeps the
   painted DOM in step with storage, and answers the popup. */
(() => {
  const CP = window.__chatplug__;
  if (window.__chatplugLoaded) return;
  window.__chatplugLoaded = true;

  let convId = null;
  let record = null;
  let lastHref = location.href;

  /* ---------- state ---------- */

  const boot = async () => {
    await CP.PALETTE.refresh(); // custom category names, before anything renders
    convId = CP.conversationId();
    record = convId ? await CP.loadConversation(convId) : null;
    restoreAll();
    CP.panel.refresh();
  };

  const restoreAll = () => {
    if (!record?.items?.length) return;
    let moved = false;
    for (const h of record.items) {
      if (CP.isPainted(h.id)) continue;
      if (CP.paint(h) === 'moved') moved = true;
    }
    if (moved) persist(); // a turn shifted; write the corrected offsets back
  };

  const persist = async () => {
    await CP.saveConversation(record);
    CP.panel.refresh();
  };

  const byId = (id) => record?.items.find((h) => h.id === id) || null;

  /* Scroll a passage into view and flash it, so the eye lands on the right
     words rather than somewhere in the middle of the turn. */
  const jumpTo = (id) => {
    const marks = CP.marksFor(id);
    if (!marks.length) return false;
    marks[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
    marks.forEach((m) => {
      m.classList.remove('cp-flash');
      void m.offsetWidth; // restart the animation if it is already running
      m.classList.add('cp-flash');
      setTimeout(() => m.classList.remove('cp-flash'), 1200);
    });
    return true;
  };

  /* Hovering a list entry outlines the passage in the page. */
  const peek = (id, on) => {
    CP.marksFor(id).forEach((m) => m.classList.toggle('cp-peek', !!on));
  };

  /* ---------- undo ---------- */

  const undoer = CP.createUndo();
  const pushUndo = (entry) => undoer.push(entry);
  const snapshot = (h) => ({ ...h });

  const undo = async () => {
    if (!record) return;
    const result = undoer.undo(record.items, {
      onUnpaint: (id) => CP.unpaint(id),
      onPaint: (h) => CP.paint(h),
      onSet: (h) => CP.recolor(h.id, h.color, h.note)
    });
    if (!result) {
      CP.ui.toast('Nothing to undo');
      return;
    }

    record.items = result.items;
    await persist();
    CP.ui.close();
    CP.ui.toast(
      result.unpainted ? `${result.label} · ${result.unpainted} not on screen` : result.label
    );
  };

  /* ---------- mutating actions ---------- */

  /* Re-marking a passage replaces whatever ink was already on it, rather
     than nesting one mark inside another. Returns what it displaced so the
     caller can make the replacement undoable. */
  const dropOverlapping = (msgId, start, end) => {
    const doomed = record.items.filter(
      (h) => h.msgId === msgId && h.start < end && h.end > start
    );
    for (const h of doomed) CP.unpaint(h.id);
    if (doomed.length) {
      const ids = new Set(doomed.map((h) => h.id));
      record.items = record.items.filter((h) => !ids.has(h.id));
    }
    return doomed.map(snapshot);
  };

  const addFromSelection = async (color) => {
    const sel = window.getSelection();
    const desc = CP.describeSelection(sel);
    if (!desc) return false;
    if (!convId) {
      convId = CP.conversationId();
      if (!convId) {
        CP.ui.toast('Send a message first');
        return false;
      }
      record = await CP.loadConversation(convId);
    }

    const displaced = dropOverlapping(desc.msgId, desc.start, desc.end);

    const h = { id: CP.uid(), ...desc, color, note: '', ts: Date.now() };
    record.items.push(h);
    if (!CP.paint(h)) {
      record.items.pop();
      /* Put back whatever the failed attempt displaced. */
      for (const old of displaced) {
        record.items.push(old);
        CP.paint(old);
      }
      CP.ui.toast('Could not place highlight');
      return false;
    }

    /* Only a replacement is worth undoing — a plain new highlight is undone
       by removing it, which the trash icon already does. */
    if (displaced.length) {
      pushUndo({
        undoLabel: 'Replacement undone',
        restore: displaced,
        remove: [h.id]
      });
    }

    await persist();
    sel.removeAllRanges();
    CP.ui.close();
    return true;
  };

  const setColor = async (id, color, recordUndo = true) => {
    const h = byId(id);
    if (!h || h.color === color) return;
    if (recordUndo) {
      pushUndo({ undoLabel: 'Colour restored', set: [{ id, color: h.color }] });
    }
    h.color = color;
    CP.recolor(id, color, h.note);
    await persist();
  };

  const setNote = async (id, note, recordUndo = true) => {
    const h = byId(id);
    if (!h || h.note === note) return;
    if (recordUndo) {
      pushUndo({ undoLabel: 'Note restored', set: [{ id, note: h.note }] });
    }
    h.note = note;
    CP.recolor(id, h.color, note);
    await persist();
    CP.ui.close();
    CP.ui.toast(note ? 'Note saved' : 'Note cleared');
  };

  const removeOne = async (id) => {
    if (!record) return;
    const gone = byId(id);
    if (!gone) return;
    pushUndo({ undoLabel: 'Highlight restored', restore: [snapshot(gone)] });

    CP.unpaint(id);
    record.items = record.items.filter((h) => h.id !== id);
    await persist();
    CP.ui.close();
    CP.ui.toast('Highlight removed', { label: 'Undo', onAction: undo });
  };

  const clearAll = async () => {
    if (!record || !record.items.length) return;
    const all = record.items.map(snapshot);
    pushUndo({ undoLabel: `${all.length} highlights restored`, restore: all });

    for (const h of record.items) CP.unpaint(h.id);
    record.items = [];
    await persist();
    CP.ui.close();
    CP.ui.toast(`${all.length} highlights cleared`, { label: 'Undo', onAction: undo });
  };

  const copyText = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      CP.ui.toast('Copied');
    } catch {
      CP.ui.toast('Copy blocked by browser');
    }
  };

  /* ---------- toolbar wiring ---------- */

  const openForSelection = () => {
    const sel = window.getSelection();
    const desc = CP.describeSelection(sel);
    if (!desc) return false;
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    if (!rect.width && !rect.height) return false;

    CP.ui.open({
      mode: 'new',
      rect,
      payload: desc,
      handlers: {
        onColor: (color) => addFromSelection(color),
        onCopy: () => copyText(desc.text)
      }
    });
    return true;
  };

  const openForMark = (mark) => {
    const h = byId(mark.dataset.cpId);
    if (!h) return;
    const rect = mark.getBoundingClientRect();
    CP.ui.open({
      mode: 'edit',
      rect,
      payload: h,
      handlers: {
        onColor: (color) => setColor(h.id, color),
        onNote: (note) => setNote(h.id, note),
        onCopy: () => copyText(h.note ? `${h.text}\n\n— ${h.note}` : h.text),
        onRemove: () => removeOne(h.id)
      }
    });
  };

  /* ---------- events ---------- */

  const isEditable = (el) =>
    !!el && (el.isContentEditable ||
      ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));

  /* document.activeElement stops at a shadow host, so a note being typed in
     the panel would otherwise look like "nothing is focused" and Ctrl+Z would
     undo a highlight instead of a word. */
  const focusedElement = () => {
    let el = document.activeElement;
    while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement;
    return el;
  };

  document.addEventListener('mouseup', (e) => {
    if (CP.ui.contains(e.target)) return;
    setTimeout(() => {
      const mark = e.target instanceof Element ? e.target.closest('mark.cp-hl') : null;
      if (openForSelection()) return;
      if (mark && !mark.closest('a')) { openForMark(mark); return; }
      CP.ui.close();
    }, 0);
  }, true);

  document.addEventListener('keyup', (e) => {
    if (!e.shiftKey || isEditable(document.activeElement)) return;
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) return;
    openForSelection();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && CP.ui.isOpen()) {
      CP.ui.close();
      return;
    }

    /* Undo only while the panel is up: inside ChatGPT's own page, Ctrl+Z
       belongs to whatever the reader is doing, not to us. */
    if ((e.ctrlKey || e.metaKey) && !e.altKey && e.code === 'KeyZ' &&
        CP.panel.isOpen() && !isEditable(focusedElement())) {
      e.preventDefault();
      undo();
      return;
    }

    if (!e.altKey || e.ctrlKey || e.metaKey) return;
    if (isEditable(focusedElement())) return;

    if (e.code === 'KeyH') {
      e.preventDefault();
      CP.panel.toggle();
      return;
    }

    const m = /^Digit([1-5])$/.exec(e.code);
    if (!m) return;
    const color = CP.COLOR_KEYS[Number(m[1]) - 1];
    if (!color) return;
    if (CP.ui.mode() === 'edit') {
      e.preventDefault();
      setColor(CP.ui.payload().id, color);
      CP.ui.close();
    } else if (CP.describeSelection(window.getSelection())) {
      e.preventDefault();
      addFromSelection(color);
    }
  });

  const onViewportShift = () => {
    if (!CP.ui.isOpen()) return;
    const p = CP.ui.payload();
    const mark = p?.id ? CP.marksFor(p.id)[0] : null;
    if (mark) {
      CP.ui.reposition(mark.getBoundingClientRect());
      return;
    }
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed && sel.rangeCount) {
      CP.ui.reposition(sel.getRangeAt(0).getBoundingClientRect());
    } else {
      CP.ui.close();
    }
  };
  window.addEventListener('scroll', onViewportShift, true);
  window.addEventListener('resize', onViewportShift);

  /* ChatGPT is a single-page app: it swaps conversations without a reload,
     and React re-renders turns out from under us. One observer covers both. */
  const onDomSettled = CP.debounce(() => {
    if (location.href !== lastHref) {
      lastHref = location.href;
      const next = CP.conversationId();
      if (next !== convId) {
        CP.ui.close();
        boot();
        return;
      }
    }
    CP.ui.syncTheme();
    CP.panel.syncTheme();
    restoreAll();
  }, 260);

  /* Our own panel and tray mutate the DOM too. Without this guard every list
     re-render would schedule another pass over the conversation. */
  const fromOurUi = (m) => {
    const el = m.target.nodeType === Node.TEXT_NODE ? m.target.parentElement : m.target;
    return !!el?.closest?.('[data-cp-ui]');
  };

  new MutationObserver((records) => {
    if (records.every(fromOurUi)) return;
    onDomSettled();
  }).observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true
  });

  for (const fn of ['pushState', 'replaceState']) {
    const orig = history[fn];
    history[fn] = function (...args) {
      const out = orig.apply(this, args);
      onDomSettled();
      return out;
    };
  }
  window.addEventListener('popstate', onDomSettled);

  /* ---------- popup channel ---------- */

  chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
    (async () => {
      switch (msg?.type) {
        case 'CP_QUERY':
          reply({
            ok: true,
            convId,
            title: CP.conversationTitle(),
            colors: CP.COLORS,
            items: record?.items ?? []
          });
          break;

        case 'CP_SCROLL':
          reply(jumpTo(msg.id) ? { ok: true } : { ok: false, reason: 'not-loaded' });
          break;

        case 'CP_PANEL':
          CP.panel.setOpen(msg.open !== false);
          reply({ ok: true });
          break;

        case 'CP_REMOVE':
          await removeOne(msg.id);
          reply({ ok: true, items: record?.items ?? [] });
          break;

        case 'CP_COLOR':
          await setColor(msg.id, msg.color);
          reply({ ok: true, items: record?.items ?? [] });
          break;

        case 'CP_CLEAR':
          await clearAll();
          reply({ ok: true, items: [] });
          break;

        default:
          reply({ ok: false, reason: 'unknown' });
      }
    })();
    return true; // keep the channel open for the async reply
  });

  /* The panel reads through this rather than reaching into state itself. */
  CP.panel.init({
    items: () => record?.items ?? [],
    title: () => CP.conversationTitle(),
    jump: (id) => {
      if (!jumpTo(id)) CP.ui.toast('That turn is not loaded yet');
    },
    peek,
    copy: copyText,
    setColor,
    setNote: (id, note) => setNote(id, note),
    remove: removeOne,
    undo,
    canUndo: () => undoer.canUndo()
  });
  CP.panel.restoreState();

  /* A category renamed in one ChatGPT tab should show up in the others. */
  CP.PALETTE.onChange(() => CP.panel.refresh());

  boot();
})();
