import React, { useCallback, useEffect, useState } from "react";
import { DEFAULT_SETTINGS, loadSettings, resetSettings, saveSettings } from "../shared/settings";
import { type EditorId, type Settings, type UiTheme } from "../definitions";
import { withTheme } from "../utils";
import { ReactLogo } from "./components/ReactLogo";
import { Code } from "./components/Code";
import { Toggle } from "./components/Toggle";
import { Segmented } from "./components/Segmented";
import { Row } from "./components/Row";
import { Section } from "./components/Section";
import { ShortcutInput } from "./components/ShortcutInput";
import { T_BASE, T_DARK, T_LIGHT, type ThemeTokens } from "./theme";
import { BUILT_IN_REDACT_KEYS } from "../core/redact";
import {
  normalizeOrigin,
  normalizeSiteKey,
  originToPattern,
  syncOriginRegistrations,
} from "../shared/origins";

type OriginStatus = "active" | "inactive" | "unknown";

interface OriginRow {
  origin: string;
  pattern: string;
  status: OriginStatus;
}

interface RootRow {
  site: string;
  root: string;
}

function redactKeysTextFor(settings: Settings): string {
  const enabledBuiltIns = BUILT_IN_REDACT_KEYS.filter(
    (builtin) => !settings.disabledRedactKeys.includes(builtin),
  );
  return [...enabledBuiltIns, ...settings.extraRedactKeys].join(", ");
}

export default function Options() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [originInput, setOriginInput] = useState("");
  const [originRows, setOriginRows] = useState<OriginRow[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [messageKind, setMessageKind] = useState<"info" | "success" | "error">("info");
  const [redactKeysText, setRedactKeysText] = useState("");
  const [rootSiteInput, setRootSiteInput] = useState("");
  const [rootPathInput, setRootPathInput] = useState("");
  const [systemDark, setSystemDark] = useState(
    typeof window !== "undefined" &&
      Boolean(window.matchMedia?.("(prefers-color-scheme: dark)").matches),
  );

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    mq.addEventListener("change", listener);
    return () => mq.removeEventListener("change", listener);
  }, []);

  useEffect(() => {
    void (async () => {
      const loadedSettings = await loadSettings();
      setSettings(loadedSettings);
      setRedactKeysText(redactKeysTextFor(loadedSettings));
      setLoaded(true);
    })();
  }, []);

  const refreshOriginRows = useCallback(async (current: Settings) => {
    const rows: OriginRow[] = [];
    for (const origin of current.allowedOrigins) {
      const pattern = originToPattern(origin);
      let status: OriginStatus = "unknown";
      if (pattern) {
        try {
          status = (await chrome.permissions.contains({ origins: [pattern] }))
            ? "active"
            : "inactive";
        } catch {
          status = "unknown";
        }
      }
      rows.push({ origin, pattern: pattern ?? "", status });
    }
    setOriginRows(rows);
  }, []);

  useEffect(() => {
    if (loaded) void refreshOriginRows(settings);
  }, [loaded, settings, refreshOriginRows]);

  const update = (partial: Partial<Settings>) => {
    setSettings((current) => {
      const next = { ...current, ...partial };
      void saveSettings(partial);
      return next;
    });
  };

  const flash = (text: string, kind: "info" | "success" | "error" = "info") => {
    setMessage(text);
    setMessageKind(kind);
    window.setTimeout(() => setMessage(null), 5000);
  };

  const addOrigin = async () => {
    const lines = originInput
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    if (lines.length === 0) {
      flash("Paste one origin per line, like https://dev.example.com (no path).", "error");
      return;
    }

    const invalid: string[] = [];
    const toAdd: string[] = [];
    const present = new Set(settings.allowedOrigins);
    for (const line of lines) {
      const normalized = normalizeOrigin(line);
      if (!normalized) {
        invalid.push(line);
        continue;
      }
      if (present.has(normalized)) continue;
      present.add(normalized);
      toAdd.push(normalized);
    }

    const invalidSummary = (count: number) => {
      const shown = invalid.slice(0, 3).map((line) => `"${line}"`).join(", ");
      return `Not valid URLs (skipped): ${shown}${count > 3 ? ` +${count - 3} more` : ""}`;
    };

    if (toAdd.length === 0) {
      if (invalid.length > 0) {
        flash(`${invalidSummary(invalid.length)}. Expected e.g. https://dev.example.com`, "error");
      } else {
        flash("All pasted origins are already in the list.", "info");
      }
      return;
    }

    try {
      const patterns = toAdd.map((origin) => originToPattern(origin) as string);
      const granted = await chrome.permissions.request({ origins: patterns });
      if (!granted) {
        flash("Permission was not granted.", "error");
        return;
      }
      const origins = [...settings.allowedOrigins, ...toAdd];
      update({ allowedOrigins: origins });
      await syncOriginRegistrations(origins);
      setOriginInput("");
      if (invalid.length > 0) {
        flash(
          `Added ${toAdd.length} origin${toAdd.length === 1 ? "" : "s"}. ${invalidSummary(invalid.length)} . Expected e.g. https://dev.example.com`,
          "error",
        );
      } else {
        flash(
          `Added ${toAdd.length} origin${toAdd.length === 1 ? "" : "s"}. Reload pages on those origins to use the extension.`,
          "success",
        );
      }
    } catch (error) {
      flash(`Could not add origins: ${String(error)}`, "error");
    }
  };

  const removeOrigin = async (origin: string, pattern: string) => {
    try {
      await chrome.permissions.remove({ origins: [pattern] });
    } catch (error) {
      flash(`Could not revoke permission: ${String(error)}`, "error");
    }
    const origins = settings.allowedOrigins.filter((o) => o !== origin);
    update({ allowedOrigins: origins });
    await syncOriginRegistrations(origins);
    flash(`Removed ${pattern}. Reload pages on that origin.`, "success");
  };

  const commitRedactKeys = () => {
    const parsed = [
      ...new Set(
        redactKeysText
          .split(",")
          .map((key) => key.trim())
          .filter((key) => key.length > 0),
      ),
    ];
    const disabled = BUILT_IN_REDACT_KEYS.filter(
      (builtin) => !parsed.some((key) => key.toLowerCase() === builtin.toLowerCase()),
    );
    const extras = parsed.filter(
      (key) =>
        !BUILT_IN_REDACT_KEYS.some((builtin) => builtin.toLowerCase() === key.toLowerCase()),
    );
    update({ disabledRedactKeys: disabled, extraRedactKeys: extras });
    flash("Redact keys saved.", "success");
  };

  const addProjectRoot = () => {
    const site = normalizeSiteKey(rootSiteInput);
    const root = rootPathInput.trim();
    if (!site) {
      flash("Enter the site as an origin, like http://localhost:3002 (no path).", "error");
      return;
    }
    if (!root) {
      flash("Enter the absolute path to the project folder on your machine.", "error");
      return;
    }
    const roots = { ...settings.projectRoots, [site]: root };
    update({ projectRoots: roots });
    setRootSiteInput("");
    setRootPathInput("");
    flash(`Project root saved for ${site}.`, "success");
  };

  const removeProjectRoot = (site: string) => {
    const roots = { ...settings.projectRoots };
    delete roots[site];
    update({ projectRoots: roots });
    flash(`Removed the project root for ${site}.`, "success");
  };

  const resolvedTheme: "light" | "dark" =
    settings.theme === "system" ? (systemDark ? "dark" : "light") : settings.theme;
  const t: ThemeTokens = resolvedTheme === "dark" ? T_DARK : T_LIGHT;
  const T = withTheme(T_BASE, t);
  const rootRows: RootRow[] = Object.entries(settings.projectRoots).map(([site, root]) => ({
    site,
    root,
  }));
  const rootPlaceholder = /^win/i.test(navigator.platform || navigator.userAgent)
    ? "D:\\_code\\my-app"
    : "/Users/me/my-app";

  if (!loaded) {
    return (
      <div className={T.page + " grid min-h-screen place-items-center"}>
        <div className={T.desc + " " + t.text}>Loading settings…</div>
      </div>
    );
  }

  return (
    <div className={T.page + " min-h-screen py-10 antialiased " + t.text}>
      <div className="mx-auto max-w-2xl space-y-5 px-6">
        <header className="flex items-center gap-3 pb-1">
          <ReactLogo className="h-7 w-7 flex-none text-[#3e63dd]" />
          <div>
            <h1 className={"text-[19px] font-semibold tracking-tight " + t.heading}>
              React Path Inspector
            </h1>
            <p className={T.desc}>Options</p>
          </div>
        </header>

        {message ? (
          <div className={T.toast + " fixed bottom-4 right-4 z-50 flex max-w-md items-center gap-2.5 rounded-[10px] border px-3.5 py-2.5 text-[12.5px]"}>
            <span
              className={
                "h-1.5 w-1.5 flex-none rounded-full " +
                (messageKind === "error"
                  ? "bg-[#e5484d]"
                  : messageKind === "success"
                    ? "bg-[#30a46c]"
                    : "bg-[#3e63dd]")
              }
            />
            {message}
          </div>
        ) : null}

        <Section
          title="Appearance"
          description="Theme of the path bar, highlights and this page."
          t={t}
        >
          <Row label="Theme" hint='"System" follows your OS light or dark preference.' t={t}>
            <Segmented
              value={settings.theme}
              options={[
                { value: "system", label: "System" },
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
              ]}
              onChange={(value) => update({ theme: value as UiTheme })}
              t={t}
            />
          </Row>
        </Section>

        <Section title="Output" description="What gets copied and how." t={t}>
          <Row label="Default format" hint="Markdown reads better for people, JSON for tools." t={t}>
            <Segmented
              value={settings.defaultFormat}
              options={[
                { value: "markdown", label: "Markdown" },
                { value: "json", label: "JSON" },
              ]}
              onChange={(value) =>
                update({ defaultFormat: value as Settings["defaultFormat"] })
              }
              t={t}
            />
          </Row>
          <Row label="Header line" hint="Route, React version and the path summary at the top." t={t}>
            <Toggle
              checked={settings.headerEnabled}
              onChange={(checked) => update({ headerEnabled: checked })}
              label="Header line"
              t={t}
            />
          </Row>
          <Row label="Note field in the path bar" hint="Adds a Tab-focusable question that is copied as its first line." t={t}>
            <Toggle
              checked={settings.noteFieldEnabled}
              onChange={(checked) => update({ noteFieldEnabled: checked })}
              label="Note field in the path bar"
              t={t}
            />
          </Row>
          <Row label="Size budget" hint="Characters; ancestors drop to prop names when it runs low." t={t}>
            <input
              type="number"
              className={T.input}
              value={settings.budgetChars}
              min={500}
              max={100000}
              onChange={(e) => update({ budgetChars: Number(e.target.value) || 8000 })}
            />
          </Row>
        </Section>

        <Section
          title="Open in editor"
          description="Where the inspect mode opens component source files, and how relative paths become absolute."
          t={t}
        >
          <Row label="Editor" hint="VS Code and Cursor both open in the window you already have running." t={t}>
            <Segmented
              value={settings.editor}
              options={[
                { value: "vscode", label: "VS Code" },
                { value: "cursor", label: "Cursor" },
              ]}
              onChange={(value) => update({ editor: value as EditorId })}
              t={t}
            />
          </Row>
          <Row label="Default project root" hint="Absolute folder path used when a site has no root of its own." t={t}>
            <input
              type="text"
              className={T_BASE.monoInput + " w-56"}
              placeholder={rootPlaceholder}
              value={settings.defaultProjectRoot}
              onChange={(e) => update({ defaultProjectRoot: e.target.value })}
            />
          </Row>
          <div className="py-2.5">
            <div className={T_BASE.label + " " + t.label}>Project roots per site</div>
            <div className={"mb-2 " + T_BASE.desc + " " + t.desc}>
              React reports source paths relative to the project; the root turns them absolute.
              Sites are matched with their port, like <Code t={t}>http://localhost:3002</Code>.
            </div>
            <ul className="space-y-2 pb-2">
              {rootRows.map((rootRow) => (
                <li key={rootRow.site} className={T_BASE.rootRow + " " + t.rootRow}>
                  <span className={"w-44 flex-none truncate font-mono text-[12.5px] " + t.label}>
                    {rootRow.site}
                  </span>
                  <span className={"min-w-0 flex-1 truncate font-mono text-[12.5px] " + t.desc}>
                    {rootRow.root}
                  </span>
                  <button className={T_BASE.btnDanger + " " + t.btnDanger} onClick={() => removeProjectRoot(rootRow.site)}>
                    Remove
                  </button>
                </li>
              ))}
              {rootRows.length === 0 ? <li className={T_BASE.desc + " " + t.desc}>No site roots yet; the default root covers every site.</li> : null}
            </ul>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                className={T_BASE.monoInput + " w-44"}
                placeholder="http://localhost:3002"
                value={rootSiteInput}
                onChange={(e) => setRootSiteInput(e.target.value)}
              />
              <input
                type="text"
                className={T_BASE.monoInput + " w-64"}
                placeholder={rootPlaceholder}
                value={rootPathInput}
                onChange={(e) => setRootPathInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addProjectRoot();
                  }
                }}
              />
              <button className={T_BASE.btnPrimary + " " + t.btnPrimary} onClick={addProjectRoot}>
                Add root
              </button>
            </div>
          </div>
        </Section>

        <Section title="Shortcuts" description="Toggle keys for the two inspect modes; press the same keys again to leave a mode." t={t}>
          <Row label="Open in editor mode" hint="Hover highlights elements; click opens the source file." t={t}>
            <ShortcutInput
              value={settings.editorShortcut}
              onChange={(next) => update({ editorShortcut: next })}
            />
          </Row>
          <Row label="Select component mode" hint="Hover highlights components; click opens the path bar." t={t}>
            <ShortcutInput
              value={settings.selectShortcut}
              onChange={(next) => update({ selectShortcut: next })}
            />
          </Row>
          <p className={"pb-1 leading-relaxed " + T_BASE.desc + " " + t.desc}>
            Keys are captured while an input here is focused. Esc leaves the mode on a page too.
          </p>
        </Section>

        <Section title="Props serializer" description="How much prop detail to include and what to hide." t={t}>
          <Row label="Max object depth" hint="How deeply nested objects are expanded." t={t}>
            <input
              type="number"
              className={T.input}
              value={settings.maxDepth}
              min={1}
              max={10}
              onChange={(e) => update({ maxDepth: Number(e.target.value) || 3 })}
            />
          </Row>
          <Row label="Max string length" hint="Longer strings are cut with an ellipsis." t={t}>
            <input
              type="number"
              className={T.input}
              value={settings.maxStringChars}
              min={20}
              max={5000}
              onChange={(e) => update({ maxStringChars: Number(e.target.value) || 200 })}
            />
          </Row>
          <Row label="Max array / Map / Set items" hint="Extra items collapse to … +N more." t={t}>
            <input
              type="number"
              className={T.input}
              value={settings.maxItems}
              min={1}
              max={50}
              onChange={(e) => update({ maxItems: Number(e.target.value) || 5 })}
            />
          </Row>
          <div className="py-2.5">
            <div className={T.label}>Redact keys</div>
            <div className={"mb-2 " + T.desc}>Comma separated; built-in keys can be disabled by leaving them out.</div>
            <input
              type="text"
              className={T.monoInput}
              placeholder="accessToken, password, sessionToken"
              value={redactKeysText}
              onChange={(e) => setRedactKeysText(e.target.value)}
              onBlur={commitRedactKeys}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitRedactKeys();
                }
              }}
            />
            <p className={"mt-2 leading-relaxed " + T.desc}>
              Any built-in key omitted from the list is disabled; keys match whole words or
              camelCase segments. Always redacted regardless of key name: JWTs, Bearer
              tokens, hex/base64 of 32+ characters, <Code t={t}>sk-</Code>, <Code t={t}>ghp_</Code>,{" "}
              <Code t={t}>AKIA</Code> values.
            </p>
          </div>
          <Row label="Redact personal data" hint="email, phone, address, ssn. Off by default." t={t}>
            <Toggle
              checked={settings.redactPersonalData}
              onChange={(checked) => update({ redactPersonalData: checked })}
              label="Redact personal data"
              t={t}
            />
          </Row>
        </Section>

        <Section title="Diagnostics" description="Helpers for when a copied path looks wrong." t={t}>
          <Row label="Show everything" hint="Disable the noise filter; framework components appear too." t={t}>
            <Toggle
              checked={settings.showEverything}
              onChange={(checked) => update({ showEverything: checked })}
              label="Show everything"
              t={t}
            />
          </Row>
          <Row label="Debug logging" hint="Log the raw unfiltered path to the page console." t={t}>
            <Toggle
              checked={settings.debugLogging}
              onChange={(checked) => update({ debugLogging: checked })}
              label="Debug logging"
              t={t}
            />
          </Row>
        </Section>

        <Section title="Allowed origins" description="Where the extension may read React trees." t={t}>
          <p className={"pb-2 leading-relaxed " + T.desc}>
            Each origin gets a permission prompt and registered content scripts; removing
            one revokes both. Ports are ignored by match patterns. Changes apply after a
            page reload.
          </p>
          <ul className="space-y-2 pb-2">
            {originRows.map((rowItem) => (
              <li
                key={rowItem.origin}
                className={T.originRow}
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <span className={"truncate font-mono text-[12.5px] " + t.label}>
                    {rowItem.origin}
                  </span>
                  <span
                    className={
                      "flex flex-none items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium " +
                      (rowItem.status === "active" ? t.statusActive : t.statusIdle)
                    }
                  >
                    <span
                      className={
                        "h-1.5 w-1.5 rounded-full " +
                        (rowItem.status === "active" ? t.statusDotActive : t.statusDotIdle)
                      }
                    />
                    {rowItem.status}
                  </span>
                </span>
                <button
                  className={T.btnDanger}
                  onClick={() => void removeOrigin(rowItem.origin, rowItem.pattern)}
                >
                  Remove
                </button>
              </li>
            ))}
            {originRows.length === 0 ? (
              <li className={T.desc}>No origins yet.</li>
            ) : null}
          </ul>
          <div className="space-y-2">
            <textarea
              className={T.textarea}
              rows={5}
              placeholder={"http://localhost:3000\nhttps://dev.example.com\nhttps://staging.mycompany.dev/pr"}
              value={originInput}
              onChange={(e) => setOriginInput(e.target.value)}
            />
            <button className={T.btnPrimary} onClick={() => void addOrigin()}>
              Add origins
            </button>
          </div>
        </Section>

        <Section
          title="Reset"
          description="Restore every setting on this page to its default value."
          t={t}
        >
          <div className="pt-1">
            <button
              className={T.btnReset}
              onClick={() => {
                void (async () => {
                  await resetSettings();
                  setSettings(DEFAULT_SETTINGS);
                  setRedactKeysText(redactKeysTextFor(DEFAULT_SETTINGS));
                  flash("Settings reset to defaults.", "success");
                })();
              }}
            >
              Reset to defaults
            </button>
          </div>
        </Section>
      </div>
    </div>
  );
}
