import {
  getByPath,
  resolveDynamicValue,
  type StateStore,
} from "@json-render/core";
import {
  isReadDatasource,
  type DataSource,
  type DataSourceMap,
} from "@/lib/jr/schema";

/**
 * The datasource engine, following the rapp runtime design:
 *
 *  - each datasource declares its query with `$state` refs in params
 *  - the engine auto-subscribes to those refs; any change re-fires (debounced)
 *  - results land in an envelope at `into` (default /queries/<name>):
 *      { data, isLoading, error, lastFetchedAt }
 *  - nothing fires on mount — `spec.init` triggers the first loads explicitly
 *    via the `datasource.refresh` action
 *  - WRITE datasources fire only via `datasource.fire`; on success they run
 *    their `refresh` list and `on.success` hooks
 */

type LocalActionRunner = (
  action: string,
  params: Record<string, unknown> | undefined,
) => Promise<void>;

/**
 * Mode-specific optional fields flattened for uniform access — READ types
 * carry into/debounceMs/skipUntilReady/oneShot, WRITE types carry refresh.
 */
type AnyDataSource = DataSource &
  Partial<{
    into: string;
    debounceMs: number;
    skipUntilReady: boolean;
    oneShot: boolean;
    refresh: string[];
  }>;

interface RegisteredDatasource {
  name: string;
  def: AnyDataSource;
  intoPath: string;
  deps: string[];
  lastDepValues: unknown[];
  timer: ReturnType<typeof setTimeout> | null;
}

/** Collect every `{ $state: "/path" }` ref in a params tree. */
function extractStateRefs(value: unknown, refs: Set<string>): void {
  if (Array.isArray(value)) {
    for (const v of value) extractStateRefs(v, refs);
    return;
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (typeof obj.$state === "string" && Object.keys(obj).length === 1) {
      refs.add(obj.$state);
      return;
    }
    for (const v of Object.values(obj)) extractStateRefs(v, refs);
  }
}

/** Resolve every binding in a params tree against the current state. */
function resolveParams(value: unknown, state: Record<string, unknown>): unknown {
  if (Array.isArray(value)) return value.map((v) => resolveParams(v, state));
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj);
    if (keys.some((k) => k.startsWith("$"))) {
      // Single-key directive objects ($state, $template, $datasource…) resolve
      // via the core engine; $datasource refs read the envelope directly.
      if (typeof obj.$datasource === "string") {
        const [name, ...rest] = (obj.$datasource as string).split("/");
        const base = `/queries/${name}`;
        return getByPath(state, rest.length ? `${base}/${rest.join("/")}` : base);
      }
      return resolveDynamicValue(obj as never, state);
    }
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) out[k] = resolveParams(v, state);
    return out;
  }
  return value;
}

/** Drop filter conditions whose bound RHS resolved to null/empty, collapse empty groups. */
function pruneFilter(filter: unknown): unknown {
  if (!filter || typeof filter !== "object") return undefined;
  const group = filter as { Operator?: string; Condition?: unknown[] };
  if (!Array.isArray(group.Condition)) return filter;
  const kept = group.Condition.map((c) => {
    const cond = c as Record<string, unknown>;
    if (Array.isArray(cond.Condition)) return pruneFilter(cond);
    const op = String(cond.Operator ?? "");
    if (op === "EMPTY" || op === "NOT_EMPTY") return cond;
    const rhs = cond.RHSValue;
    if (rhs === null || rhs === undefined || rhs === "" || rhs === "All") return null;
    if (Array.isArray(rhs) && rhs.length === 0) return null;
    return cond;
  }).filter(Boolean);
  if (kept.length === 0) return undefined;
  return { ...group, Condition: kept };
}

export class DatasourceEngine {
  private registry = new Map<string, RegisteredDatasource>();
  private unsubscribe: (() => void) | null = null;
  private disposed = false;

  constructor(
    private appId: string,
    private store: StateStore,
    private runLocalAction: LocalActionRunner,
    private toast: (message: string, kind?: string) => void,
  ) {}

  register(datasources: DataSourceMap | undefined): void {
    // Re-arm after a previous dispose: React StrictMode double-invokes
    // effects (mount → cleanup → mount) against the same memoized engine.
    this.disposed = false;
    this.unsubscribe?.();
    if (!datasources) return;
    for (const [name, def] of Object.entries(datasources) as Array<
      [string, AnyDataSource]
    >) {
      const refs = new Set<string>();
      extractStateRefs(def.params, refs);
      this.registry.set(name, {
        name,
        def,
        intoPath: def.into ?? `/queries/${name}`,
        deps: [...refs],
        lastDepValues: [...refs].map((p) => this.store.get(p)),
        timer: null,
      });
      // Seed the envelope so $datasource reads are defined pre-first-fire.
      if (isReadDatasource(def) && this.store.get(this.intoPathOf(name)) === undefined) {
        this.store.set(this.intoPathOf(name), {
          data: null,
          isLoading: false,
          error: null,
          lastFetchedAt: null,
        });
      }
    }

    this.unsubscribe = this.store.subscribe(() => this.onStateChange());
  }

  dispose(): void {
    this.disposed = true;
    this.unsubscribe?.();
    for (const ds of this.registry.values()) {
      if (ds.timer) clearTimeout(ds.timer);
    }
  }

  intoPathOf(name: string): string {
    return this.registry.get(name)?.intoPath ?? `/queries/${name}`;
  }

  has(name: string): boolean {
    return this.registry.has(name);
  }

  /** READ deps changed → debounce → re-fire. WRITE and oneShot never auto-fire. */
  private onStateChange(): void {
    for (const ds of this.registry.values()) {
      if (!isReadDatasource(ds.def) || ds.def.oneShot || ds.deps.length === 0) continue;
      const current = ds.deps.map((p) => this.store.get(p));
      const changed = current.some(
        (v, i) =>
          v !== ds.lastDepValues[i] &&
          JSON.stringify(v) !== JSON.stringify(ds.lastDepValues[i]),
      );
      if (!changed) continue;
      ds.lastDepValues = current;
      const wait = ds.def.debounceMs ?? 250;
      if (ds.timer) clearTimeout(ds.timer);
      ds.timer = setTimeout(() => void this.fire(ds.name), wait);
    }
  }

  async refresh(names: string[]): Promise<void> {
    await Promise.all(names.map((n) => this.fire(n)));
  }

  async fire(name: string): Promise<void> {
    const ds = this.registry.get(name);
    if (!ds) {
      console.warn(`[datasource] fire("${name}") — no such datasource`);
      return;
    }
    if (this.disposed) return;

    const state = this.store.getSnapshot();
    if (isReadDatasource(ds.def) && ds.def.skipUntilReady) {
      const notReady = ds.deps.some((p) => {
        const v = this.store.get(p);
        return v === undefined || v === null || v === "";
      });
      if (notReady) return;
    }

    const resolved = resolveParams(ds.def.params, state) as Record<string, unknown>;
    if ("valuesPath" in resolved && typeof resolved.valuesPath === "string") {
      resolved.values = (getByPath(state, resolved.valuesPath) ?? {}) as Record<string, unknown>;
      delete resolved.valuesPath;
    }
    if ("Filter" in resolved) {
      const pruned = pruneFilter(resolved.Filter);
      if (pruned === undefined) delete resolved.Filter;
      else resolved.Filter = pruned;
    }

    const into = ds.intoPath;
    const prevEnvelope = (this.store.get(into) as Record<string, unknown>) ?? {};
    this.store.set(into, { ...prevEnvelope, isLoading: true });

    try {
      const response = await fetch(`/api/apps/${this.appId}/datasource`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: ds.def.type, params: resolved }),
      });
      const body = (await response.json()) as {
        result?: unknown;
        page?: unknown;
        error?: string;
      };
      if (!response.ok || body.error) {
        throw new Error(body.error ?? `datasource ${name} failed (${response.status})`);
      }
      if (this.disposed) return;
      this.store.set(into, {
        data: body.result ?? null,
        page: body.page ?? null,
        isLoading: false,
        error: null,
        lastFetchedAt: new Date().toISOString(),
      });
      await this.runHooks(ds, "success");
      // closePath convenience from bdo.save: close the dialog BEFORE the list
      // refresh so the UI doesn't flash stale data inside an open dialog.
      if (typeof resolved.closePath === "string") {
        this.store.set(resolved.closePath, false);
      }
      if (!isReadDatasource(ds.def) && ds.def.refresh?.length) {
        await this.refresh(ds.def.refresh);
      }
    } catch (error) {
      if (this.disposed) return;
      const message = error instanceof Error ? error.message : String(error);
      this.store.set(into, {
        ...((this.store.get(into) as Record<string, unknown>) ?? {}),
        isLoading: false,
        error: { message },
      });
      const hadErrorHook = await this.runHooks(ds, "error");
      if (!hadErrorHook && !isReadDatasource(ds.def)) {
        this.toast(message, "error");
      }
    }
  }

  private async runHooks(ds: RegisteredDatasource, kind: "success" | "error"): Promise<boolean> {
    const hooks = ds.def.on?.[kind];
    if (!hooks?.length) return false;
    for (const hook of hooks) {
      await this.runLocalAction(
        hook.action,
        hook.params as Record<string, unknown> | undefined,
      );
    }
    return true;
  }
}
