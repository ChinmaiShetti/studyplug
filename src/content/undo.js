/* ChatPlug — undo.

   Deleting a highlight throws away something the reader chose to keep, so
   every destructive path records its own inverse instead of just doing it.

   One entry shape covers all of them:

     { undoLabel, restore: [highlight...], remove: [id...], set: [{id, ...}] }

   Put `restore` back, delete `remove`, re-apply the field values in `set`. A
   re-mark that replaced an existing highlight needs two of those at once —
   restore what it displaced and delete what it added — which a plain stack of
   deleted items could not express.

   The DOM work is injected, so the stack itself is pure list handling and can
   be tested without a page. */
(() => {
  const CP = window.__chatplug__;

  CP.createUndo = ({ limit = 10 } = {}) => {
    const stack = [];

    return {
      push(entry) {
        stack.push(entry);
        /* Bounded: this is a safety net for the last few actions, not a
           history of the session. */
        while (stack.length > limit) stack.shift();
      },

      canUndo: () => stack.length > 0,
      size: () => stack.length,
      clear: () => { stack.length = 0; },

      /* Applies the most recent inverse to `items` and returns the new array.
         Returns null when there is nothing to undo.

         `set` changes are applied in place, so the highlight objects the
         caller holds are updated too — which is what main.js relies on. */
      undo(items, hooks = {}) {
        const entry = stack.pop();
        if (!entry) return null;

        const { onUnpaint, onPaint, onSet } = hooks;
        let next = items.slice();

        if (entry.remove?.length) {
          const doomed = new Set(entry.remove);
          for (const id of doomed) onUnpaint?.(id);
          next = next.filter((h) => !doomed.has(h.id));
        }

        let unpainted = 0;
        if (entry.restore?.length) {
          const present = new Set(next.map((h) => h.id));
          for (const h of entry.restore) {
            if (present.has(h.id)) continue; // already back by some other route
            next.push(h);
            present.add(h.id);
            /* The turn may have left the DOM since. The record is still
               correct; it gets painted when that turn loads again. */
            if (onPaint && !onPaint(h)) unpainted++;
          }
        }

        for (const change of entry.set || []) {
          const h = next.find((x) => x.id === change.id);
          if (!h) continue;
          if ('color' in change) h.color = change.color;
          if ('note' in change) h.note = change.note;
          onSet?.(h);
        }

        return { items: next, label: entry.undoLabel, unpainted };
      }
    };
  };
})();
