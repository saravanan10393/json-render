import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { listPageIds } from "@/lib/server/apps";
import { readMockups, readSitemap } from "@/lib/server/design-artifacts";
import { getAppThemeOrDefault } from "@/lib/server/design-md";
import { countRecords, listEntities, queryRecords } from "@/lib/server/entity-store";

const mtime = (p: string): number => {
  try {
    return existsSync(p) ? statSync(p).mtimeMs : 0;
  } catch {
    return 0;
  }
};

/**
 * Everything the stage review panels need in one fetch: the data model
 * (entities + sample rows) for the backend gate, the theme + sitemap + mockups
 * for the design gate, and `pagesStale` — whether the design has changed since
 * the pages were last built (drives the contextual "Rebuild" prompt).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ appId: string }> },
) {
  const { appId } = await params;
  const entities = listEntities(appId).map((e) => ({
    name: e.name,
    label: e.label,
    fields: e.fields,
    sampleRecords: queryRecords(appId, e.name, { Page: { number: 1, size: 5 } }).data,
    count: countRecords(appId, e.name),
  }));

  const dir = path.join(process.cwd(), "data", appId);
  const designNewest = Math.max(
    mtime(path.join(dir, "theme.json")),
    mtime(path.join(dir, "design", "sitemap.json")),
    mtime(path.join(dir, "design", "mockups.json")),
    mtime(path.join(dir, "design", "artifact.json")),
  );
  const pageIds = listPageIds(appId);
  const pagesNewest = Math.max(0, ...pageIds.map((id) => mtime(path.join(dir, `${id}.json`))));
  const pagesStale = pageIds.length > 0 && designNewest > pagesNewest;

  return NextResponse.json({
    entities,
    theme: getAppThemeOrDefault(appId),
    sitemap: readSitemap(appId),
    mockups: readMockups(appId),
    pagesStale,
  });
}
