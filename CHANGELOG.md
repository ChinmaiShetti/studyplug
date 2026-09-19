# Changelog

Notable changes to StudyPlug. Dates are ISO.

## 1.0.0 — 2026-09-19

First release.

### Highlighting
- Mark any passage in a ChatGPT message in one of five colours, from a tray that
  opens below the selection (ChatGPT's own "Ask ChatGPT" bubble sits above it).
- <kbd>Alt</kbd>+<kbd>1</kbd>…<kbd>5</kbd>, or right-click → **Highlight with
  StudyPlug**.
- Notes on any passage.
- Highlights survive reloads, ChatGPT's re-renders and conversation switching.
  They are stored as character ranges against ChatGPT's own message ids, and
  re-anchor themselves if a turn is edited or regenerated.

### Organising
- Rename the five colours to your own categories; the names drive the panel,
  the filters and the exports.
- A side panel (<kbd>Alt</kbd>+<kbd>H</kbd>) listing the conversation's
  highlights grouped by category, in reading order, with jump-to-passage.
- Multi-select for bulk recolour, copy and delete; `j`/`k`/`g` to move around.
- Undo for every destructive action, including bulk ones.

### Across conversations
- A library page: every highlight from every chat, searchable over passages and
  notes, filterable by category and author, groupable by chat or by category.
- Deep links back to the exact passage in the source conversation.

### Getting things out
- Markdown export, grouped by category or by chat.
- Backup and restore as JSON, with merge or replace and an idempotent merge.

### Accessibility
- Every ink/text pairing clears WCAG AA (5.49:1 to 10.90:1), identical in light
  and dark mode; the five categories sit at ΔE 53.2 or more apart.
- Keyboard paths for every action, visible focus, reduced-motion respected.
