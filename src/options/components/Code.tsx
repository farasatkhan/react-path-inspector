import React from "react";
import { type ThemeTokens } from "../theme";

export function Code({ children, t }: { children: React.ReactNode; t: ThemeTokens }) {
  return <code className={t.code}>{children}</code>;
}
