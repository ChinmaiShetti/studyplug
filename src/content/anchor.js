/* ChatPlug — turning a live Selection into a durable anchor, and back again.

   A highlight is stored as { msgId, start, end } where start/end are character
   offsets into the concatenated text of one message turn. Offsets are stable
   because wrapping text in <mark> does not change textContent — so we can
   re-paint after React throws the DOM away and rebuilds it. */
(() => {
  const CP = window.__chatplug__;

  /* Our own floating UI lives in the page too; it must never count towards
     offsets. Marks deliberately do NOT carry data-cp-ui: their text is real
     message text and has to keep counting. */
  const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA']);

  const textNodes = (root) => {
    const out = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        if (!n.nodeValue) return NodeFilter.FILTER_REJECT;
        const p = n.parentElement;
        if (!p) return NodeFilter.FILTER_REJECT;
        if (SKIP_TAGS.has(p.tagName)) return NodeFilter.FILTER_REJECT;
        if (p.closest('[data-cp-ui]')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    let n;
    while ((n = walker.nextNode())) out.push(n);
    return out;
  };
  CP.textNodes = textNodes;

  CP.fullText = (root) => textNodes(root).map(n => n.nodeValue).join('');

  /* Selections can hand us element containers; walk down to a real text node. */
  const toTextPoint = (container, offset, atStart) => {
    if (container.nodeType === Node.TEXT_NODE) return { node: container, offset };
    const kids = container.childNodes;
    if (!kids.length) return null;
    const child = kids[Math.min(offset, kids.length - 1)];
    if (!child) return null;
    if (child.nodeType === Node.TEXT_NODE) {
      return { node: child, offset: atStart ? 0 : child.nodeValue.length };
    }
    const inner = textNodes(child);
    if (!inner.length) return null;
    const node = atStart ? inner[0] : inner[inner.length - 1];
    return { node, offset: atStart ? 0 : node.nodeValue.length };
  };

  const globalOffset = (root, node, offset) => {
    let total = 0;
    for (const n of textNodes(root)) {
      if (n === node) return total + offset;
      total += n.nodeValue.length;
    }
    return -1;
  };

  /* Map a [start,end) span back onto the text nodes that currently cover it. */
  const sliceNodes = (root, start, end) => {
    const parts = [];
    let pos = 0;
    for (const node of textNodes(root)) {
      const len = node.nodeValue.length;
      const nodeStart = pos, nodeEnd = pos + len;
      if (nodeEnd > start && nodeStart < end) {
        parts.push({
          node,
          from: Math.max(0, start - nodeStart),
          to: Math.min(len, end - nodeStart)
        });
      }
      pos = nodeEnd;
      if (pos >= end) break;
    }
    return parts;
  };

  /* Selection -> { msgId, role, start, end, text } or null if unusable. */
  CP.describeSelection = (sel) => {
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;
    const range = sel.getRangeAt(0);
    if (range.collapsed) return null;

    const msgEl = CP.closestMessage(range.commonAncestorContainer);
    if (!msgEl) return null;
    const msgId = msgEl.getAttribute('data-message-id');
    if (!msgId) return null;

    const sp = toTextPoint(range.startContainer, range.startOffset, true);
    const ep = toTextPoint(range.endContainer, range.endOffset, false);
    if (!sp || !ep) return null;

    let start = globalOffset(msgEl, sp.node, sp.offset);
    let end = globalOffset(msgEl, ep.node, ep.offset);
    if (start < 0 || end < 0) return null;
    if (start > end) [start, end] = [end, start];

    /* Trim the whitespace a double-click or drag tends to sweep up. */
    const whole = CP.fullText(msgEl);
    while (start < end && /\s/.test(whole[start])) start++;
    while (end > start && /\s/.test(whole[end - 1])) end--;
    if (end - start < 1) return null;

    return {
      msgId,
      role: CP.roleOf(msgEl),
      /* Stored as a fallback for ordering when the turn is not loaded; the
         live DOM position wins whenever it is available. */
      turn: CP.messageOrder().get(msgId) ?? 0,
      start,
      end,
      text: whole.slice(start, end)
    };
  };

  CP.messageEl = (msgId) =>
    document.querySelector(`[data-message-id="${CSS.escape(msgId)}"]`);

  /* Where each loaded turn sits in the conversation. Lists read in reading
     order, which is not the order highlights were made in. */
  CP.messageOrder = () => {
    const order = new Map();
    document.querySelectorAll(CP.MESSAGE_SELECTOR).forEach((el, i) => {
      const id = el.getAttribute('data-message-id');
      if (id && !order.has(id)) order.set(id, i);
    });
    return order;
  };

  /* Reading order: the turn's position in the conversation, then the offset
     within that turn.

     Loaded and unloaded turns are ranked separately and never compared against
     each other. A live DOM index and a stored `turn` are different coordinate
     systems: in a long chat ChatGPT only keeps part of the conversation in the
     DOM, so the loaded turns are indexed 0..n while the stored turns they came
     from might be 20..30. Ranking them on one scale scrambles the list. Turns
     that are not currently loaded therefore sort as a block at the end, in
     their own recorded order, where they can still be found. */
  CP.inReadingOrder = (items) => {
    const order = CP.messageOrder();
    const LOADED = 0, UNLOADED = 1;
    const key = (h) => {
      const live = order.get(h.msgId);
      return live === undefined
        ? [UNLOADED, h.turn ?? Number.MAX_SAFE_INTEGER, h.start]
        : [LOADED, live, h.start];
    };
    return [...items].sort((a, b) => {
      const ka = key(a), kb = key(b);
      return ka[0] - kb[0] || ka[1] - kb[1] || ka[2] - kb[2];
    });
  };

  CP.isPainted = (id) =>
    !!document.querySelector(`mark.cp-hl[data-cp-id="${CSS.escape(id)}"]`);

  CP.marksFor = (id) =>
    document.querySelectorAll(`mark.cp-hl[data-cp-id="${CSS.escape(id)}"]`);

  /* A selection that runs across list items or paragraphs also covers the
     whitespace the markup is formatted with — the newline and indent sitting
     between </li> and <li>, which normally collapses to nothing. Wrapping that
     in a <mark> turns it into an inline box between two block boxes, so the
     browser builds an anonymous line box to hold it and a blank line appears
     in the middle of the list.

     Inside <pre> the same characters are real content and must still be
     painted, or a highlight across a code block comes out full of holes. */
  const isCollapsedGap = ({ node, from, to }) => {
    if (node.nodeValue.slice(from, to).trim()) return false;
    const parent = node.parentElement;
    if (!parent) return true;
    if (parent.closest('pre')) return false;
    let ws = '';
    try {
      ws = getComputedStyle(parent).whiteSpace || '';
    } catch { /* detached node: fall through to treating it as collapsible */ }
    return !ws.startsWith('pre') && ws !== 'break-spaces';
  };

  /* Offsets can drift when a turn is edited or regenerated. Rather than paint
     the wrong words, confirm the stored text still sits where we left it, and
     if it moved by a little, follow it. Returns 'ok' | 'moved' | false. */
  const reanchor = (msgEl, h) => {
    const whole = CP.fullText(msgEl);
    if (whole.slice(h.start, h.end) === h.text) return 'ok';

    const first = whole.indexOf(h.text);
    if (first === -1) return false;
    /* Ambiguous when the same words appear more than once: take the
       occurrence nearest the original offset. */
    let best = first, bestDist = Math.abs(first - h.start), at = first;
    while ((at = whole.indexOf(h.text, at + 1)) !== -1) {
      const d = Math.abs(at - h.start);
      if (d < bestDist) { best = at; bestDist = d; }
    }
    h.start = best;
    h.end = best + h.text.length;
    return 'moved';
  };

  /* Wrap every text node the span touches. surroundContents() cannot be used:
     a highlight routinely straddles <strong>, <code> and list-item boundaries. */
  CP.paint = (h) => {
    const msgEl = CP.messageEl(h.msgId);
    if (!msgEl || CP.isStreaming(msgEl)) return false;
    if (CP.isPainted(h.id)) return 'ok';

    const status = reanchor(msgEl, h);
    if (!status) return false;

    const parts = sliceNodes(msgEl, h.start, h.end);
    if (!parts.length) return false;

    let painted = 0;
    for (const part of parts) {
      if (part.to <= part.from) continue;
      if (isCollapsedGap(part)) continue;
      let node = part.node;
      if (part.to < node.nodeValue.length) node.splitText(part.to);
      if (part.from > 0) node = node.splitText(part.from);

      const mark = document.createElement('mark');
      mark.className = 'cp-hl';
      mark.dataset.cpId = h.id;
      mark.dataset.cpColor = h.color;
      if (h.note) {
        mark.dataset.cpNote = '1';
        mark.title = h.note;
      }
      node.parentNode.insertBefore(mark, node);
      mark.appendChild(node);
      painted++;
    }
    return painted > 0 ? status : false;
  };

  CP.unpaint = (id) => {
    CP.marksFor(id).forEach((mark) => {
      const parent = mark.parentNode;
      if (!parent) return;
      while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
      parent.removeChild(mark);
      parent.normalize(); // re-merge split text nodes so offsets stay clean
    });
  };

  CP.recolor = (id, color, note) => {
    CP.marksFor(id).forEach((mark) => {
      mark.dataset.cpColor = color;
      if (note) {
        mark.dataset.cpNote = '1';
        mark.title = note;
      } else {
        delete mark.dataset.cpNote;
        mark.removeAttribute('title');
      }
    });
  };
})();
