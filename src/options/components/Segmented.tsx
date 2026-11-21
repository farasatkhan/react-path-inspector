import React from "react";
import { T_BASE, type ThemeTokens } from "../theme";

export function Segmented({
  value,
  options,
  onChange,
  t,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  t: ThemeTokens;
}) {
  return (
    <div className={T_BASE.segmented + " " + t.segmented}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={
            T_BASE.segmentedBtn +
            " " +
            (value === option.value ? t.segmentedBtnActive : t.segmentedBtnIdle)
          }
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
