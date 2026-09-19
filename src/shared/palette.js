/* ChatPlug — the palette.

   Loaded by content scripts and by extension pages (popup, library), so it must
   not assume the content-script namespace exists. It defines itself on
   globalThis and core.js adopts it.

   The five hexes are fixed. They were chosen and verified for contrast against
   the dark text that sits on them (5.49:1 to 10.90:1) and for separation from
   each other (CIE76 dE 53.2 at the closest pair). What the user changes is what
   each colour is *called*: "blue" becomes "Methodology". */
(() => {
  const LABELS_KEY = 'cp:labels';
  const MAX_LABEL = 24;

  /* key is persisted on every highlight and must never change. */
  const BASE = [
    { key: 'yellow', hex: '#f5c518', defaultLabel: 'Yellow' },
    { key: 'green', hex: '#4fc97a', defaultLabel: 'Green' },
    { key: 'blue', hex: '#45aee8', defaultLabel: 'Blue' },
    { key: 'pink', hex: '#f27298', defaultLabel: 'Pink' },
    { key: 'purple', hex: '#9b7bf0', defaultLabel: 'Purple' }
  ];

  /* One live array everyone shares. `label` is mutated in place when custom
     names load or change, so a re-render picks them up without re-wiring. */
  const colors = BASE.map((c) => ({ ...c, label: c.defaultLabel }));
  const byKey = new Map(colors.map((c) => [c.key, c]));

  /* A name is a short human label, not free text: no newlines, no runaway
     length, and blank means "go back to the colour's own name". */
  const clean = (value) =>
    String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_LABEL);

  const applyLabels = (stored) => {
    for (const c of colors) {
      const custom = clean(stored?.[c.key]);
      c.label = custom || c.defaultLabel;
    }
    return colors;
  };

  const storage = () => {
    try {
      return chrome?.storage?.local ?? null;
    } catch {
      return null; // not an extension context (tests, previews)
    }
  };

  const readLabels = () =>
    new Promise((resolve) => {
      const s = storage();
      if (!s) return resolve({});
      try {
        s.get(LABELS_KEY, (v) => resolve(v?.[LABELS_KEY] || {}));
      } catch {
        resolve({});
      }
    });

  const Palette = {
    LABELS_KEY,
    MAX_LABEL,
    colors,
    keys: colors.map((c) => c.key),

    get: (key) => byKey.get(key) || colors[0],
    hexOf: (key) => (byKey.get(key) || colors[0]).hex,
    labelOf: (key) => (byKey.get(key) || colors[0]).label,
    defaultLabelOf: (key) => (byKey.get(key) || colors[0]).defaultLabel,
    isRenamed: (key) => {
      const c = byKey.get(key);
      return !!c && c.label !== c.defaultLabel;
    },

    clean,
    applyLabels,

    /* Pull custom names out of storage and apply them to the live array. */
    async refresh() {
      return applyLabels(await readLabels());
    },

    /* Blank clears the name back to the colour's own. Returns the label that
       ended up in effect, so a caller can render it without re-reading. */
    async setLabel(key, value) {
      if (!byKey.has(key)) return null;
      const next = clean(value);
      const stored = await readLabels();

      if (next && next !== byKey.get(key).defaultLabel) stored[key] = next;
      else delete stored[key];

      const s = storage();
      if (s) {
        await new Promise((r) => {
          try {
            s.set({ [LABELS_KEY]: stored }, r);
          } catch {
            r();
          }
        });
      }
      applyLabels(stored);
      return byKey.get(key).label;
    },

    /* Renames made in one tab should reach the others. */
    onChange(callback) {
      try {
        chrome.storage.onChanged.addListener((changes, area) => {
          if (area !== 'local' || !changes[LABELS_KEY]) return;
          applyLabels(changes[LABELS_KEY].newValue || {});
          callback();
        });
      } catch {
        /* no storage events outside an extension context */
      }
    }
  };

  globalThis.ChatPlugPalette = Palette;
})();
