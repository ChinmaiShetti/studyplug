# StudyPlug

**Highlight, organise, annotate, and build a personal knowledge library from your
ChatGPT conversations.**

Select any text in a ChatGPT conversation, pick a colour, and it stays marked —
across scrolls, reloads and ChatGPT's own re-renders. Name the colours after
your own categories, annotate passages, search everything you have ever marked
across every chat, jump straight back to any passage, and export the lot as
Markdown.

A Manifest V3 extension with no build step and no network code: what is in
`src/` is what runs, and nothing leaves your machine.

## Install (unpacked)

1. Open `chrome://extensions` (or `edge://extensions`).
2. Turn on **Developer mode**.
3. Click **Load unpacked** and choose this folder.
4. Open or reload a tab on <https://chatgpt.com>.

Reload the ChatGPT tab after any change to the extension — content scripts only
attach on page load.

## Using it

Select text in any message and a small tray appears just below it, holding the
five colours and a few actions. Click an existing highlight to get the same tray
back with that highlight's controls.

| Action | How |
| --- | --- |
| Highlight | Select text, pick a colour from the tray |
| Highlight by right-click | Select text → **Highlight with StudyPlug** → a category |
| Highlight without the mouse | Select text, press <kbd>Alt</kbd>+<kbd>1</kbd>…<kbd>5</kbd> |
| Change colour | Click the highlight, pick another colour (or <kbd>Alt</kbd>+<kbd>1</kbd>…<kbd>5</kbd>) |
| Add or edit a note | Click the highlight → pencil (<kbd>Ctrl</kbd>+<kbd>Enter</kbd> saves, <kbd>Esc</kbd> cancels) |
| Copy the passage | Click the highlight → copy icon |
| Remove | Click the highlight → trash icon |
| Undo | The **Undo** on the toast, the arrow in the panel header, or <kbd>Ctrl</kbd>+<kbd>Z</kbd> while the panel is open |
| Dismiss the tray | <kbd>Esc</kbd>, or click elsewhere |
| Rename a category | Panel group header → pencil (<kbd>Enter</kbd> saves, <kbd>Esc</kbd> cancels) |
| Open / close the side panel | <kbd>Alt</kbd>+<kbd>H</kbd>, the edge tab, or popup → **Open in chat** |
| See the list, filter, export | Click the StudyPlug icon in the browser toolbar |
| Select several | Panel header → the tick icon, or `x` on a focused entry |
| Move around the panel | `j` / `k` to move, <kbd>Enter</kbd> to open, `g` to jump |
| Search every chat | Panel header → the library icon, or popup → **Library** |
| Export / back up | In the library: **Export .md**, **Back up**, **Restore** |

Keyboard shortcuts are ignored while you are typing in the composer, so
<kbd>Alt</kbd>+<kbd>1</kbd> never fires mid-message.

Re-marking a passage that is already highlighted **replaces** the existing mark
rather than nesting one inside another, so colours stay unambiguous.

## The side panel

<kbd>Alt</kbd>+<kbd>H</kbd> opens a panel down the right of the conversation
listing every highlight in the chat, **grouped by colour**. Each group is
collapsible and shows its own count, so "all the blue ones in this chat" is one
glance rather than a hunt.

Within a group, entries are numbered and ordered **as they appear in the
conversation**, not by when you marked them. Separate, non-adjacent passages
stay separate entries — two blue marks three turns apart are items 1 and 2, in
that order.

Click an entry to open it. That shows the full passage, its note, and:

- **Go to text** — scrolls the conversation to that passage and flashes it
- **Add note / Edit note** — writes the note inline (<kbd>Ctrl</kbd>+<kbd>Enter</kbd> saves)
- **Copy** — the passage, with its note appended if it has one
- **colour dots** — move the highlight to a different colour group
- **Remove**

Hovering an entry outlines that passage in the page, so you can connect the list
to the conversation without jumping.

The panel overlays rather than reflowing the page — ChatGPT's layout is a nest
of flex containers and pushing it around is the kind of thing that breaks on
their next deploy. Its open/closed state is remembered between visits.

The edge tab that opens it only appears once the conversation has at least one
highlight; before that, <kbd>Alt</kbd>+<kbd>H</kbd> still works.

## Undo

Deleting a highlight throws away something you chose to keep, so nothing
destructive is final. Removing one, clearing a conversation, changing a colour,
editing a note, and replacing a highlight by re-marking over it are all
reversible — the last ten, anyway.

Reach it from the **Undo** on the toast that follows a delete, the arrow in the
panel header (which appears only when there is something to take back), or
<kbd>Ctrl</kbd>+<kbd>Z</kbd> while the panel is open. It is deliberately scoped
to the panel: inside ChatGPT's own page, <kbd>Ctrl</kbd>+<kbd>Z</kbd> belongs to
whatever you are doing there, and the check looks through shadow roots so it
never fires while you are typing a note.

Each action records its own inverse rather than a snapshot, described as
"restore these, delete those, set these fields". Re-marking a passage needs two
of those at once — bring back what it displaced *and* remove what it added — and
a plain list of deleted items could not express that. If a restored highlight's
turn has scrolled out of the DOM in the meantime it stays in the record and the
toast says so; it repaints when that turn loads again.

## Naming your categories

The five colours are a taxonomy, so give them your own names. Hover a group
header in the side panel, click the pencil, type — <kbd>Enter</kbd> saves,
<kbd>Esc</kbd> cancels. "Blue" becomes "Methodology".

The name is then used everywhere that colour is named: the panel group headers,
the tray tooltips, the popup's filter labels, and the Markdown export headings.
Clearing the field reverts to the colour's own name, and a name you haven't set
is never stored.

Names live in `cp:labels`, are shared across all your conversations, and reach
other open ChatGPT tabs through `chrome.storage.onChanged` without a reload.

**The hexes are not editable.** They were picked and verified for contrast
against the dark text sitting on them and for separation from each other (see
[Colour](#colour)); letting them be changed would quietly break that. You rename
a category, you don't recolour it.

## The library

The panel and the popup only ever show the conversation you are in. The library
is every highlight you have ever made, across every chat, in one searchable
page. Open it from the library icon in the panel header or **Library** in the
popup.

- **Search** runs over passages *and* notes. Several words are AND-ed and may be
  split between the two, so `gate March` finds a passage about the gate whose
  note mentions March. `"a quoted phrase"` is matched whole. Matches are
  marked in the results so you can see why something is in the list.
- **Filter** by category, and by who wrote it.
- **Group by chat** (reading order within each) or **by category** (your
  Architecture notes from every conversation together). Whichever one the
  heading is not already saying, each card names the other — so grouped by
  category you still see which chat a passage came from.
- **Open in chat** opens the conversation and scrolls to that exact passage.

It is read-only: editing stays where the passage is. The page updates itself
when you highlight something in another tab, so it can be left open.

## Getting things out

Anything you have marked can leave the extension, in two different shapes.

**Markdown**, for reading and pasting into a document. The popup exports the
conversation you are in; the library exports whatever the current search and
filters are showing, grouped by category or by chat. Passages become
blockquotes under their category or chat heading, with notes in italics.

**A backup**, for keeping. **Back up** in the library writes every conversation
and your category names to one JSON file. **Restore** reads one back and asks
before writing anything:

- **Merge** keeps everything you have and adds only highlights whose id is not
  already there. Restoring the same file twice changes nothing the second time.
- **Replace** takes the backup's version of the conversations it names, and
  leaves every conversation it does not mention alone.

The index is rebuilt from the restored records rather than trusted from the
file, and a backup written by a newer version of StudyPlug is refused outright
rather than half-read.

## The toolbar popup

The StudyPlug icon in the browser toolbar opens a second, flatter view of the
same highlights — one list, newest first, rather than grouped by colour. It is
the quicker way to skim what you marked most recently, and it is where the
export lives:

- **colour dots** filter the list to one colour; the count reads `3 of 12`
- clicking an entry jumps to that passage and closes the popup
- **Open in chat** hands you over to the side panel
- **Copy all** puts every passage on the clipboard as plain text, oldest first,
  each with its note on the line below
- **Export .md** downloads a Markdown file: a title, the count and date, then
  each passage as a blockquote under a **ChatGPT · Methodology** style label
  (using your category names), notes in italics, separated by rules
- **Clear** asks once, then removes every highlight in the conversation

Both views sit on the same records, and the content script is the only thing
that writes them — so anything you change in the popup is already applied to the
page and the panel by the time it closes.

## How highlights survive

ChatGPT is a React single-page app: it swaps conversations without a reload and
rebuilds message turns from scratch. Storing a DOM path would break on the first
re-render, so a highlight is stored as a character range inside one turn:

```js
{ id, msgId, role, turn, start, end, text, color, note, ts }
```

- **`msgId`** is ChatGPT's own `data-message-id`, which is server-assigned and
  stable across reloads.
- **`turn`** is where that message sat in the conversation when the highlight
  was made. It is only a fallback for ordering lists when the turn is not
  currently in the DOM; the live position wins whenever it is available.
- **`start` / `end`** are offsets into the concatenated text of that turn.
  Wrapping text in `<mark>` doesn't change `textContent`, so the offsets stay
  valid no matter how many highlights are painted.
- **`text`** is the verification copy. Before painting, the stored text is
  checked against what is actually at those offsets. If a turn was edited or
  regenerated and the passage moved, the nearest matching occurrence is used and
  the corrected offsets are written back. If the passage is gone entirely,
  nothing is painted — a missing highlight beats a misplaced one.

A `MutationObserver` re-paints anything React removes, and also catches older
turns as they lazy-load when you scroll up.

Highlights spanning `<strong>`, `<code>` or list-item boundaries are painted as
several `<mark>` fragments, because `Range.surroundContents()` throws on any
selection that crosses an element edge.

Those fragments deliberately skip **collapsible whitespace**. A selection
dragged across list items also covers the newline and indent between `</li>`
and `<li>`, which normally renders as nothing. Wrapping it puts an inline box
between two block boxes, so the browser builds an anonymous line box to hold it
and a blank line opens up in the middle of the list. Inside `<pre>` the same
characters are real content, so they are still painted — otherwise a highlight
across a code block comes out full of holes. See `isCollapsedGap` in
`src/content/anchor.js`.

## Colour

The ink is **opaque**, and the text sitting on it is dark, in both themes. A
highlight therefore looks identical whether ChatGPT is in light or dark mode.

This is not just a style preference. A translucent wash under white text has a
hard ceiling in dark mode: the composited band has to stay dark enough for the
white text on top of it to stay readable, which caps how much colour any ink can
carry. Every colour converges toward the same muddy grey-brown, and yellow and
green stop being tellable apart. Measured as CIE76 ΔE, the closest pair in that
scheme sat at **21.5** — under the ~25 mark where two colours read as "similar"
at a glance.

Opaque ink removes the ceiling, because the text on the highlight is dark rather
than white. The same five colours now separate at **ΔE 53.2** at their closest,
and text contrast on the ink runs 5.49:1 (purple) to 10.90:1 (yellow) — all
above WCAG AA, and the same figures in both themes.

The stroke keeps a soft top and bottom edge and stands slightly proud of the
glyphs, so it still reads as laid-down ink rather than a filled rectangle. The
band never becomes fully transparent, so no glyph is ever left sitting on the
bare page.

## Where the tray appears

The tray opens **below** the selection. ChatGPT shows its own "Ask ChatGPT"
bubble above a selection, so anchoring above would put the two on top of each
other. It only flips above when there is no room below, and pins inside the
viewport if neither side fits — see `place()` in `src/content/ui.js`.

## Storage and permissions

The extension asks for `storage` and `unlimitedStorage`, plus host access to
`chatgpt.com` and `chat.openai.com`. There is no network code in it: everything
stays in `chrome.storage.local` on your machine, and nothing is sent anywhere.

```
cp:conv:<conversationId>  →  { convId, title, url, updated, items: [...] }
cp:index                  →  { <conversationId>: { title, url, count, updated } }
cp:labels                 →  { <colourKey>: "your name" }, only the renamed ones
cp:panelOpen              →  boolean, whether the side panel is showing
```

Clearing every highlight in a conversation deletes its record outright.

The `cp:` prefix predates the rename to StudyPlug. It is kept deliberately:
those keys hold real highlights, and renaming them without a migration would
orphan every mark already made. The `cp-` CSS classes and data attributes are
kept aligned with it. Backups written under the old name are still readable.

`unlimitedStorage` lifts the 10MB default that writes would otherwise start
failing against — silently — once enough conversations are marked.

`cp:index` names every conversation that has highlights. The library reads it
to know which records to load, rather than `storage.get(null)` — everything
else in there (`cp:labels`, `cp:panelOpen`) is not a conversation and would
only have to be filtered back out again.

## Typing inside the extension's own UI

ChatGPT focuses its composer as soon as it sees a keystroke that is not already
going into a field. It cannot see into StudyPlug's shadow roots: from a listener
on the page, an event raised inside one **retargets to the host**, which is a
plain `<div>`. So the page concludes nobody is typing, pulls focus to "Ask
anything" mid-word, and the rename box loses what you wrote.

A listener on the field itself cannot stop that — the page acts in the capture
phase, long before the event reaches the field. The guard therefore sits on
`window` in the capture phase (`typingInOurUi` in `src/content/main.js`), ahead
of the page's own document-level handler, and uses `composedPath()` to see
through the shadow boundary the page cannot.

Two details it depends on:

- <kbd>Enter</kbd>, <kbd>Esc</kbd> and <kbd>Tab</kbd> are let through. Stopping a
  capture-phase event halts it *before* the target, so swallowing these would
  mean the rename box never sees its own Enter. None of them are what makes the
  page grab focus; typing is.
- Focus leaving the rename box only saves when it moved somewhere inside the
  panel. If the page takes it, the field stays open holding what you typed,
  rather than storing half a word or wiping the name with an empty one.
## Layout

```
manifest.json            MV3 manifest
src/shared/              loaded by content scripts AND extension pages, so none
                         of it may assume a ChatGPT page
  palette.js             the five colours + custom category names
  records.js             the storage layout and its readers
  search.js              query parsing, matching, match marking
  export.js              Markdown, backup, and the restore planner
src/content/
  core.js                namespace, palette, shared helpers
  anchor.js              selection → stored range, painting it back, reading order
  store.js               conversation identity (the rest is shared/records.js)
  undo.js                the undo stack (DOM work injected, so it is testable)
  ui.js                  floating tray (shadow DOM)
  panel.js               in-page side panel (shadow DOM)
  main.js                events, state, panel API, popup channel
  content.css            how a mark looks on the page
src/popup/               toolbar popup: flat list, filters, export
src/library/             the cross-conversation library page
src/background/          service worker: context menu + opening the library
test/                    tests: anchoring, ordering, palette, undo, search,
                         export, backup/restore
```

`main.js` owns the state; the panel reads through a small API it is handed at
startup (`items`, `jump`, `peek`, `copy`, `setColor`, `setNote`, `remove`)
rather than reaching into it. Every mutation goes through `persist()`, which
saves and re-renders the panel, so the painted DOM, storage and every list stay
in step.

The library is read-only over the same records, and a service worker exists only
because a content script cannot open a tab itself.

## Tests

```bash
npm install
npm run check   # lint + tests
```

Eighty-one tests cover the parts most likely to break: painting across element
boundaries, leaving message text byte-identical, exact DOM restoration on
removal, repainting after a simulated re-render, re-anchoring after a turn is
regenerated, refusing to paint when the passage no longer exists, sorting into
reading order — including the case where only part of a long conversation is
loaded — and not opening blank lines when a highlight runs across list items,
while still painting the whitespace inside a code block, and searching — term
splitting, quoted phrases, matching across a passage and its note, and
rebuilding the text exactly when marking the matched runs. Export and backup
add Markdown shape, the refusal paths for a malformed or too-new backup file,
and a merge that stays idempotent when the same backup is restored twice.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). There is no build step: what is in
`src/` is what runs. `npm run check` runs the linter and the tests.

The one thing worth reading before changing anything: load order *is* the
dependency graph here, and it is declared in two places that have to agree —
`content_scripts.js` in the manifest, and the `<script>` tags in the popup
and library pages.

## Known limits

- **Only `/c/<id>` conversations.** A brand-new chat has no id until you send the
  first message; highlights become available once ChatGPT assigns one.
- **Highlights do not follow a conversation across devices** — storage is local.
  Switch `chrome.storage.local` to `chrome.storage.sync` in `store.js` to change
  that, at the cost of a ~100KB quota.
- **A regenerated answer loses its highlights** if the wording changed enough
  that the stored text no longer appears.
- **Highlights in turns that have not lazy-loaded** sort as a block at the end
  of their colour group, and **Go to text** reports that the turn is not on
  screen. Scroll up to load the older turns and both resolve. ChatGPT exposes no
  stable turn number, so there is no way to place an unloaded turn correctly
  among loaded ones — see `inReadingOrder` in `src/content/anchor.js`.
- **The panel overlays the page.** On a narrow window it will sit over the
  conversation; close it with <kbd>Alt</kbd>+<kbd>H</kbd>.
- **Firefox** needs `browser_specific_settings.gecko.id` added to the manifest;
  everything else is standard MV3.
- **Opening the library repeatedly opens new tabs** rather than focusing the one
  already open. Focusing an existing tab would need the `tabs` permission, and
  it did not seem worth asking for that.

## Licence

MIT — see [LICENSE](LICENSE).

