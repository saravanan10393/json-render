import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";

const DATA_ROOT = path.join(process.cwd(), "data");
mkdirSync(DATA_ROOT, { recursive: true });

const db = new DatabaseSync(path.join(DATA_ROOT, "builder.db"));

db.exec(`
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS apps (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    status      TEXT NOT NULL DEFAULT 'draft',
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS chat_messages (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    app_id     TEXT NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
    message_id TEXT NOT NULL,
    role       TEXT NOT NULL,
    payload    TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(app_id, message_id)
  );

  CREATE TABLE IF NOT EXISTS entities (
    app_id     TEXT NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    definition TEXT NOT NULL,
    PRIMARY KEY (app_id, name)
  );

  CREATE TABLE IF NOT EXISTS records (
    app_id     TEXT NOT NULL,
    entity     TEXT NOT NULL,
    _id        TEXT NOT NULL,
    data       TEXT NOT NULL,
    deleted    INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (app_id, entity, _id)
  );
`);

export { db, DATA_ROOT };
