import React from "react";
import { type ThemeTokens } from "../theme";

export function Toggle({
  checked,
  onChange,
  label,
  t,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  t: ThemeTokens;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={
        "relative inline-flex h-5 w-9 flex-none items-center rounded-full border transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5272e6] " +
        (checked
          ? "border-transparent bg-[#3e63dd] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
          : t.toggleOffTrack)
      }
    >
      <span
        className={
          "inline-block h-3.5 w-3.5 rounded-full transition-transform duration-150 " +
          (checked ? "translate-x-[18px] bg-white" : "translate-x-[3px] " + t.toggleOffKnob)
        }
      />
    </button>
  );
}
