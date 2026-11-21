import React from "react";
import { T_BASE, type ThemeTokens } from "../theme";

export function Row({
  label,
  hint,
  children,
  t,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  t: ThemeTokens;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <div>
        <div className={T_BASE.label + " " + t.label}>{label}</div>
        {hint ? <div className={"mt-0.5 " + T_BASE.desc + " " + t.desc}>{hint}</div> : null}
      </div>
      {children}
    </div>
  );
}
