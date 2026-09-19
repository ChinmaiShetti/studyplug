/* StudyPlug — background service worker.

   Deliberately small. It exists for the two things a content script cannot do
   itself: open a tab, and own a context menu. */

importScripts('/src/shared/palette.js');

const PALETTE = globalThis.StudyPlugPalette;
const ROOT = 'studyplug-root';
const MATCHES = ['https://chatgpt.com/*', 'https://chat.openai.com/*'];

/* The menu carries the user's own category names, so it has to be rebuilt
   whenever those change — not just at install. */
const buildMenu = async () => {
  await PALETTE.refresh();
  await chrome.contextMenus.removeAll();

  chrome.contextMenus.create({
    id: ROOT,
    title: 'Highlight with StudyPlug',
    contexts: ['selection'],
    documentUrlPatterns: MATCHES
  });

  for (const c of PALETTE.colors) {
    chrome.contextMenus.create({
      id: `studyplug-${c.key}`,
      parentId: ROOT,
      title: c.label,
      contexts: ['selection'],
      documentUrlPatterns: MATCHES
    });
  }
};

chrome.runtime.onInstalled.addListener(buildMenu);
chrome.runtime.onStartup.addListener(buildMenu);

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[PALETTE.LABELS_KEY]) buildMenu();
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab?.id || !String(info.menuItemId).startsWith('studyplug-')) return;
  const color = String(info.menuItemId).slice('studyplug-'.length);
  chrome.tabs.sendMessage(tab.id, { type: 'CP_HIGHLIGHT_SELECTION', color }, () => {
    /* The tab may predate the extension being loaded; nothing to do but let
       it go, rather than log an unchecked-error warning. */
    void chrome.runtime.lastError;
  });
});

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg?.type === 'CP_OPEN_LIBRARY') {
    chrome.tabs.create({ url: chrome.runtime.getURL('src/library/library.html') });
    reply({ ok: true });
  }
  return false; // every branch answers synchronously
});
