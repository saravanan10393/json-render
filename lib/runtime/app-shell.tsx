"use client";

import { useMemo } from "react";
import {
  MemoryRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router";
import { Toaster } from "sonner";
import type { AppIndex, PageFile } from "@/lib/jr/schema";
import { cn } from "@/lib/utils";
import { ScreenRenderer } from "./screen-renderer";
import {
  buildRouteTable,
  createBridge,
  RouterBridgeContext,
  slugify,
} from "./router-bridge";

export interface AppBundle {
  index: AppIndex | null;
  pages: PageFile[];
}

/**
 * The generated-app runtime: registers /{role}/{page-slug} routes for every
 * page in the bundle, renders the per-role navigation shell, and routes
 * `ui.navigate` targets through the bridge. MemoryRouter keeps the preview
 * isolated from the host Next.js URL.
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
  const { index, pages } = bundle;
  const bridge = useMemo(
    () => createBridge(buildRouteTable(pages)),
    [pages],
  );

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

  return (
    <RouterBridgeContext.Provider value={bridge}>
      <MemoryRouter key={`${appId}-${pages.length}`} initialEntries={[homePath]}>
        <div className={cn("flex h-full min-h-0 flex-col", className)}>
          <Routes>
            {pages.map((page) => (
              <Route
                key={page.id}
                path={`/${slugify(page.role)}/${slugify(page.name)}`}
                element={
                  <RoleShell appId={appId} index={index} pages={pages} page={page} />
                }
              />
            ))}
            <Route path="*" element={<Navigate to={homePath} replace />} />
          </Routes>
        </div>
        <Toaster position="bottom-right" richColors />
      </MemoryRouter>
    </RouterBridgeContext.Provider>
  );
}

/** Sidebar/topnav shell around the current page, driven by app.json navigation. */
function RoleShell({
  appId,
  index,
  pages,
  page,
}: {
  appId: string;
  index: AppIndex;
  pages: PageFile[];
  page: PageFile;
}) {
  const role = index.roles[page.role];
  const layout = role?.shellLayout ?? "sidebar";
  const navigate = useNavigate();
  const location = useLocation();

  const navEntries = (role?.navigation ?? []).map((entry) => {
    const target = pages.find((p) => p.id === entry.page);
    const path = target
      ? `/${slugify(target.role)}/${slugify(target.name)}`
      : "/";
    return { ...entry, path, active: location.pathname === path };
  });

  const nav =
    navEntries.length > 1 ? (
      <nav
        className={cn(
          "shrink-0 border-border bg-card",
          layout === "topnav"
            ? "flex items-center gap-1 border-b px-3 py-2"
            : "flex w-52 flex-col gap-1 border-r p-3",
        )}
      >
        {layout !== "topnav" && (
          <div className="mb-2 px-2 font-heading text-sm font-bold">
            {index.app}
          </div>
        )}
        {navEntries.map((entry) => (
          <button
            key={entry.page}
            type="button"
            onClick={() => navigate(entry.path)}
            className={cn(
              "rounded-md px-3 py-1.5 text-left text-sm transition-colors",
              entry.active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {entry.label}
          </button>
        ))}
      </nav>
    ) : null;

  return (
    <div
      className={cn(
        "flex min-h-0 flex-1",
        layout === "topnav" ? "flex-col" : "flex-row",
      )}
    >
      {nav}
      <main className="min-w-0 flex-1 overflow-y-auto bg-background">
        <ScreenRenderer key={page.id} appId={appId} spec={page.spec} />
      </main>
    </div>
  );
}
