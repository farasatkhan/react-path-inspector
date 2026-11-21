import React, { useState } from "react";
import { parseShortcut, prettyShortcut } from "../../utils";
import { T_BASE } from "../theme";

const IGNORED_KEYS = new Set([
  "Shift",
  "Control",
  "Alt",
  "Meta",
  "CapsLock",
  "NumLock",
  "ScrollLock",
  "ContextMenu",
  "Dead",
]);

function eventToStorage(event: React.KeyboardEvent<HTMLInputElement>): string | null {
  const tokens: string[] = [];
  if (event.metaKey) tokens.push("mod");
  if (event.ctrlKey && !event.metaKey) tokens.push("ctrl");
  if (event.altKey) tokens.push("alt");
  if (event.shiftKey) tokens.push("shift");
  tokens.push(event.key.toLowerCase());
  const stored = tokens.join("+");
  return parseShortcut(stored) ? stored : null;
}

export function ShortcutInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const [recording, setRecording] = useState(false);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!recording) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.key === "Escape" || event.key === "Backspace") {
      setRecording(false);
      return;
    }
    if (IGNORED_KEYS.has(event.key)) return;
    const stored = eventToStorage(event);
    if (!stored) return;
    setRecording(false);
    onChange(stored);
  };

  return (
    <input
      type="text"
      readOnly
      className={T_BASE.monoInput + " w-44 cursor-pointer text-center"}
      value={recording ? "Press keys…" : prettyShortcut(value)}
      onFocus={() => setRecording(true)}
      onBlur={() => setRecording(false)}
      onKeyDown={handleKeyDown}
    />
  );
}
