/* ChatPlug — shared namespace, constants, small helpers.
   Loaded first; every other content script hangs off window.__chatplug__. */
(() => {
  const CP = (window.__chatplug__ = window.__chatplug__ || {});

  /* The palette lives in src/shared/palette.js so the popup and the library can
     load it too. CP.COLORS is that module's live array — its `label` fields are
     mutated in place when custom category names load or change, so re-rendering
     is enough to pick a rename up. */
  CP.PALETTE = globalThis.ChatPlugPalette;
  CP.COLORS = CP.PALETTE.colors;
  CP.COLOR_KEYS = CP.PALETTE.keys;
  CP.DEFAULT_COLOR = 'yellow';
  CP.labelOf = (key) => CP.PALETTE.labelOf(key);
  CP.hexOf = (key) => CP.PALETTE.hexOf(key);

  /* ChatGPT stamps a server-side id on every message turn. It survives
     re-renders and reloads, which makes it the anchor we hang highlights on. */
  CP.MESSAGE_SELECTOR = '[data-message-id]';

  CP.uid = () =>
    'h_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);

  CP.debounce = (fn, ms) => {
    let t;
    return (...a) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...a), ms);
    };
  };

  CP.closestMessage = (node) => {
    if (!node) return null;
    const el = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    return el ? el.closest(CP.MESSAGE_SELECTOR) : null;
  };

  CP.roleOf = (msgEl) =>
    msgEl?.getAttribute('data-message-author-role') || 'unknown';

  /* A message that is still streaming has shifting text, so its stored
     offsets are meaningless until it settles. */
  CP.isStreaming = (msgEl) =>
    !!msgEl && (
      msgEl.querySelector('.result-streaming') !== null ||
      msgEl.classList.contains('result-streaming') ||
      msgEl.closest('[data-is-streaming="true"]') !== null
    );
})();
