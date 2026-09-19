/* ChatPlug — persistence.

   chrome.storage.local layout:
     cp:conv:<convId> -> { convId, title, url, updated, items: [highlight] }
     cp:index         -> { <convId>: { title, url, count, updated } }

   The index is kept current so a cross-conversation view can be built without
   reading every conversation record. Nothing reads it back yet — both the panel
   and the popup only ever show the conversation you are looking at. */
(() => {
  const CP = window.__chatplug__;

  const INDEX_KEY = 'cp:index';
  const convKey = (id) => 'cp:conv:' + id;
  CP.INDEX_KEY = INDEX_KEY;
  CP.convKey = convKey;

  /* /c/<id>, and the same under a custom GPT: /g/<gpt>/c/<id>. */
  CP.conversationId = () => {
    const m = location.pathname.match(/\/c\/([A-Za-z0-9-]+)/);
    return m ? m[1] : null;
  };

  CP.conversationTitle = () =>
    (document.title || '').replace(/\s*[|·-]\s*ChatGPT\s*$/i, '').trim() ||
    'Untitled conversation';

  const get = (keys) => new Promise((r) => chrome.storage.local.get(keys, r));
  const set = (obj) => new Promise((r) => chrome.storage.local.set(obj, r));
  const remove = (keys) => new Promise((r) => chrome.storage.local.remove(keys, r));

  CP.loadConversation = async (convId) => {
    if (!convId) return null;
    const data = await get(convKey(convId));
    return data[convKey(convId)] || {
      convId, title: CP.conversationTitle(), url: location.href, updated: 0, items: []
    };
  };

  CP.saveConversation = async (record) => {
    if (!record?.convId) return;
    record.updated = Date.now();
    record.title = CP.conversationTitle();
    record.url = location.href;

    const index = (await get(INDEX_KEY))[INDEX_KEY] || {};
    if (record.items.length === 0) {
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
  };
})();
