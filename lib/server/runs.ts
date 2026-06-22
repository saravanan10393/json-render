import { readAllPages } from "./apps";
import { db } from "./db";
import type { ModelRole } from "./models";

/**
 * Per-app run state for the staged build pipeline (backend → design → frontend)
 * with human approval gates between stages. One active run per app.
 *
 * The orchestrator (the chat route) reads `stage` to choose the active agent
 * and to enforce the gates; `config` carries the builder-UI toggles. Stage
 * transitions are explicit (approve advances, request-changes/rebuild stay) —
 * see `nextStage`.
 */

// Each working stage doubles as its own approve-gate (backend → design →
// frontend), keeping the orchestrator simple. "done" is terminal.
export const STAGES = ["backend", "design", "frontend", "done"] as const;
export type Stage = (typeof STAGES)[number];

export interface RunConfig {
  /** Run the design stage. OFF = today's backend → frontend path. */
  designer: boolean;
  /** Let the frontend agent reuse fragments (vs primitives only). */
  fragments: boolean;
  /** Per-role model overrides (OpenRouter slugs). Empty = use the role default
   *  from `lib/server/models.ts` (GLM 5.2 / GLM 4.6V). */
  models?: Partial<Record<ModelRole, string>>;
}

export interface Run {
  appId: string;
  stage: Stage;
  config: RunConfig;
  updatedAt: string;
}

const DEFAULT_CONFIG: RunConfig = { designer: false, fragments: true, models: {} };

interface RunRow {
  app_id: string;
  stage: string;
  config: string;
  updated_at: string;
}

function parseConfig(raw: string): RunConfig {
  try {
    return { ...DEFAULT_CONFIG, ...(JSON.parse(raw) as Partial<RunConfig>) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

function rowToRun(row: RunRow): Run {
  return {
    appId: row.app_id,
    stage: (STAGES as readonly string[]).includes(row.stage) ? (row.stage as Stage) : "backend",
    config: parseConfig(row.config),
    updatedAt: row.updated_at,
  };
}

function persist(appId: string, stage: Stage, config: RunConfig): Run {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO runs (app_id, stage, config, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(app_id) DO UPDATE SET stage = excluded.stage, config = excluded.config, updated_at = excluded.updated_at`,
  ).run(appId, stage, JSON.stringify(config), now);
  return { appId, stage, config, updatedAt: now };
}

/** Read the run, or null if this app has none yet. */
export function getRun(appId: string): Run | null {
  const row = db.prepare("SELECT * FROM runs WHERE app_id = ?").get(appId) as RunRow | undefined;
  return row ? rowToRun(row) : null;
}

export function createRun(
  appId: string,
  { stage = "backend", config = {} }: { stage?: Stage; config?: Partial<RunConfig> } = {},
): Run {
  return persist(appId, stage, { ...DEFAULT_CONFIG, ...config });
}

/**
 * Read the run, inferring an initial stage from existing content the first
 * time — so apps built before the pipeline (entities and/or pages already on
 * disk) land in the right stage instead of being forced back to "backend".
 */
export function ensureRun(appId: string): Run {
  const existing = getRun(appId);
  if (existing) return existing;
  const stage: Stage = readAllPages(appId).length > 0 ? "frontend" : "backend";
  return createRun(appId, { stage });
}

export function setStage(appId: string, stage: Stage): Run {
  return persist(appId, stage, getRun(appId)?.config ?? { ...DEFAULT_CONFIG });
}

export function setConfig(appId: string, partial: Partial<RunConfig>): Run {
  const run = getRun(appId);
  return persist(appId, run?.stage ?? "backend", { ...(run?.config ?? DEFAULT_CONFIG), ...partial });
}

export function resetRun(appId: string): Run {
  return persist(appId, "backend", getRun(appId)?.config ?? { ...DEFAULT_CONFIG });
}

/** The stage that follows `stage` on approval, honouring the designer toggle. */
export function nextStage(stage: Stage, config: RunConfig): Stage {
  switch (stage) {
    case "backend":
      return config.designer ? "design" : "frontend";
    case "design":
      return "frontend";
    case "frontend":
      return "done";
    case "done":
      return "done";
  }
}

/** Which agent answers chat in this stage. */
export function agentForStage(stage: Stage): "backend" | "design" | "frontend" {
  if (stage === "backend") return "backend";
  if (stage === "design") return "design";
  return "frontend";
}

/** Stages that await an explicit human "approve" before advancing. */
export function isGate(stage: Stage): boolean {
  return stage === "backend" || stage === "design";
}
