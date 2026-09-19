/* StudyPlug — turning highlights into something you can keep.

   Two jobs, deliberately separate:

     Markdown  — for reading and pasting into a document. Lossy on purpose:
                 ids and offsets are noise to a human reader.
     Backup    — the whole records, exactly, so a restore is faithful.

   Pure functions over plain data, so both are testable without a browser. */
(() => {
  const BACKUP_FORMAT = 'studyplug-backup';
  const BACKUP_VERSION = 1;

  /* Backups written before the project was renamed. Still readable — a file
     someone made yesterday should not stop working because of a rename. */
  const LEGACY_FORMATS = new Set(['chatplug-backup']);

  const whoOf = (h) => (h.role === 'user' ? 'You' : 'ChatGPT');
  const quote = (text) =>
    String(text ?? '').split('\n').map((l) => '> ' + l).join('\n');

  /* items may carry convTitle/convUrl when they came from more than one chat. */
  const toMarkdown = (items, opts = {}) => {
    const {
      title = 'ChatGPT highlights',
      groupBy = 'none',              // 'none' | 'category' | 'conversation'
      labelOf = (key) => key,
      colorOrder = [],
      showSource = false,
      date = new Date()
    } = opts;

    const list = [...(items || [])];
    const lines = [
      `# ${title}`,
      '',
      `${list.length} ${list.length === 1 ? 'highlight' : 'highlights'} · ${date.toLocaleDateString()}`,
      ''
    ];

    const block = (h, omit) => {
      const bits = [`**${whoOf(h)}**`];
      if (omit !== 'category') bits.push(labelOf(h.color));
      if (showSource && omit !== 'conversation' && h.convTitle) bits.push(h.convTitle);
      lines.push(bits.join(' · '), '', quote(h.text), '');
      if (h.note) lines.push(`*Note: ${h.note}*`, '');
      lines.push('---', '');
    };

    if (groupBy === 'category') {
      const keys = colorOrder.length
        ? colorOrder
        : [...new Set(list.map((h) => h.color))];
      for (const key of keys) {
        const group = list.filter((h) => h.color === key);
        if (!group.length) continue;
        lines.push(`## ${labelOf(key)}`, '');
        for (const h of group) block(h, 'category');
      }
    } else if (groupBy === 'conversation') {
      const seen = new Map();
      for (const h of list) {
        const id = h.convId ?? '';
        if (!seen.has(id)) seen.set(id, []);
        seen.get(id).push(h);
      }
      for (const group of seen.values()) {
        lines.push(`## ${group[0].convTitle || 'Untitled conversation'}`, '');
        for (const h of group) block(h, 'conversation');
      }
    } else {
      for (const h of list) block(h, null);
    }

    /* One trailing newline, not the pile the rules leave behind. */
    return lines.join('\n').replace(/\n+$/, '\n');
  };

  const toPlain = (items) =>
    (items || [])
      .map((h) => (h.note ? `${h.text}\n— ${h.note}` : h.text))
      .join('\n\n');

  /* ---------- backup ---------- */

  const toBackup = ({ conversations = [], labels = {} } = {}) => ({
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exported: new Date().toISOString(),
    labels,
    conversations
  });

  /* Never throws: a restore is the one irreversible action here, so a bad file
     has to come back as a message rather than an exception. */
  const parseBackup = (text) => {
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return { ok: false, error: 'That file is not valid JSON.' };
    }
    if (!data || typeof data !== 'object') {
      return { ok: false, error: 'That file does not contain a backup.' };
    }
    if (data.format !== BACKUP_FORMAT && !LEGACY_FORMATS.has(data.format)) {
      return { ok: false, error: 'That is not a StudyPlug backup file.' };
    }
    if (!Number.isInteger(data.version) || data.version > BACKUP_VERSION) {
      return {
        ok: false,
        error: `That backup was written by a newer version of StudyPlug (v${data.version}).`
      };
    }
    if (!Array.isArray(data.conversations)) {
      return { ok: false, error: 'That backup has no conversations in it.' };
    }
    const conversations = data.conversations.filter(
      (c) => c && typeof c.convId === 'string' && Array.isArray(c.items)
    );
    return {
      ok: true,
      data: {
        version: data.version,
        exported: data.exported,
        labels: data.labels && typeof data.labels === 'object' ? data.labels : {},
        conversations
      },
      skipped: data.conversations.length - conversations.length
    };
  };

  /* Works out what a restore would write, without writing it. `replace` keeps
     the backup's version of any conversation it names and leaves the rest
     alone; `merge` adds only highlights whose id is not already there. */
  const planRestore = (existing = [], incoming = [], mode = 'merge') => {
    const byId = new Map(existing.map((c) => [c.convId, c]));
    const stats = { conversationsAdded: 0, conversationsTouched: 0, highlightsAdded: 0, highlightsSkipped: 0 };
    const result = new Map(existing.map((c) => [c.convId, c]));

    for (const inc of incoming) {
      const mine = byId.get(inc.convId);

      if (!mine) {
        result.set(inc.convId, { ...inc });
        stats.conversationsAdded++;
        stats.highlightsAdded += inc.items.length;
        continue;
      }

      if (mode === 'replace') {
        result.set(inc.convId, { ...inc });
        stats.conversationsTouched++;
        stats.highlightsAdded += inc.items.length;
        continue;
      }

      const have = new Set(mine.items.map((h) => h.id));
      const added = inc.items.filter((h) => !have.has(h.id));
      stats.highlightsSkipped += inc.items.length - added.length;
      if (!added.length) continue;

      result.set(inc.convId, {
        ...mine,
        /* The backup may be newer, and its title is the one that was saved
           with those highlights. */
        title: inc.title || mine.title,
        url: inc.url || mine.url,
        updated: Math.max(mine.updated || 0, inc.updated || 0),
        items: [...mine.items, ...added]
      });
      stats.conversationsTouched++;
      stats.highlightsAdded += added.length;
    }

    return { conversations: [...result.values()], stats };
  };

  globalThis.StudyPlugExport = {
    BACKUP_FORMAT,
    BACKUP_VERSION,
    toMarkdown,
    toPlain,
    toBackup,
    parseBackup,
    planRestore
  };
})();
