# Marp Live for Obsidian

The **live version of [Marp](https://github.com/marp-team/marp)** for Obsidian: present your Markdown notes comfortably in the **browser** — fullscreen, one slide at a time, with **live reload** while you edit.

Built on [`@marp-team/marp-core`](https://github.com/marp-team/marp-core).

## What it does

- Adds a **Present** button (the `presentation` icon) to Obsidian's left toolbar.
- It does **not** render slides inside Obsidian. Instead, it starts a **local server** (e.g. `http://127.0.0.1:3773/`) and opens it in your browser.
- The viewer shows **one slide at a time, fullscreen**, with arrow buttons in a bottom bar, keyboard navigation (←/→/Space), touch swipe, side-click navigation, a fullscreen toggle and a print button.
- **Live reload**: edit the `.md` in Obsidian and the browser updates instantly, keeping your current slide.
- Keeps handy **export commands**: standalone HTML, PDF via the browser print dialog, copy URL, open/stop server.

## Slide separator

Same as Marp: three dashes on their own line.

````markdown
---
marp: true
theme: default
paginate: true
---

# Title

---

# Second slide
````

If a note has no front-matter, the plugin injects `marp: true` + the configured theme automatically.

## Install

### From source

```bash
git clone https://github.com/shawnpinciara/obsidian-marp-live.git
cd obsidian-marp-live
npm install
npm run build   # outputs main.js
```

Copy `manifest.json`, `main.js` and `styles.css` into `<vault>/.obsidian/plugins/marp-live/`, then enable **Marp Live** under Settings → Community plugins (desktop only).

## Usage

1. Open any Markdown note.
2. Click **Present** in the left toolbar (or run `Present current note with Marp` from the command palette).
3. The browser opens the live deck. Edit the note in Obsidian and watch the slides update.

## Commands

- Present current note with Marp
- Stop the presentation server
- Open the presentation in the browser
- Export current note as HTML (standalone Marp) → writes `<note>.slides.html` next to the note
- Export as PDF (opens the print view in the browser) → then Print → Save as PDF
- Copy presentation URL

## Settings

- Local server port (default `3773`, auto-tries the next 20 if busy)
- Marp theme: `default` / `gaia` / `uncover` (per-note override via `theme:` front-matter)
- Allow HTML in Markdown
- Auto-open browser on Present

## How it works

- `src/marp.ts` — renders Markdown with `@marp-team/marp-core`.
- `src/server.ts` — tiny dependency-free local HTTP server (`node:http`, available in Obsidian's Electron): serves the viewer, a `/__deck` JSON endpoint and a `/__events` SSE stream for live reload.
- `src/viewer.ts` — self-contained fullscreen viewer: one slide visible at a time, bottom control bar, keyboard/touch support, print stylesheet for PDF export.
- `src/main.ts` — Obsidian glue: ribbon button, commands, settings tab, live update on vault/editor changes, HTML export.

## License

MIT. Marp itself is by the [marp-team](https://github.com/marp-team/marp) (MIT).
