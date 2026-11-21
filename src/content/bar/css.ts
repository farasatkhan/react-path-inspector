
export const BAR_CSS = `
:host { all: initial; }
.rpc-theme-dark {
  --accent: #3e63dd;
  --accent-hover: #5272e6;
  --success: #30a46c;
  --warning: #ffb224;
  --text-1: rgba(255, 255, 255, 0.92);
  --text-2: rgba(255, 255, 255, 0.64);
  --text-3: rgba(255, 255, 255, 0.4);
  --border: rgba(255, 255, 255, 0.08);
  --border-strong: rgba(255, 255, 255, 0.14);
  --panel: #17181a;
  --panel-inset: rgba(0, 0, 0, 0.25);
  --chip-bg: rgba(255, 255, 255, 0.07);
  --chip-bg-hover: rgba(255, 255, 255, 0.11);
  --chip-border: rgba(255, 255, 255, 0.1);
  --kbd-bg: rgba(255, 255, 255, 0.06);
  --kbd-text: rgba(255, 255, 255, 0.75);
  --hint-text: rgba(255, 255, 255, 0.65);
  --sep-text: rgba(255, 255, 255, 0.45);
  --logo-text: rgba(255, 255, 255, 0.6);
  --server-mod-text: rgba(255, 255, 255, 0.4);
  --selected-server-mod: rgba(255, 255, 255, 0.72);
  --bar-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.06),
    0 2px 8px rgba(0, 0, 0, 0.3),
    0 12px 32px rgba(0, 0, 0, 0.42);
  --btn-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.12), 0 1px 2px rgba(0, 0, 0, 0.35);
}
.rpc-theme-light {
  --accent: #3e63dd;
  --accent-hover: #5272e6;
  --success: #1a7f4b;
  --warning: #d97706;
  --text-1: rgba(17, 19, 23, 0.92);
  --text-2: rgba(17, 19, 23, 0.62);
  --text-3: rgba(17, 19, 23, 0.42);
  --border: rgba(17, 19, 23, 0.12);
  --border-strong: rgba(17, 19, 23, 0.2);
  --panel: #ffffff;
  --panel-inset: rgba(17, 19, 23, 0.04);
  --chip-bg: rgba(17, 19, 23, 0.05);
  --chip-bg-hover: rgba(17, 19, 23, 0.09);
  --chip-border: rgba(17, 19, 23, 0.12);
  --kbd-bg: rgba(17, 19, 23, 0.05);
  --kbd-text: rgba(17, 19, 23, 0.75);
  --hint-text: rgba(17, 19, 23, 0.6);
  --sep-text: rgba(17, 19, 23, 0.35);
  --logo-text: rgba(17, 19, 23, 0.6);
  --server-mod-text: rgba(17, 19, 23, 0.55);
  --selected-server-mod: rgba(44, 75, 192, 0.75);
  --bar-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.6),
    0 1px 2px rgba(17, 19, 23, 0.1),
    0 8px 24px rgba(17, 19, 23, 0.12);
  --btn-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.18), 0 1px 2px rgba(17, 19, 23, 0.2);
}
.rpc-bar {
  font: 13px/1.45 "Inter", system-ui, -apple-system, "Segoe UI", sans-serif;
  color: var(--text-1);
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 10px;
  max-width: 680px;
  box-shadow: var(--bar-shadow);
  animation: rpc-bar-in 160ms cubic-bezier(0.16, 1, 0.3, 1);
  user-select: none;
}
@keyframes rpc-bar-in {
  from { opacity: 0; transform: translateY(6px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
@media (prefers-reduced-motion: reduce) {
  .rpc-bar { animation: none; }
}

.rpc-bar-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.rpc-bar-title {
  display: flex; align-items: center; gap: 7px;
  font-size: 12px; font-weight: 500; color: var(--text-2); letter-spacing: -0.01em;
}
.rpc-bar-logo { width: 14px; height: 14px; color: var(--logo-text); display: block; }
.rpc-bar-close {
  all: unset; cursor: pointer; margin-left: auto;
  width: 22px; height: 22px; display: grid; place-items: center;
  color: var(--text-3); border-radius: 6px;
  transition: background 120ms ease, color 120ms ease;
}
.rpc-bar-close:hover { color: var(--text-1); background: var(--chip-bg-hover); }
.rpc-bar-close:focus-visible { outline: 1.5px solid var(--accent); outline-offset: 1px; }
.rpc-bar-close svg { width: 12px; height: 12px; display: block; }

.rpc-bar-chips { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; }
.rpc-sep { color: var(--sep-text); font-size: 13px; padding: 0 2px; user-select: none; }
.rpc-chip {
  all: unset; cursor: pointer; padding: 5px 11px; border-radius: 8px;
  background: var(--chip-bg);
  border: 1px solid var(--chip-border);
  color: var(--text-2); font-size: 13px; font-weight: 500; letter-spacing: -0.01em;
  transition: background 120ms ease, border-color 120ms ease, color 120ms ease;
}
.rpc-chip:hover {
  background: var(--chip-bg-hover);
  border-color: var(--border-strong);
  color: var(--text-1);
}
.rpc-chip:focus-visible { outline: 1.5px solid var(--accent); outline-offset: 1px; }
.rpc-chip-server-mod { color: var(--server-mod-text); font-weight: 400; }

/* Selected chip: solid accent in dark (matches the Radix dark active pill),
   tinted accent in light (matches the Radix light active pill). */
.rpc-chip-selected {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}
.rpc-chip-selected:hover {
  background: var(--accent-hover);
  border-color: var(--accent-hover);
  color: #fff;
}
.rpc-chip-selected .rpc-chip-server-mod { color: var(--selected-server-mod); }
.rpc-theme-light .rpc-chip-selected {
  background: rgba(62, 99, 221, 0.1);
  border-color: rgba(62, 99, 221, 0.45);
  color: #2c4bc0;
}
.rpc-theme-light .rpc-chip-selected:hover {
  background: rgba(62, 99, 221, 0.15);
  border-color: rgba(62, 99, 221, 0.55);
  color: #2c4bc0;
}
.rpc-theme-light .rpc-chip-selected .rpc-chip-server-mod { color: rgba(44, 75, 192, 0.65); }
.rpc-chip-nodom {
  display: inline-flex; align-items: center; gap: 4px;
  color: var(--text-2); font-size: 12px; margin-left: 3px;
}
.rpc-chip-nodom-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--warning); flex: none; }

.rpc-bar-note {
  all: unset; display: block; margin-top: 8px; width: calc(100% - 18px);
  background: var(--panel-inset);
  border: 1px solid var(--border);
  border-radius: 8px; padding: 6px 9px; color: var(--text-1);
  font: 13px/1.4 "Inter", system-ui, -apple-system, "Segoe UI", sans-serif;
  resize: none;
  overflow-y: auto;
  transition: border-color 120ms ease, background 120ms ease;
}
.rpc-bar-note::placeholder { color: var(--text-3); }
.rpc-bar-note:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(62, 99, 221, 0.15);
}

.rpc-bar-actions { display: flex; align-items: center; gap: 12px; margin-top: 10px; }
.rpc-bar-copy {
  all: unset; cursor: pointer;
  display: inline-flex; align-items: center; gap: 7px;
  padding: 5px 13px; border-radius: 8px;
  background: var(--accent); color: #fff; font-size: 13px; font-weight: 600;
  box-shadow: var(--btn-shadow);
  transition: background 120ms ease, transform 80ms ease;
}
.rpc-bar-copy:hover { background: var(--accent-hover); }
.rpc-bar-copy:active { transform: translateY(0.5px); }
.rpc-bar-copy:focus-visible { outline: 1.5px solid var(--accent-hover); outline-offset: 1.5px; }
.rpc-bar-copy svg { width: 13px; height: 13px; display: block; }
.rpc-bar-copied, .rpc-bar-copied:hover { background: var(--success); }
.rpc-props-toggle {
  all: unset; cursor: pointer;
  display: inline-flex; align-items: center;
  padding: 5px 11px; border-radius: 8px;
  background: var(--chip-bg); border: 1px solid var(--chip-border);
  color: var(--text-2); font-size: 12.5px; font-weight: 500;
  transition: background 120ms ease, border-color 120ms ease, color 120ms ease;
}
.rpc-props-toggle:hover { background: var(--chip-bg-hover); border-color: var(--border-strong); color: var(--text-1); }
.rpc-props-toggle:focus-visible { outline: 1.5px solid var(--accent); outline-offset: 1px; }
.rpc-props-toggle-active { background: var(--accent); border-color: var(--accent); color: #fff; }
.rpc-props-toggle-active:hover { background: var(--accent-hover); border-color: var(--accent-hover); color: #fff; }

.rpc-props-panel {
  margin-top: 8px;
  background: var(--panel-inset);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px 10px;
  max-height: 160px;
  overflow-y: auto;
  animation: rpc-bar-in 160ms cubic-bezier(0.16, 1, 0.3, 1);
}
.rpc-props-header {
  font-size: 11px; font-weight: 500; color: var(--text-3);
  margin-bottom: 4px; letter-spacing: 0.01em;
}
.rpc-props-text {
  margin: 0;
  font: 11.5px/1.5 ui-monospace, "SFMono-Regular", Consolas, monospace;
  color: var(--text-2);
  white-space: pre-wrap;
  word-break: break-word;
}

.rpc-bar-hints {
  margin-left: auto; display: inline-flex; align-items: center; gap: 10px;
  color: var(--hint-text); font-size: 11.5px;
}
.rpc-hint { display: inline-flex; align-items: center; gap: 4px; }
.rpc-kbd {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 18px; height: 17px; padding: 0 4px; border-radius: 4px;
  background: var(--kbd-bg);
  border: 1px solid var(--border); border-bottom-width: 2px;
  font: 11px/1 ui-monospace, "SFMono-Regular", Consolas, monospace;
  color: var(--kbd-text);
}
.rpc-kbd svg { width: 10px; height: 10px; display: block; }
`;
