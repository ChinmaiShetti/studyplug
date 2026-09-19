/* StudyPlug — the stored records.

   Loaded by content scripts and by extension pages (popup, library), so it must
   not assume the content-script namespace or a ChatGPT page. Anything that
   needs `location` or `document.title` stays in src/content/store.js and is
   passed in.

   chrome.storage.local layout:
     cp:conv:<convId> -> { convId, title, url, updated, items: [highlight] }
     cp:index         -> { <convId>: { title, url, count, updated } }

   The `cp:` prefix predates the project being renamed to StudyPlug. It is kept
   because these keys hold real highlights: renaming them without a migration
   would orphan every mark anyone has already made, and a migration is a
   permanent extra code path to buy a tidier string nobody sees. The same goes
   for the `cp-` CSS classes and data attributes, which are only ever written
   to a live DOM and are kept aligned with this prefix.
*/
(() => {
  const INDEX_KEY = 'cp:index';
  const CONV_PREFIX = 'cp:conv:';
  const convKey = (id) => CONV_PREFIX + id;

  const local = () => {
    try {
      return chrome?.storage?.local ?? null;
    } catch {
      return null; // not an extension context (tests, previews)
    }
  };

  const get = (keys) =>
    new Promise((resolve) => {
      const s = local();
      if (!s) return resolve({});
      try {
        s.get(keys, (v) => resolve(v || {}));
      } catch {
        resolve({});
      }
    });

  const set = (obj) =>
    new Promise((resolve) => {
      const s = local();
      if (!s) return resolve();
      try {
        s.set(obj, resolve);
      } catch {
        resolve();
      }
    });

  const remove = (keys) =>
    new Promise((resolve) => {
      const s = local();
      if (!s) return resolve();
      try {
        s.remove(keys, resolve);
      } catch {
        resolve();
      }
    });

  const Records = {
    INDEX_KEY,
    CONV_PREFIX,
    convKey,
    get,
    set,
    remove,

    loadIndex: async () => (await get(INDEX_KEY))[INDEX_KEY] || {},

    loadConversation: async (convId) => {
      if (!convId) return null;
      return (await get(convKey(convId)))[convKey(convId)] || null;
    },

    /* The caller owns title and url — only a ChatGPT page knows them. */
    saveConversation: async (record) => {
      if (!record?.convId) return;
      record.updated = Date.now();

      const index = await Records.loadIndex();
      if (!record.items?.length) {
        delete index[record.convId];
        await remove(convKey(record.convId));
        await set({ [INDEX_KEY]: index });
        return;
      }
      index[record.convId] = {
        title: record.title,
        url: record.url,
        count: record.items.length,
        updated: record.updated
      };
      await set({ [convKey(record.convId)]: record, [INDEX_KEY]: index });
    },

    /* Every conversation that has highlights, newest first.

       Reads the keys the index names rather than storage.get(null): everything
       else in there — cp:labels, cp:panelOpen — is not a conversation, and
       would have to be filtered back out anyway. */
    loadAll: async () => {
      const index = await Records.loadIndex();
      const ids = Object.keys(index);
      if (!ids.length) return [];

      const bag = await get(ids.map(convKey));
      const records = [];
      for (const id of ids) {
        const rec = bag[convKey(id)];
        if (!rec?.items?.length) continue; // index drifted; skip rather than show an empty chat
        records.push(rec);
      }
      return records.sort((a, b) => (b.updated || 0) - (a.updated || 0));
    },

    /* Every highlight across every conversation, each tagged with where it
       came from so a flat list can still cite its source. */
    loadAllHighlights: async () => {
      const records = await Records.loadAll();
      const out = [];
      for (const rec of records) {
        for (const h of rec.items) {
          out.push({ ...h, convId: rec.convId, convTitle: rec.title, convUrl: rec.url });
        }
      }
      return out;
    },

    /* The index is derived data. Rebuilding beats trusting a copy after a
       restore, or when a write was interrupted part-way. */
    rebuildIndex: async (records) => {
      const index = {};
      for (const rec of records) {
        if (!rec?.convId || !rec.items?.length) continue;
        index[rec.convId] = {
          title: rec.title,
          url: rec.url,
          count: rec.items.length,
          updated: rec.updated || Date.now()
        };
      }
      await set({ [INDEX_KEY]: index });
      return index;
    }
  };

  globalThis.StudyPlugRecords = Records;
})();
