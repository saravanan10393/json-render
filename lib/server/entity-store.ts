import { randomUUID } from "node:crypto";
import { db } from "./db";

/**
 * Local stand-in for the BDO backend: entity definitions + JSON records in
 * SQLite, with just enough of the bdo.* contract (list/get/metric/save/delete)
 * for generated apps to run. Filtering/sorting/aggregation happen in JS — app
 * datasets here are demo-sized.
 */

export interface EntityField {
  id: string;
  name: string;
  type: "text" | "number" | "boolean" | "date" | "select";
  options?: string[];
}

export interface EntityDefinition {
  name: string;
  label: string;
  fields: EntityField[];
}

type Rec = Record<string, unknown>;

// ── Definitions ───────────────────────────────────────────────────────────

export function listEntities(appId: string): EntityDefinition[] {
  const rows = db
    .prepare("SELECT definition FROM entities WHERE app_id = ? ORDER BY name")
    .all(appId) as Array<{ definition: string }>;
  return rows.map((r) => JSON.parse(r.definition));
}

export function getEntity(appId: string, name: string): EntityDefinition | null {
  const row = db
    .prepare("SELECT definition FROM entities WHERE app_id = ? AND name = ?")
    .get(appId, name) as { definition: string } | undefined;
  return row ? JSON.parse(row.definition) : null;
}

export function saveEntity(appId: string, definition: EntityDefinition): void {
  db.prepare(
    `INSERT INTO entities (app_id, name, definition) VALUES (?, ?, ?)
     ON CONFLICT(app_id, name) DO UPDATE SET definition = excluded.definition`,
  ).run(appId, definition.name, JSON.stringify(definition));
}

// ── Records ───────────────────────────────────────────────────────────────

function loadRecords(appId: string, entity: string): Rec[] {
  const rows = db
    .prepare(
      "SELECT _id, data FROM records WHERE app_id = ? AND entity = ? AND deleted = 0 ORDER BY created_at",
    )
    .all(appId, entity) as Array<{ _id: string; data: string }>;
  return rows.map((r) => ({ _id: r._id, ...JSON.parse(r.data) }));
}

export function saveRecord(appId: string, entity: string, values: Rec, _id?: string): Rec {
  const now = new Date().toISOString();
  const { _id: _ignored, ...data } = values;
  if (_id) {
    const existing = db
      .prepare("SELECT data FROM records WHERE app_id = ? AND entity = ? AND _id = ?")
      .get(appId, entity, _id) as { data: string } | undefined;
    const merged = { ...(existing ? JSON.parse(existing.data) : {}), ...data };
    db.prepare(
      `INSERT INTO records (app_id, entity, _id, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(app_id, entity, _id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at, deleted = 0`,
    ).run(appId, entity, _id, JSON.stringify(merged), now, now);
    return { _id, ...merged };
  }
  const id = randomUUID().slice(0, 12);
  db.prepare(
    "INSERT INTO records (app_id, entity, _id, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(appId, entity, id, JSON.stringify(data), now, now);
  return { _id: id, ...data };
}

export function deleteRecord(appId: string, entity: string, _id: string): void {
  db.prepare(
    "UPDATE records SET deleted = 1 WHERE app_id = ? AND entity = ? AND _id = ?",
  ).run(appId, entity, _id);
}

export function getRecord(appId: string, entity: string, _id: string): Rec | null {
  const row = db
    .prepare(
      "SELECT data FROM records WHERE app_id = ? AND entity = ? AND _id = ? AND deleted = 0",
    )
    .get(appId, entity, _id) as { data: string } | undefined;
  return row ? { _id, ...JSON.parse(row.data) } : null;
}

export function countRecords(appId: string, entity: string): number {
  const row = db
    .prepare(
      "SELECT COUNT(*) AS n FROM records WHERE app_id = ? AND entity = ? AND deleted = 0",
    )
    .get(appId, entity) as { n: number };
  return row.n;
}

// ── Query engine: Filter / Sort / Page / Search / Metric ─────────────────

interface FilterCondition {
  LHSField: string;
  Operator: string;
  RHSValue?: unknown;
}
interface FilterGroup {
  Operator: "AND" | "OR";
  Condition: Array<FilterCondition | FilterGroup>;
}

function isGroup(c: FilterCondition | FilterGroup): c is FilterGroup {
  return "Condition" in c;
}

function matchCondition(record: Rec, cond: FilterCondition): boolean {
  const value = record[cond.LHSField];
  const target = cond.RHSValue;
  switch (cond.Operator) {
    case "EQ": return value === target || String(value) === String(target);
    case "NEQ": return String(value) !== String(target);
    case "IN": return Array.isArray(target) && target.map(String).includes(String(value));
    case "NOT_IN": return Array.isArray(target) && !target.map(String).includes(String(value));
    case "GT": return Number(value) > Number(target);
    case "GTE": return Number(value) >= Number(target);
    case "LT": return Number(value) < Number(target);
    case "LTE": return Number(value) <= Number(target);
    case "CONTAINS": return String(value ?? "").toLowerCase().includes(String(target ?? "").toLowerCase());
    case "STARTS_WITH": return String(value ?? "").toLowerCase().startsWith(String(target ?? "").toLowerCase());
    case "ENDS_WITH": return String(value ?? "").toLowerCase().endsWith(String(target ?? "").toLowerCase());
    case "EMPTY": return value === null || value === undefined || value === "";
    case "NOT_EMPTY": return !(value === null || value === undefined || value === "");
    case "BETWEEN": {
      if (!Array.isArray(target) || target.length < 2) return false;
      const n = Number(value);
      return n >= Number(target[0]) && n <= Number(target[1]);
    }
    default: return true;
  }
}

function matchFilter(record: Rec, filter: FilterGroup): boolean {
  const results = filter.Condition.map((c) =>
    isGroup(c) ? matchFilter(record, c) : matchCondition(record, c),
  );
  return filter.Operator === "OR" ? results.some(Boolean) : results.every(Boolean);
}

function applySearch(records: Rec[], search: unknown): Rec[] {
  const term = String(search ?? "").trim().toLowerCase();
  if (!term) return records;
  return records.filter((r) =>
    Object.values(r).some((v) => String(v ?? "").toLowerCase().includes(term)),
  );
}

function applySort(records: Rec[], sort: Array<Record<string, "ASC" | "DESC">>): Rec[] {
  const keys = sort.flatMap((entry) => Object.entries(entry));
  if (keys.length === 0) return records;
  return [...records].sort((a, b) => {
    for (const [field, dir] of keys) {
      const av = a[field];
      const bv = b[field];
      let cmp: number;
      if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
      else cmp = String(av ?? "").localeCompare(String(bv ?? ""));
      if (cmp !== 0) return dir === "DESC" ? -cmp : cmp;
    }
    return 0;
  });
}

export interface ListParams {
  Search?: unknown;
  Filter?: FilterGroup;
  Sort?: Array<Record<string, "ASC" | "DESC">>;
  Page?: { number?: number; size?: number };
  Fields?: string[];
}

export function queryRecords(appId: string, entity: string, params: ListParams) {
  let records = loadRecords(appId, entity);
  if (params.Filter) records = records.filter((r) => matchFilter(r, params.Filter!));
  if (params.Search !== undefined) records = applySearch(records, params.Search);
  if (params.Sort) records = applySort(records, params.Sort);

  const total = records.length;
  const size = params.Page?.size ?? 50;
  const number = params.Page?.number ?? 1;
  records = records.slice((number - 1) * size, number * size);

  if (params.Fields?.length) {
    records = records.map((r) => {
      const projected: Rec = { _id: r._id };
      for (const f of params.Fields!) projected[f] = r[f];
      return projected;
    });
  }
  return { data: records, page: { number, size, total } };
}

export interface MetricParams {
  Metric: Array<{ Type: string; Field?: string }>;
  GroupBy?: string[];
  Filter?: FilterGroup;
  Search?: unknown;
}

function aggregate(records: Rec[], metric: { Type: string; Field?: string }): unknown {
  const values = metric.Field
    ? records.map((r) => r[metric.Field!]).filter((v) => v !== null && v !== undefined && v !== "")
    : [];
  const numbers = values.map(Number).filter((n) => !Number.isNaN(n));
  switch (metric.Type) {
    case "COUNT": return metric.Field ? values.length : records.length;
    case "SUM": return numbers.reduce((a, b) => a + b, 0);
    case "AVG": return numbers.length ? numbers.reduce((a, b) => a + b, 0) / numbers.length : 0;
    case "MAX": return numbers.length ? Math.max(...numbers) : null;
    case "MIN": return numbers.length ? Math.min(...numbers) : null;
    case "DISTINCT_COUNT": return new Set(values.map(String)).size;
    case "BLANK_COUNT": return records.length - values.length;
    case "NOT_BLANK_COUNT": return values.length;
    case "CONCAT": return values.map(String).join(", ");
    case "DISTINCT_CONCAT": return [...new Set(values.map(String))].join(", ");
    default: return null;
  }
}

function metricKey(metric: { Type: string; Field?: string }, index: number, total: number): string {
  if (total === 1) return "value";
  return metric.Field ? `${metric.Type.toLowerCase()}_${metric.Field}` : `metric_${index}`;
}

export function computeMetric(appId: string, entity: string, params: MetricParams) {
  let records = loadRecords(appId, entity);
  if (params.Filter) records = records.filter((r) => matchFilter(r, params.Filter!));
  if (params.Search !== undefined) records = applySearch(records, params.Search);

  if (!params.GroupBy?.length) {
    if (params.Metric.length === 1) {
      return { value: aggregate(records, params.Metric[0]) };
    }
    const out: Rec = {};
    params.Metric.forEach((m, i) => {
      out[metricKey(m, i, params.Metric.length)] = aggregate(records, m);
    });
    return out;
  }

  const groups = new Map<string, Rec[]>();
  for (const record of records) {
    const key = params.GroupBy.map((f) => String(record[f] ?? "")).join("\u0000");
    const bucket = groups.get(key) ?? [];
    bucket.push(record);
    groups.set(key, bucket);
  }
  const series = [...groups.entries()].map(([key, bucket]) => {
    const labels = key.split("\u0000");
    const point: Rec = {};
    params.GroupBy!.forEach((f, i) => {
      point[f] = labels[i];
    });
    params.Metric.forEach((m, i) => {
      point[metricKey(m, i, params.Metric.length)] = aggregate(bucket, m);
    });
    return point;
  });
  return { series };
}
