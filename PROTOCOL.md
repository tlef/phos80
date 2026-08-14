# Phosphor Protocol v1

The contract between a site's API and the Phosphor terminal UI. A backend in any language can speak it: it is JSON plus a small inline markup syntax. The framework renders docs; it never defines what they say.

## 1. Envelope

Every transport response resolves to:

```jsonc
{
  "ok": true,             // informational; errors are still docs
  "doc": { "widgets": [ /* Widget[] — what to display */ ] },
  "header": { "widgets": [ … ] }   // optional, see §4
}
```

- `header` present with a doc → replace the sticky header.
- `header: null` → restore the site's default header.
- `header` absent → leave the current header unchanged.
  (The same rules apply if `header` is placed on the doc itself.)

## 2. Widgets

A doc is `{ "widgets": Widget[] }`. Widgets stack vertically; layout is computed at the client's current column count, so the API never reasons about pixels or viewport sizes.

### text
```jsonc
{ "type": "text", "content": "BBCode string", "align": "left" }
```
`align`: `left` (default) | `center` | `right`. `\n` splits paragraphs; long lines word-wrap.

### frame
```jsonc
{ "type": "frame", "title": "NEWS", "border": "single", "color": "red", "children": [ Widget… ] }
```
Box-drawn border around its children. `border`: `single` (default) | `double`. `title` renders bold in the top border. `color` tints the border. Frames nest.

### columns
```jsonc
{ "type": "columns", "children": [ Widget… ], "widths": [3, 2], "gap": 2, "min": 24 }
```
Side-by-side children — the terminal's flexbox. Each child is one column, laid out independently at its column width. `widths` are relative weights. As many columns as fit at `min` width share a row; extras wrap to the next row; at narrow viewports everything stacks full-width.

### buttons
```jsonc
{ "type": "buttons", "align": "left", "items": [ { "label": "NEXT", "command": "news 2", "color": "brwhite" } ] }
```
Rendered as `[ NEXT ]`, clickable/focusable; clicking dispatches `command` (default: lowercased label). Rows pack greedily and wrap.

### rule
```jsonc
{ "type": "rule", "char": "─", "color": "cyan" }
```
Full-width horizontal line. Dimmed unless `color` given.

### spacer
```jsonc
{ "type": "spacer", "lines": 1 }
```
Blank rows.

Unknown widget types render as a visible inline error (they do not throw).

## 3. Inline markup (BBCode-style)

Used inside any `content` string. Whitelist-only; unknown or unmatched tags render as literal text; all output is HTML-escaped — there is no way for content to inject markup.

| Tag | Effect |
|---|---|
| `[red]…[/red]` etc. | color; names: `amber`, `black`, `red`, `green`, `yellow`, `blue`, `magenta`, `cyan`, `white`, `brblack`, `brred`, `brgreen`, `bryellow`, `brblue`, `brmagenta`, `brcyan`, `brwhite` |
| `[b]…[/b]` | bold |
| `[dim]…[/dim]` | faded |
| `[u]…[/u]` | underline |
| `[inv]…[/inv]` | inverse video |
| `[blink]…[/blink]` | blink (disabled under `prefers-reduced-motion`) |
| `[link=target]label[/link]` | link; see below |

Link targets:
- `https://…` / `http://…` → real anchor, opens in a new tab.
- `/path` → real same-site anchor (normal navigation).
- anything else (e.g. `help`, `news 2`) → dispatched as a command.

Tags nest and are restored on close (`[red]a [b]b[/b] c[/red]`). Styling survives word-wrap and alignment padding.

## 4. Header

The sticky strip above the screen, shown in **page mode**. It is an ordinary doc rendered without the typewriter effect. Responses install/replace/restore it via the `header` field (§1) — e.g. a news section installing a masthead that persists across its pages.

## 5. Display semantics (informative)

- **scroll mode**: each response appends to a scrollback (commands are echoed); **page mode**: each response replaces the screen, BBS-style. The mode is a client concern; the same docs work in both.
- Layout invariant: every rendered line is exactly the client's column count in visible characters; alignment and chrome are literal characters, so copied text pastes like real terminal output.
- Character widths are counted one cell per character (ASCII + box drawing). Emoji/CJK are not width-aware in v1.
