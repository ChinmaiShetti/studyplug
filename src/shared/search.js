/* ChatPlug — searching highlights.

   Plain case-insensitive substring matching over the passage and its note. For
   the volumes involved — thousands of highlights at the very most — that is
   fast, and unlike fuzzy matching it can say exactly which characters matched,
   which is what lets the results underline them.

   Multiple words are AND-ed and may appear in either the passage or its note,
   so "eval gate" finds a passage about the gate with "eval" only in the note.
   A quoted "phrase" is matched whole. */
(() => {
  /* Splits on whitespace, keeping "quoted phrases" together. */
  const terms = (query) => {
    const out = [];
    const re = /"([^"]*)"|(\S+)/g;
    let m;
    while ((m = re.exec(String(query ?? '')))) {
      const term = (m[1] ?? m[2] ?? '').trim().toLowerCase();
      if (term) out.push(term);
    }
    return out;
  };

  const haystack = (h) => `${h?.text ?? ''}\n${h?.note ?? ''}`.toLowerCase();

  const matches = (h, termList) => {
    if (!termList.length) return true;
    const hay = haystack(h);
    return termList.every((t) => hay.includes(t));
  };

  /* Splits text into runs so a renderer can mark the matched ones. Overlapping
     matches are merged, so searching "ever every" never double-wraps. */
  const segments = (text, termList) => {
    const source = String(text ?? '');
    if (!source || !termList.length) return [{ text: source, hit: false }];

    const lower = source.toLowerCase();
    const spans = [];
    for (const term of termList) {
      if (!term) continue;
      let from = lower.indexOf(term);
      while (from !== -1) {
        spans.push([from, from + term.length]);
        from = lower.indexOf(term, from + 1);
      }
    }
    if (!spans.length) return [{ text: source, hit: false }];

    spans.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const merged = [spans[0].slice()];
    for (const [s, e] of spans.slice(1)) {
      const last = merged[merged.length - 1];
      if (s <= last[1]) last[1] = Math.max(last[1], e);
      else merged.push([s, e]);
    }

    const out = [];
    let at = 0;
    for (const [s, e] of merged) {
      if (s > at) out.push({ text: source.slice(at, s), hit: false });
      out.push({ text: source.slice(s, e), hit: true });
      at = e;
    }
    if (at < source.length) out.push({ text: source.slice(at), hit: false });
    return out;
  };

  /* Applies the query plus the category and role filters in one pass. */
  const filter = (items, { query = '', colors = null, role = null } = {}) => {
    const termList = terms(query);
    return (items || []).filter((h) => {
      if (colors && colors.size && !colors.has(h.color)) return false;
      if (role && h.role !== role) return false;
      return matches(h, termList);
    });
  };

  globalThis.ChatPlugSearch = { terms, matches, segments, filter };
})();
