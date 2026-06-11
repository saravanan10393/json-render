"use client";

import { createContext, useContext } from "react";

/**
 * Permissive page-target resolution (ported from rapp's router-bridge):
 * `ui.navigate` targets may be a page name ("TaskList"), a page id
 * ("member-task-tasklist"), a "/role/slug" path, or a bare slug. All are
 * slugified and looked up in the route table built by AppShell.
 */
export interface RouterBridge {
  resolve: (target: string) => string;
}

export const slugify = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]/g, "");

export const RouterBridgeContext = createContext<RouterBridge>({
  resolve: (target) => (target.startsWith("/") ? target : `/${target}`),
});

export function useRouterBridge(): RouterBridge {
  return useContext(RouterBridgeContext);
}

export function buildRouteTable(
  pages: Array<{ id: string; role: string; name: string }>,
): Map<string, string> {
  const table = new Map<string, string>();
  for (const page of pages) {
    const roleSlug = slugify(page.role);
    const pageSlug = slugify(page.name);
    const path = `/${roleSlug}/${pageSlug}`;
    table.set(slugify(page.id), path);
    table.set(slugify(page.name), path);
    table.set(slugify(`${page.role}/${page.name}`), path);
    table.set(slugify(path), path);
  }
  return table;
}

export function createBridge(table: Map<string, string>): RouterBridge {
  return {
    resolve: (target) => {
      const hit = table.get(slugify(target));
      if (hit) return hit;
      console.warn(`[ui.navigate] no page matches "${target}"`);
      return target.startsWith("/") ? target : `/${target}`;
    },
  };
}
