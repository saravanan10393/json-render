"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { MemoryRouter, Navigate, Route, Routes } from "react-router";
import { Toaster } from "sonner";
import type { AppIndex, PageFile } from "@/lib/jr/schema";
import { cn } from "@/lib/utils";
import { ScreenRenderer } from "./screen-renderer";
import { SHELL_COMPONENTS, type ShellNavEntry } from "./shells";
import {
  buildRouteTable,
  createBridge,
  RouterBridgeContext,
  slugify,
} from "./router-bridge";

export interface AppTheme {
  name: string;
  preset: string;
  light: Record<string, string>;
  dark: Record<string, string>;
  fonts: { heading: string; body: string; mono?: string };
  radius: string;
}

export interface AppBundle {
  app?: { id: string; name: string };
  index: AppIndex | null;
  pages: PageFile[];
  theme?: AppTheme | null;
}

/** Google Fonts stylesheet links for the theme's families. */
function FontLinks({ theme }: { theme: AppTheme }) {
  const families = [...new Set([theme.fonts.heading, theme.fonts.body])].filter(
    (f) => f && !["Arial", "Helvetica", "Georgia", "system-ui"].includes(f),
  );
  return (
    <>
      {families.map((family) => (
        <link
          key={family}
          rel="stylesheet"
          href={`https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, "+")}:wght@400;500;600;700&display=swap`}
        />
      ))}
    </>
  );
}

/** Inline CSS vars: shadcn tokens + fonts + radius for the active palette. */
function themeVars(theme: AppTheme, dark: boolean): CSSProperties {
  const palette = dark ? theme.dark : theme.light;
  const vars: Record<string, string> = {};
  for (const [token, value] of Object.entries(palette)) {
    vars[`--${token}`] = value;
  }
  vars["--radius"] = theme.radius;
  vars["--font-sans-var"] = `"${theme.fonts.body}", ui-sans-serif, system-ui, sans-serif`;
  vars["--font-display"] = `"${theme.fonts.heading}", ui-sans-serif, system-ui, sans-serif`;
  if (theme.fonts.mono) vars["--font-mono-var"] = `"${theme.fonts.mono}", ui-monospace, monospace`;
  return vars as CSSProperties;
}

/**
 * The generated-app runtime: registers /{role}/{page-slug} routes for every
 * page in the bundle, renders the per-role navigation shell (six layouts,
 * picked by app.json's shellLayout), and themes everything through the app's
 * DESIGN.md tokens scoped to this container.
 */
export function AppRuntime({
  appId,
  bundle,
  className,
}: {
  appId: string;
  bundle: AppBundle;
  className?: string;
}) {
  const { index, pages, theme } = bundle;
  const bridge = useMemo(() => createBridge(buildRouteTable(pages)), [pages]);

  const darkStorageKey = `app-theme-${appId}`;
  const [dark, setDark] = useState(false);
  useEffect(() => {
    setDark(localStorage.getItem(darkStorageKey) === "dark");
  }, [darkStorageKey]);
  const toggleDark = () => {
    setDark((prev) => {
      localStorage.setItem(darkStorageKey, prev ? "light" : "dark");
      return !prev;
    });
  };

  const roles = index ? Object.keys(index.roles) : [];
  const firstRole = roles[0];
  const homePath = useMemo(() => {
    if (!index || !firstRole) return null;
    const role = index.roles[firstRole];
    const homeId = role.home ?? role.pages[0];
    const homePage = pages.find((p) => p.id === homeId) ?? pages[0];
    return homePage ? `/${slugify(homePage.role)}/${slugify(homePage.name)}` : null;
  }, [index, firstRole, pages]);

  if (!index || pages.length === 0 || !homePath) {
    return null;
  }

  const appName = bundle.app?.name ?? index.app;

  return (
    <RouterBridgeContext.Provider value={bridge}>
      {theme && <FontLinks theme={theme} />}
      <div
        className={cn("flex h-full min-h-0 flex-col bg-background text-foreground", dark && "dark", className)}
        style={theme ? themeVars(theme, dark) : undefined}
      >
        <MemoryRouter key={`${appId}-${pages.length}`} initialEntries={[homePath]}>
          <Routes>
            {pages.map((page) => (
              <Route
                key={page.id}
                path={`/${slugify(page.role)}/${slugify(page.name)}`}
                element={
                  <ShellFrame
                    appId={appId}
                    appName={appName}
                    index={index}
                    pages={pages}
                    page={page}
                    dark={dark}
                    onToggleDark={toggleDark}
                  />
                }
              />
            ))}
            <Route path="*" element={<Navigate to={homePath} replace />} />
          </Routes>
          <Toaster position="bottom-right" richColors />
        </MemoryRouter>
      </div>
    </RouterBridgeContext.Provider>
  );
}

/** Wraps the current page in the role's navigation shell. */
function ShellFrame({
  appId,
  appName,
  index,
  pages,
  page,
  dark,
  onToggleDark,
}: {
  appId: string;
  appName: string;
  index: AppIndex;
  pages: PageFile[];
  page: PageFile;
  dark: boolean;
  onToggleDark: () => void;
}) {
  const role = index.roles[page.role];
  const layout = role?.shellLayout ?? "sidebar";

  const entries: ShellNavEntry[] = (role?.navigation ?? []).flatMap((entry) => {
    const target = pages.find((p) => p.id === entry.page);
    if (!target) return [];
    return [
      {
        label: entry.label,
        icon: entry.icon,
        group: entry.group,
        path: `/${slugify(target.role)}/${slugify(target.name)}`,
      } satisfies ShellNavEntry,
    ];
  });

  const screen = <ScreenRenderer key={page.id} appId={appId} spec={page.spec} />;

  if (entries.length === 0) {
    return <main className="h-full min-h-0 overflow-y-auto bg-background">{screen}</main>;
  }

  const Shell = SHELL_COMPONENTS[layout] ?? SHELL_COMPONENTS.sidebar;
  return (
    <Shell appName={appName} entries={entries} dark={dark} onToggleDark={onToggleDark}>
      {screen}
    </Shell>
  );
}
