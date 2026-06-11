import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { Fragment, FragmentRegistry } from "@/lib/jr/schema";

/**
 * Fragment vector index — semantic retrieval over the fragment registry so
 * the agent pulls only applicable fragments into context instead of the
 * whole catalog.
 *
 * Storage: `fragment_index` table in data/builder.db with a sqlite-vector
 * (github.com/sqliteai/sqlite-vector) FLOAT32/COSINE column. Embeddings via
 * OpenRouter `openai/text-embedding-3-small` (1536 dims).
 *
 * Runs under BOTH runtimes: Next.js (node:sqlite, verified with
 * allowExtension) and bun pipeline scripts (bun:sqlite + homebrew sqlite on
 * macOS — Apple's bundled build forbids extensions). This module therefore
 * owns its own connection and must NOT import lib/server/db.ts.
 */

const EMBEDDING_MODEL = "openai/text-embedding-3-small";
const EMBEDDING_DIMENSION = 1536;
const VECTOR_VERSION = "1.0.0";

const DATA_ROOT = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_ROOT, "builder.db");
const VENDOR_DIR = path.join(process.cwd(), "vendor", "sqlite-vector");
/** sqlite appends the platform suffix (.dylib/.so/.dll) itself. */
const EXT_PATH_NO_SUFFIX = path.join(VENDOR_DIR, "vector");

// ── Extension binary ──────────────────────────────────────────────────────

function extensionFile(): string {
  const suffix =
    process.platform === "darwin" ? ".dylib" : process.platform === "win32" ? ".dll" : ".so";
  return `${EXT_PATH_NO_SUFFIX}${suffix}`;
}

function releaseAsset(): string {
  const key = `${process.platform}-${process.arch}`;
  const asset: Record<string, string> = {
    "darwin-arm64": "vector-macos-arm64",
    "darwin-x64": "vector-macos-x86_64",
    "linux-x64": "vector-linux-x86_64",
    "linux-arm64": "vector-linux-arm64",
    "win32-x64": "vector-windows-x86_64",
  };
  const name = asset[key];
  if (!name) throw new Error(`sqlite-vector: unsupported platform "${key}"`);
  return `https://github.com/sqliteai/sqlite-vector/releases/download/${VECTOR_VERSION}/${name}-${VECTOR_VERSION}.tar.gz`;
}

/** Download the platform binary into vendor/ when missing. */
export async function ensureVectorExtension(): Promise<void> {
  if (existsSync(extensionFile())) return;
  const url = releaseAsset();
  mkdirSync(VENDOR_DIR, { recursive: true });
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `sqlite-vector: download failed (${response.status}) from ${url}. Download it manually into vendor/sqlite-vector/.`,
    );
  }
  const archive = path.join(VENDOR_DIR, "vector.tar.gz");
  const { writeFileSync, rmSync } = await import("node:fs");
  writeFileSync(archive, Buffer.from(await response.arrayBuffer()));
  execFileSync("tar", ["xzf", archive, "-C", VENDOR_DIR]);
  rmSync(archive, { force: true });
  if (process.platform === "darwin") {
    // downloaded dylibs carry the quarantine xattr, which makes dlopen fail
    execFileSync("xattr", ["-c", extensionFile()]);
  }
  if (!existsSync(extensionFile())) {
    throw new Error(`sqlite-vector: archive did not contain ${path.basename(extensionFile())}`);
  }
}

// ── Dual-runtime connection ───────────────────────────────────────────────

interface MinimalStatement {
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
  run(...params: unknown[]): unknown;
}
interface MinimalDb {
  exec(sql: string): void;
  prepare(sql: string): MinimalStatement;
}

let dbPromise: Promise<MinimalDb> | null = null;

async function openDb(): Promise<MinimalDb> {
  await ensureVectorExtension();
  mkdirSync(DATA_ROOT, { recursive: true });

  let db: MinimalDb;
  if (process.versions.bun) {
    // Variable specifier keeps Next's bundler from trying to resolve bun:sqlite.
    const specifier = "bun:sqlite";
    const { Database } = (await import(specifier)) as {
      Database: {
        setCustomSQLite(p: string): void;
        new (p: string): MinimalDb & { loadExtension(p: string): void };
      };
    };
    if (process.platform === "darwin") {
      // Apple's system SQLite forbids extension loading.
      const homebrew = "/opt/homebrew/opt/sqlite/lib/libsqlite3.dylib";
      if (!existsSync(homebrew)) {
        throw new Error(
          "bun:sqlite needs Homebrew SQLite for extensions on macOS — run: brew install sqlite",
        );
      }
      try {
        Database.setCustomSQLite(homebrew);
      } catch {
        // already set by an earlier open in this process
      }
    }
    const bunDb = new Database(DB_PATH);
    bunDb.loadExtension(EXT_PATH_NO_SUFFIX);
    db = bunDb;
  } else {
    const { DatabaseSync } = await import("node:sqlite");
    const nodeDb = new DatabaseSync(DB_PATH, { allowExtension: true });
    nodeDb.loadExtension(EXT_PATH_NO_SUFFIX);
    db = nodeDb as unknown as MinimalDb;
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS fragment_index (
      name         TEXT PRIMARY KEY,
      category     TEXT NOT NULL,
      version      TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      doc          TEXT NOT NULL,
      embedding    BLOB
    );
  `);
  db.exec(
    `SELECT vector_init('fragment_index','embedding','type=FLOAT32,dimension=${EMBEDDING_DIMENSION},distance=COSINE');`,
  );
  return db;
}

function getDb(): Promise<MinimalDb> {
  dbPromise ??= openDb();
  return dbPromise;
}

// ── Embeddings (OpenRouter) ───────────────────────────────────────────────

async function embed(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is required for fragment search");
  const response = await fetch("https://openrouter.ai/api/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: texts }),
  });
  const body = (await response.json()) as {
    data?: Array<{ embedding: number[] }>;
    error?: { message?: string };
  };
  if (!response.ok || !body.data) {
    throw new Error(`embeddings request failed: ${body.error?.message ?? response.status}`);
  }
  return body.data.map((d) => d.embedding);
}

// ── Docs + sync ───────────────────────────────────────────────────────────

/** The full reference doc handed to the agent on retrieval. */
function buildDoc(fragment: Fragment<unknown>): string {
  const jsonSchema = z.toJSONSchema(fragment.params as z.ZodType, {
    unrepresentable: "any",
    io: "input",
  }) as { properties?: Record<string, unknown> };
  return [
    `### ${fragment.name} (${fragment.category})`,
    fragment.description,
    fragment.whenToUse ? `When to use: ${fragment.whenToUse}` : "",
    `params: ${JSON.stringify(jsonSchema.properties ?? {})}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** The retrieval-oriented text that gets embedded. */
function buildEmbedText(fragment: Fragment<unknown>): string {
  return [
    `${fragment.name} (${fragment.category}): ${fragment.description}`,
    fragment.whenToUse ? `When to use: ${fragment.whenToUse}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");

export interface SyncResult {
  added: string[];
  updated: string[];
  removed: string[];
  skipped: number;
}

/**
 * Upsert the registry into the vector index. Hash-guarded: unchanged
 * fragments cost nothing; only new/changed docs get (re-)embedded.
 */
export async function syncFragmentIndex(registry: FragmentRegistry): Promise<SyncResult> {
  const db = await getDb();
  const existing = new Map(
    (db.prepare("SELECT name, content_hash FROM fragment_index").all() as Array<{
      name: string;
      content_hash: string;
    }>).map((row) => [row.name, row.content_hash]),
  );

  const result: SyncResult = { added: [], updated: [], removed: [], skipped: 0 };
  const pending: Array<{ fragment: Fragment<unknown>; doc: string; hash: string; text: string }> = [];

  for (const fragment of Object.values(registry)) {
    const doc = buildDoc(fragment);
    const text = buildEmbedText(fragment);
    const hash = sha256(`${fragment.version}\n${text}\n${doc}`);
    if (existing.get(fragment.name) === hash) {
      result.skipped++;
    } else {
      pending.push({ fragment, doc, hash, text });
      (existing.has(fragment.name) ? result.updated : result.added).push(fragment.name);
    }
    existing.delete(fragment.name);
  }

  if (pending.length > 0) {
    const vectors = await embed(pending.map((p) => p.text));
    const upsert = db.prepare(
      `INSERT INTO fragment_index (name, category, version, content_hash, doc, embedding)
       VALUES (?, ?, ?, ?, ?, vector_as_f32(?))
       ON CONFLICT(name) DO UPDATE SET category=excluded.category, version=excluded.version,
         content_hash=excluded.content_hash, doc=excluded.doc, embedding=excluded.embedding`,
    );
    pending.forEach((p, i) => {
      upsert.run(
        p.fragment.name,
        p.fragment.category,
        p.fragment.version,
        p.hash,
        p.doc,
        JSON.stringify(vectors[i]),
      );
    });
  }

  // fragments that vanished from the registry
  const remove = db.prepare("DELETE FROM fragment_index WHERE name = ?");
  for (const stale of existing.keys()) {
    remove.run(stale);
    result.removed.push(stale);
  }

  return result;
}

// ── Search ────────────────────────────────────────────────────────────────

export interface FragmentMatch {
  name: string;
  category: string;
  doc: string;
  /** Raw cosine similarity (1 - cosine distance). */
  similarity: number;
  /** Similarity relative to the best match for this query (best = 1). */
  score: number;
  belowThreshold?: boolean;
}

/**
 * Absolute cosine-similarity floor that separates "on-topic" from "the whole
 * library is irrelevant" (text-embedding-3-small: on-topic hits measure
 * ~0.45-0.6 here; unrelated queries ~0.2-0.27).
 */
const ABSOLUTE_SIMILARITY_FLOOR = 0.35;

/**
 * Returns EVERY fragment scoring ≥ minScore (no top-k cap), where score is
 * relative to the query's best match — raw cosine similarities from
 * text-embedding-3-small cluster well below 0.8 even for on-topic hits, so
 * "≥80%" is interpreted as "within 80% of the best match". An absolute
 * similarity floor filters out matches when the whole library is off-topic;
 * if nothing qualifies, the single best match is returned flagged
 * belowThreshold so the agent knows the library likely has nothing relevant.
 */
export async function searchFragments(
  registry: FragmentRegistry,
  query: string,
  minScore = 0.8,
): Promise<FragmentMatch[]> {
  await syncFragmentIndex(registry);
  const db = await getDb();
  const [queryVector] = await embed([query]);

  const rows = db
    .prepare(
      `SELECT f.name, f.category, f.doc, v.distance
       FROM fragment_index AS f
       JOIN vector_full_scan('fragment_index','embedding', vector_as_f32(?)) AS v
         ON f.rowid = v.rowid
       ORDER BY v.distance ASC`,
    )
    .all(JSON.stringify(queryVector)) as Array<{
    name: string;
    category: string;
    doc: string;
    distance: number;
  }>;

  if (rows.length === 0) return [];

  const best = 1 - rows[0].distance;
  const matches = rows.map((row) => {
    const similarity = 1 - row.distance;
    return {
      name: row.name,
      category: row.category,
      doc: row.doc,
      similarity: round(similarity),
      score: round(best > 0 ? similarity / best : 0),
    };
  });

  const passing = matches.filter(
    (m) => m.score >= minScore && m.similarity >= ABSOLUTE_SIMILARITY_FLOOR,
  );
  if (passing.length > 0) return passing;
  return [{ ...matches[0], belowThreshold: true }];
}

const round = (n: number) => Math.round(n * 1000) / 1000;
