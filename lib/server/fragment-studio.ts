import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { db } from "./db";
import { countRecords, listEntities, saveEntity, saveRecord } from "./entity-store";
import { FRAGMENTS_ROOT, registerFragmentFile } from "./fragment-files";
import { STANDARD_ENTITIES, STANDARD_SEEDS } from "./standard-entities";

/**
 * Fragment Studio backend — SESSION-scoped: one session = one fragment's
 * whole lifecycle (author or edit → preview → promote → keep iterating).
 *
 * A session owns: a fragment_sessions row (name emerges from the first
 * saveDraft), a shadow `apps` row with status 'studio-session' (so the
 * FK-enforced chat_messages table works and deletes cascade), and a draft
 * dir fragments/.drafts/<sessionId>/ holding at most ONE .ts file.
 *
 * Previews run against the reserved "studio-sandbox" app's seeded data.
 */

const execFileAsync = promisify(execFile);

export const STUDIO_APP_ID = "studio-sandbox";
const DRAFTS_ROOT = path.join(FRAGMENTS_ROOT, ".drafts");
const NAME_RE = /^[A-Z][A-Za-z0-9]*$/;

// ── Sandbox app (preview data) ────────────────────────────────────────────

export function ensureStudioSandbox(): void {
  const exists = db.prepare("SELECT id FROM apps WHERE id = ?").get(STUDIO_APP_ID);
  if (!exists) {
    const now = new Date().toISOString();
    db.prepare(
      "INSERT INTO apps (id, name, description, status, created_at, updated_at) VALUES (?, ?, ?, 'studio', ?, ?)",
    ).run(STUDIO_APP_ID, "Fragment Studio Sandbox", "Reserved preview app", now, now);
  }
  const existing = new Set(listEntities(STUDIO_APP_ID).map((e) => e.name));
  for (const entity of STANDARD_ENTITIES) {
    if (!existing.has(entity.name)) saveEntity(STUDIO_APP_ID, entity);
    if (countRecords(STUDIO_APP_ID, entity.name) === 0) {
      for (const record of STANDARD_SEEDS[entity.name] ?? []) {
        saveRecord(STUDIO_APP_ID, entity.name, record);
      }
    }
  }
}

// ── Sessions ──────────────────────────────────────────────────────────────

export interface FragmentSession {
  id: string;
  fragmentName: string | null;
  category: string | null;
  status: "draft" | "promoted";
  origin: "new" | "edit";
  createdAt: string;
  updatedAt: string;
}

function rowToSession(row: Record<string, string | null>): FragmentSession {
  return {
    id: row.id as string,
    fragmentName: row.fragment_name,
    category: row.category,
    status: row.status as "draft" | "promoted",
    origin: row.origin as "new" | "edit",
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function listSessions(): FragmentSession[] {
  return (
    db
      .prepare("SELECT * FROM fragment_sessions ORDER BY updated_at DESC")
      .all() as Array<Record<string, string | null>>
  ).map(rowToSession);
}

export function getSession(id: string): FragmentSession | null {
  const row = db.prepare("SELECT * FROM fragment_sessions WHERE id = ?").get(id) as
    | Record<string, string | null>
    | undefined;
  return row ? rowToSession(row) : null;
}

function touchSession(id: string, fields: Partial<Pick<FragmentSession, "fragmentName" | "category" | "status">> = {}): void {
  const now = new Date().toISOString();
  if (fields.fragmentName !== undefined) {
    db.prepare("UPDATE fragment_sessions SET fragment_name = ?, updated_at = ? WHERE id = ?").run(fields.fragmentName, now, id);
  }
  if (fields.category !== undefined) {
    db.prepare("UPDATE fragment_sessions SET category = ?, updated_at = ? WHERE id = ?").run(fields.category, now, id);
  }
  if (fields.status !== undefined) {
    db.prepare("UPDATE fragment_sessions SET status = ?, updated_at = ? WHERE id = ?").run(fields.status, now, id);
  }
  db.prepare("UPDATE fragment_sessions SET updated_at = ? WHERE id = ?").run(now, id);
}

/**
 * Create a session. With `fromFragment`, forks the registry fragment's
 * current source into the session draft (edit mode).
 */
export function createSession(fromFragment?: string): FragmentSession {
  ensureStudioSandbox();
  const id = randomUUID().slice(0, 8);
  const now = new Date().toISOString();
  const origin = fromFragment ? "edit" : "new";

  let fragmentName: string | null = null;
  let category: string | null = null;
  if (fromFragment) {
    const found = findFragmentFile(fromFragment);
    if (!found) throw new Error(`fragment "${fromFragment}" not found in the library`);
    fragmentName = fromFragment;
    category = found.category;
  }

  db.prepare(
    "INSERT INTO fragment_sessions (id, fragment_name, category, status, origin, created_at, updated_at) VALUES (?, ?, ?, 'draft', ?, ?, ?)",
  ).run(id, fragmentName, category, origin, now, now);
  // shadow apps row: satisfies chat_messages' enforced FK; hidden from the home list
  db.prepare(
    "INSERT INTO apps (id, name, description, status, created_at, updated_at) VALUES (?, ?, ?, 'studio-session', ?, ?)",
  ).run(id, `fragment: ${fragmentName ?? "untitled"}`, "", now, now);

  if (fromFragment) {
    const source = readFragmentSource(fromFragment);
    if (source) saveDraftSource(id, fromFragment, source);
  }
  return getSession(id)!;
}

export function deleteSession(id: string): void {
  db.prepare("DELETE FROM fragment_sessions WHERE id = ?").run(id);
  db.prepare("DELETE FROM chat_messages WHERE app_id = ?").run(id);
  db.prepare("DELETE FROM apps WHERE id = ?").run(id);
  rmSync(path.join(DRAFTS_ROOT, id), { recursive: true, force: true });
}

// ── Per-session draft (at most one .ts file) ─────────────────────────────

function sessionDraftDir(sessionId: string): string {
  return path.join(DRAFTS_ROOT, sessionId);
}

export function getDraft(sessionId: string): { name: string; source: string } | null {
  const dir = sessionDraftDir(sessionId);
  if (!existsSync(dir)) return null;
  const file = readdirSync(dir).find((f) => f.endsWith(".ts"));
  if (!file) return null;
  return {
    name: file.replace(/\.ts$/, ""),
    source: readFileSync(path.join(dir, file), "utf8"),
  };
}

export function saveDraftSource(sessionId: string, name: string, source: string): void {
  if (!NAME_RE.test(name)) throw new Error(`invalid fragment name "${name}" (PascalCase required)`);
  const dir = sessionDraftDir(sessionId);
  mkdirSync(dir, { recursive: true });
  // one draft per session: a rename replaces the previous file
  for (const f of readdirSync(dir)) {
    if (f.endsWith(".ts") && f !== `${name}.ts`) rmSync(path.join(dir, f), { force: true });
  }
  writeFileSync(path.join(dir, `${name}.ts`), source);
  touchSession(sessionId, { fragmentName: name });
  db.prepare("UPDATE apps SET name = ?, updated_at = ? WHERE id = ?").run(
    `fragment: ${name}`,
    new Date().toISOString(),
    sessionId,
  );
}

export function deleteDraft(sessionId: string): void {
  rmSync(sessionDraftDir(sessionId), { recursive: true, force: true });
  touchSession(sessionId);
}

// ── Evaluation (fresh bun subprocess — module-cache isolation) ────────────

export interface DraftEvalResult {
  ok: boolean;
  issues: string[];
  meta?: {
    name: string;
    category: string;
    version: string;
    description: string;
    whenToUse: string | null;
    paramsResolved: unknown;
    paramsSchema: unknown;
  };
  spec?: Record<string, unknown>;
}

export async function evalDraft(
  sessionId: string,
  params?: Record<string, unknown>,
): Promise<DraftEvalResult> {
  const draft = getDraft(sessionId);
  if (!draft) return { ok: false, issues: ["no draft in this session yet"] };

  const file = path.join(sessionDraftDir(sessionId), `${draft.name}.ts`);
  const args = [path.join(process.cwd(), "scripts", "eval-draft.ts"), file];
  if (params && Object.keys(params).length > 0) args.push(JSON.stringify(params));

  try {
    const { stdout } = await execFileAsync("bun", args, {
      cwd: process.cwd(),
      timeout: 30_000,
      maxBuffer: 16 * 1024 * 1024,
    });
    const lastLine = stdout.trim().split("\n").pop() ?? "";
    return JSON.parse(lastLine) as DraftEvalResult;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, issues: [`draft evaluation crashed: ${message.split("\n")[0]}`] };
  }
}

// ── Promote ───────────────────────────────────────────────────────────────

export interface ApproveResult {
  ok: boolean;
  issues: string[];
  actions: string[];
}

export async function promoteSession(sessionId: string, category: string): Promise<ApproveResult> {
  if (!/^[a-z][a-z0-9-]*$/.test(category)) {
    return { ok: false, issues: [`invalid category "${category}" (kebab-case required)`], actions: [] };
  }
  const session = getSession(sessionId);
  if (!session) return { ok: false, issues: ["session not found"], actions: [] };
  const draft = getDraft(sessionId);
  if (!draft) return { ok: false, issues: ["no draft to promote"], actions: [] };

  const evaluation = await evalDraft(sessionId);
  if (!evaluation.ok) {
    return { ok: false, issues: ["draft does not pass validation:", ...evaluation.issues], actions: [] };
  }
  if (evaluation.meta && evaluation.meta.name !== draft.name) {
    return {
      ok: false,
      issues: [`fragment name "${evaluation.meta.name}" must match the draft file name "${draft.name}"`],
      actions: [],
    };
  }

  const target = path.join(FRAGMENTS_ROOT, category, `${draft.name}.ts`);
  const targetExists = existsSync(target);
  // Overwrite is allowed only when this SESSION owns that name (it forked it
  // or promoted it before) — a brand-new session can't clobber the library.
  const ownsName =
    session.fragmentName === draft.name &&
    (session.origin === "edit" || session.status === "promoted");
  if (targetExists && !ownsName) {
    return {
      ok: false,
      issues: [
        `fragments/${category}/${draft.name}.ts already exists. Rename the fragment, or open an EDIT session for ${draft.name} to update it.`,
      ],
      actions: [],
    };
  }

  const actions: string[] = [];
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, draft.source);
  actions.push(`${targetExists ? "updated" : "wrote"} fragments/${category}/${draft.name}.ts`);
  actions.push(...registerFragmentFile(category, draft.name));
  deleteDraft(sessionId);
  touchSession(sessionId, { status: "promoted", category, fragmentName: draft.name });

  // Re-index in a FRESH process: this server's in-memory registry is stale
  // until the dev server reloads the module graph.
  try {
    const { stdout } = await execFileAsync(
      "bun",
      [path.join(process.cwd(), "scripts", "index-fragments.ts")],
      { cwd: process.cwd(), timeout: 60_000 },
    );
    actions.push(stdout.trim().split("\n").slice(-4).join("; "));
  } catch (error) {
    return {
      ok: false,
      issues: [
        `fragment registered but vector indexing failed — run \`bun run fragment:index\` manually: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`,
      ],
      actions,
    };
  }

  return { ok: true, issues: [], actions };
}

// ── Library fragment sources ──────────────────────────────────────────────

function findFragmentFile(name: string): { category: string; file: string } | null {
  if (!NAME_RE.test(name) || !existsSync(FRAGMENTS_ROOT)) return null;
  for (const entry of readdirSync(FRAGMENTS_ROOT, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    const candidate = path.join(FRAGMENTS_ROOT, entry.name, `${name}.ts`);
    if (existsSync(candidate)) return { category: entry.name, file: candidate };
  }
  return null;
}

export function readFragmentSource(name: string): string | null {
  const found = findFragmentFile(name);
  return found ? readFileSync(found.file, "utf8") : null;
}

export function listCategories(): string[] {
  if (!existsSync(FRAGMENTS_ROOT)) return [];
  return readdirSync(FRAGMENTS_ROOT, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith("."))
    .map((e) => e.name)
    .sort();
}

export function listLibraryFragments(): Array<{ name: string; category: string }> {
  if (!existsSync(FRAGMENTS_ROOT)) return [];
  const out: Array<{ name: string; category: string }> = [];
  for (const entry of readdirSync(FRAGMENTS_ROOT, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    for (const file of readdirSync(path.join(FRAGMENTS_ROOT, entry.name))) {
      if (file.endsWith(".ts") && file !== "index.ts") {
        out.push({ name: file.replace(/\.ts$/, ""), category: entry.name });
      }
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}
