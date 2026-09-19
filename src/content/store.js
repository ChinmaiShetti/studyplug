/* ChatPlug — persistence, from the page's side.

   The storage layout and its readers live in src/shared/records.js so the popup
   and the library can use them too. What stays here is the part only a ChatGPT
   page can answer: which conversation this is, and what it is called. */
(() => {
  const CP = window.__chatplug__;
  const R = (CP.RECORDS = globalThis.ChatPlugRecords);

  CP.INDEX_KEY = R.INDEX_KEY;
  CP.convKey = R.convKey;

  /* /c/<id>, and the same under a custom GPT: /g/<gpt>/c/<id>. */
  CP.conversationId = () => {
    const m = location.pathname.match(/\/c\/([A-Za-z0-9-]+)/);
    return m ? m[1] : null;
  };

  CP.conversationTitle = () =>
    (document.title || '').replace(/\s*[|·-]\s*ChatGPT\s*$/i, '').trim() ||
    'Untitled conversation';

  CP.loadConversation = async (convId) => {
    if (!convId) return null;
    return (await R.loadConversation(convId)) || {
      convId, title: CP.conversationTitle(), url: location.href, updated: 0, items: []
    };
  };

  CP.saveConversation = async (record) => {
    if (!record?.convId) return;
    /* Refreshed on every save: ChatGPT names a conversation after the first
       reply, so the title we stored at highlight time is often "New chat". */
    record.title = CP.conversationTitle();
    record.url = location.href;
    return R.saveConversation(record);
  };
})();
