import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import {
  AppIndexSchema,
  PageFileSchema,
  type AppIndex,
  type PageFile,
} from "@/lib/jr/schema";
import { DATA_ROOT, db } from "./db";

export interface AppRow {
  id: string;
  name: string;
  description: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  pageCount: number;
}

// ── SQLite: app registry ──────────────────────────────────────────────────

export function listApps(): AppRow[] {
  const rows = db
    .prepare("SELECT * FROM apps ORDER BY updated_at DESC")
    .all() as Array<Record<string, string>>;
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    pageCount: listPageIds(row.id).length,
  }));
}

export function getApp(id: string): AppRow | null {
  const row = db.prepare("SELECT * FROM apps WHERE id = ?").get(id) as
    | Record<string, string>
    | undefined;
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    pageCount: listPageIds(row.id).length,
  };
}

export function createApp(name: string, description = ""): AppRow {
  const id = randomUUID().slice(0, 8);
  const now = new Date().toISOString();
  db.prepare(
    "INSERT INTO apps (id, name, description, status, created_at, updated_at) VALUES (?, ?, ?, 'draft', ?, ?)",
  ).run(id, name, description, now, now);
  mkdirSync(appDir(id), { recursive: true });
  return { id, name, description, status: "draft", createdAt: now, updatedAt: now, pageCount: 0 };
}

export function touchApp(id: string, fields?: { name?: string; status?: string }) {
  const now = new Date().toISOString();
  if (fields?.name) {
    db.prepare("UPDATE apps SET name = ?, updated_at = ? WHERE id = ?").run(fields.name, now, id);
  } else if (fields?.status) {
    db.prepare("UPDATE apps SET status = ?, updated_at = ? WHERE id = ?").run(fields.status, now, id);
  } else {
    db.prepare("UPDATE apps SET updated_at = ? WHERE id = ?").run(now, id);
  }
}

export function deleteApp(id: string) {
  db.prepare("DELETE FROM apps WHERE id = ?").run(id);
  db.prepare("DELETE FROM entities WHERE app_id = ?").run(id);
  db.prepare("DELETE FROM records WHERE app_id = ?").run(id);
  rmSync(appDir(id), { recursive: true, force: true });
}

// ── Filesystem: data/<appId>/app.json + <pageId>.json ────────────────────

export function appDir(appId: string): string {
  return path.join(DATA_ROOT, appId);
}

export function readAppIndex(appId: string): AppIndex | null {
  const file = path.join(appDir(appId), "app.json");
  if (!existsSync(file)) return null;
  return AppIndexSchema.parse(JSON.parse(readFileSync(file, "utf8")));
}

export function writeAppIndex(appId: string, index: AppIndex): void {
  const parsed = AppIndexSchema.parse(index);
  mkdirSync(appDir(appId), { recursive: true });
  writeFileSync(
    path.join(appDir(appId), "app.json"),
    JSON.stringify(parsed, null, 2),
  );
  touchApp(appId);
}

export function listPageIds(appId: string): string[] {
  if (!existsSync(appDir(appId))) return [];
  return readdirSync(appDir(appId))
    .filter((f) => f.endsWith(".json") && f !== "app.json" && f !== "entities.json")
    .map((f) => f.replace(/\.json$/, ""));
}

export function readPage(appId: string, pageId: string): PageFile | null {
  const file = path.join(appDir(appId), `${pageId}.json`);
  if (!existsSync(file)) return null;
  return PageFileSchema.parse(JSON.parse(readFileSync(file, "utf8")));
}

export function readAllPages(appId: string): PageFile[] {
  return listPageIds(appId)
    .map((pageId) => {
      try {
        return readPage(appId, pageId);
      } catch {
        return null; // skip corrupt page files rather than failing the bundle
      }
    })
    .filter((p): p is PageFile => p !== null);
}

export function writePage(appId: string, page: PageFile): void {
  const parsed = PageFileSchema.parse(page);
  mkdirSync(appDir(appId), { recursive: true });
  writeFileSync(
    path.join(appDir(appId), `${parsed.id}.json`),
    JSON.stringify(parsed, null, 2),
  );
  touchApp(appId);
}

export function deletePage(appId: string, pageId: string): void {
  rmSync(path.join(appDir(appId), `${pageId}.json`), { force: true });
  rmSync(path.join(appDir(appId), "temp", `${pageId}.json`), { force: true });
  touchApp(appId);
}

/** Reads the pre-expansion SOURCE audit (temp/<pageId>.json) — null if absent. */
export function readSourceAudit(appId: string, pageId: string): Record<string, unknown> | null {
  try {
    const raw = readFileSync(path.join(appDir(appId), "temp", `${pageId}.json`), "utf8");
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Audit copy of the agent-emitted SOURCE spec (pre fragment-expansion,
 * $fragment refs intact). Written to data/<appId>/temp/<pageId>.json only
 * after the expanded page passed all validation.
 */
export function writeSourceAudit(
  appId: string,
  pageId: string,
  audit: Record<string, unknown>,
): void {
  const dir = path.join(appDir(appId), "temp");
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, `${pageId}.json`), JSON.stringify(audit, null, 2));
}

// ── Chat history (per app, so conversations survive reloads) ─────────────

export function loadChatMessages(appId: string): unknown[] {
  const rows = db
    .prepare("SELECT payload FROM chat_messages WHERE app_id = ? ORDER BY id ASC")
    .all(appId) as Array<{ payload: string }>;
  return rows.map((r) => JSON.parse(r.payload));
}

export function saveChatMessage(appId: string, message: { id: string; role: string }) {
  db.prepare(
    `INSERT INTO chat_messages (app_id, message_id, role, payload, created_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(app_id, message_id) DO UPDATE SET payload = excluded.payload`,
  ).run(appId, message.id, message.role, JSON.stringify(message), new Date().toISOString());
}
