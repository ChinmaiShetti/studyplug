/* ChatPlug — background service worker.

   Deliberately small. It exists because a content script cannot open a tab
   itself, and the panel needs a way into the library. */

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg?.type === 'CP_OPEN_LIBRARY') {
    chrome.tabs.create({ url: chrome.runtime.getURL('src/library/library.html') });
    reply({ ok: true });
    return false; // answered synchronously
  }
  return false;
});
