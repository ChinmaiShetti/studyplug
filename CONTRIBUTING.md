# Contributing to StudyPlug

Thanks for taking a look. This is a small codebase with no build step — what is
in `src/` is what runs in the browser.

## Getting set up

```bash
git clone <your fork>
cd studyplug
npm install          # jsdom + eslint, for the checks only
npm run check        # lint + tests
```

Then load it in the browser:

1. `chrome://extensions` → **Developer mode** → **Load unpacked** → this folder.
2. Open or reload a tab on <https://chatgpt.com>.

After changing anything under `src/content/`, reload the ChatGPT tab — content
scripts only attach on page load. After changing the service worker or the
manifest, hit reload on the extension card first.

## Before you open a pull request

```bash
npm run check
```

Both must pass. There is no formatter to run; match the surrounding style.

## How the code is arranged

There is no bundler, so **load order is the dependency graph**. It is declared
twice and both have to agree:

- `manifest.json` → `content_scripts.js` for the ChatGPT page
- the `<script>` tags in `src/popup/popup.html` and `src/library/library.html`

Anything in `src/shared/` is loaded by content scripts *and* by extension pages,
so it must not touch `window.__studyplug__`, `location` or `document.title`. It
defines itself on `globalThis`; `src/content/core.js` adopts it.

| Where | What it may assume |
| --- | --- |
| `src/shared/` | `chrome.storage` may be missing; no ChatGPT page |
| `src/content/` | a ChatGPT page, the `CP` namespace |
| `src/library/`, `src/popup/` | an extension page, `chrome.tabs` |
| `src/background/` | no DOM at all |

## Testing

Tests are `node:test` + `jsdom`, no framework. Two kinds:

- **`test/anchor.test.js`** builds a DOM shaped like a real ChatGPT turn and
  exercises the highlighting engine against it.
- **The rest** are pure functions — palette, undo, search, export — loaded into
  a sandbox with `new Function`, so they need no DOM.

If you add logic worth testing, prefer making it a pure function in
`src/shared/` over reaching into the DOM. That is why the undo stack takes its
DOM work as injected callbacks.

**Write the test so it would fail before your fix.** Several bugs in this
codebase looked fixed until the test was checked against the original
behaviour — notably a focus-stealing fix whose harness would have reported
success even if it had done nothing.

## Things that are easy to get wrong here

- **Shadow DOM cuts both ways.** ChatGPT cannot see into our UI, and we cannot
  rely on `document.activeElement` seeing into it either. Use `composedPath()`
  and walk `shadowRoot.activeElement`. See *Typing inside the extension's own
  UI* in the README.
- **Offsets, not DOM paths.** A highlight is a character range inside one turn.
  Anything that changes a message's text changes every offset after it.
- **Never paint collapsible whitespace.** Wrapping the newline between `</li>`
  and `<li>` puts an inline box between two block boxes and opens a blank line
  in the middle of a list. `<pre>` is the exception.
- **The five hexes are fixed.** They are verified for contrast against the dark
  text on them and for separation from each other. Rename categories instead.
- **`cp:` and `cp-` are not typos.** They predate the rename to StudyPlug
  and are kept so existing highlights are not orphaned. Do not "fix" them
  without writing a storage migration.
- **Destructive actions record their inverse.** If you add one, push an undo
  entry; see `src/content/undo.js`.

## Reporting a bug

Include the ChatGPT URL shape (`/c/…`, `/g/…/c/…`), whether the conversation was
long enough to lazy-load, your browser and version, and anything in the console
from the page *and* from the extension's service worker
(`chrome://extensions` → **Service worker**).
