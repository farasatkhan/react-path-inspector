import React from "react";
import { T_BASE, type ThemeTokens } from "../theme";

export function Section({
  title,
  description,
  children,
  t,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  t: ThemeTokens;
}) {
  return (
    <section className={T_BASE.card + " " + t.card}>
      <h2 className={T_BASE.heading + " " + t.heading}>{title}</h2>
      {description ? <p className={"mt-0.5 " + T_BASE.desc + " " + t.desc}>{description}</p> : null}
      <div className="mt-2 divide-y divide-[rgba(127,127,127,0.12)]">{children}</div>
    </section>
  );
}
