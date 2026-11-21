# React Path Inspector

A Chrome extension for Next.js App Router development with Turbopack. It
shows the React component path from the root down to the element you hover
or right-click, reads props at any level, opens components in VS Code or
Cursor, and copies everything as AI-ready context.

Target stack: React 19, Next.js App Router with Turbopack, dev builds.
Manifest V3.

## Install

1. `yarn install && yarn build`
2. Open `chrome://extensions`, enable Developer mode, click **Load unpacked**,
   select the `dist/` folder.
3. Open your Next.js app on `localhost` (any port) or `127.0.0.1`.

## Use

Right-click any element on an allowed page:

- **Select React component…** opens the on-page path bar. Chips show the
  filtered path with the nearest component selected. `↑` moves to the parent,
  `↓` moves back down (only along the clicked path; to reach another branch,
  right-click again). `Enter` or **Copy** copies from the root to the
  selected component only: nothing below the selection, and no
  clicked-element block (selecting the nearest component keeps it).
  `Esc`, the ✕ button, an outside click, a route change or a navigation
  closes the bar. A highlight box shows the selected component's DOM output.
  The **Props** toggle opens a panel showing the selected component's props,
  serialized with the same limits and redaction as a copy, refreshed from
  the live fiber on every selection change.
- **Copy React path as Markdown / as JSON** copies immediately in that
  format, targeting the nearest component.
- **Debug: log fiber info to console** dumps the raw unfiltered path and
  every fiber's `_debugInfo` to the page console.

## Inspect modes

Two hover-driven modes are toggled with keyboard shortcuts (defaults, both
rebindable on the options page; press the same keys again or `Esc` to leave
a mode):

- **Open in editor (`Ctrl+Shift+X`).** Hovering highlights the element under
  the cursor (blue) and the component that owns it (green), each labeled with
  its source location and pixel size. Clicking opens that source file in
  VS Code or Cursor at the exact line, in the window you already have open
  (Chrome asks once per site to allow the `vscode://` or `cursor://` link;
  allow it and later opens are silent). A successful open ends the mode.
- **Select component (`Ctrl+Shift+Z`).** Same hover language; clicking feeds
  the hovered component into the path bar, like the context menu does, so you
  can walk the path without right-clicking.

Source locations come from React's development info, resolved in layers:
`_debugSource` when the framework provides it (React 18-style dev builds),
otherwise the fiber's `_debugStack` frames, scanning for the first usable
file path. Elements created by libraries through `createElement` carry no
source of their own; the inspector then walks up to the nearest component
in the fiber tree with resolvable source, which is the place in your code
that renders them. On Next.js with Turbopack the chunk filenames encode the
module path (`src_app_signup_signup-form_tsx_...` →
`src/app/signup/signup-form.tsx`) and the chunk's index source map gives
the exact line and column inside that file. Server-rendered elements
(everything your page and layout components render directly) carry
virtualized stack frames that the inspector resolves through the Next dev
server's original-stack-frames endpoint, so hovering a page-level wrapper
opens the page or layout file at the line that renders it. On a production
build there is no source info and a click explains that in a toast instead
of opening the wrong file.

Because dev servers report project-relative paths, the options page has a
project root setting: a default plus per-site overrides (matched with the
port, e.g. `http://localhost:3002`). Windows paths are normalized to
`vscode://file/D:/...` URLs automatically.

Server Components appear as `Name (server)`. Their props are shown from
`_debugInfo` when React exposes them; otherwise the node says
`props: [not available on client]`. `Suspense` boundaries stay in the path;
where a component streams is real structure. Next.js's internal error
boundaries (the `ErrorBoundary` wrappers it puts around every route segment)
are filtered out; your own `ErrorBoundary` components are kept. When a path
has no DOM output (for example a component that renders nothing), its chip
says `no DOM output` and no highlight box is drawn.

## What is captured, and what is not

**Function component hooks are not captured.** A client component that uses
`useState` will not show a `state` section. Only class components get one,
read from `memoizedState`. If a component's block has no `state` section,
that means "hooks are not captured", **not** "the component has no state".
The JSON output reserves the `state` and `context` keys for a future hooks
inspector.

## Redaction

Redaction is on by default, in layers: sensitive keys (`accessToken`,
`api_key`, `password`, `secret`, `authorization`, `cookie`, matched as
whole words or camelCase segments, so `userAccessToken` matches but the
bare word `key` does not), and value detection regardless of key name
(JWTs, `Bearer …`, long hex/base64 strings, `sk-`/`ghp_`/`AKIA` prefixes).
Personal data redaction (email, phone, address, ssn) is opt-in.

Every built-in key can be switched off individually on the options page
(all are on by default, and your choices persist).

**Redaction catches common mistakes; it is not a guarantee.** Always review
the copied output in the toast or your clipboard before pasting it anywhere.
The options page shows the full set of redaction rules: built-in keys, value detection patterns, and your extra keys.

## Settings

Open the options page from the toolbar icon. Everything writes straight to
`chrome.storage.local` (not `sync`, so project-specific lists stay local):

- Theme of the extension's own UI (path bar, highlight, toast, options
  page): System, Light or Dark. Light is the default; System follows your
  OS preference live
- Default format, header line, note field; the note is multiline:
  Shift+Enter adds a line, Enter copies
- Size budget and per-prop limits (depth, string length, item count)
- Redact keys as one editable, saved list: built-in keys left out of the
  list are disabled, anything unknown is treated as an extra key
- Show everything (disables the noise filter), debug logging
- Open in editor: VS Code or Cursor, a default project root and per-site
  roots, and the two inspect-mode shortcuts (click a shortcut field and
  press the combination to rebind it)
- Allowed origins: `localhost` and `127.0.0.1` are included by default and
  every origin is configurable: paste many at once (one per line) to add
  them with a single permission prompt, and removing one revokes both the
  permission and its content scripts. The background worker re-syncs
  registrations from your saved list on every browser start. Pages open
  during a change need a reload.
- Reset to defaults

## Development

- `yarn build`: one-shot production build into `dist/`
- `yarn watch`: rebuild on change (reload the extension after builds)

Pure logic (filter, serializer, redaction, budget, formatters) lives in
`src/core/` with no browser APIs, so unit tests can be added cheaply. A
hidden debug setting logs the raw unfiltered path, to tell apart a filter
bug, a serializer bug and a fiber-read bug.

Prop reading is wrapped in try/catch so no single prop can break a copy.
Re-check after React or Next.js upgrades: fiber shapes and `_debugInfo`
contents can change between releases.

## Limitations

- Next.js App Router with Turbopack is the supported target. Other bundlers
  (Vite, CRA, plain webpack) and React 18 are untested and not a support
  goal; parts of the resolver handle them, but that is best-effort.
- Dev builds are the supported case. On a production build the component
  names are minified; the output carries a warning when that is detected,
  and the inspect modes have no source info to open.
- Function component hooks and named context values are not captured yet.
- Editor opens rely on the `vscode://` / `cursor://` protocol handlers being
  registered by the editor itself; Chrome shows a one-time allow prompt per
  site.
- Elements created by third-party packages with `createElement` resolve to
  the nearest component in your own code that renders them, not into the
  package source.
