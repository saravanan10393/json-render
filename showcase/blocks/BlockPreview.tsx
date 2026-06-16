"use client";

/**
 * Renders an expanded block spec live in the showcase — a router-free mirror of
 * lib/runtime/screen-renderer.tsx: fresh state store, a DatasourceEngine wired
 * to an in-memory mock executor (seeded sample records), the $datasource
 * directive, the 5 local actions, and the mount-time init chain. ui.navigate is
 * a no-op toast here since there is no app router in the gallery.
 */
import {
  createStateStore,
  defineDirective,
  getByPath,
  resolveDynamicValue,
} from "@json-render/core";
import { JSONUIProvider, Renderer } from "@json-render/react";
import { useEffect, useMemo } from "react";
import { toast } from "sonner";
import { z } from "zod";
import type { Spec } from "@/lib/jr/schema";
import { registry } from "@/lib/jr/registry";
import { DatasourceEngine } from "@/lib/runtime/datasource-engine";
import { PreviewErrorBoundary } from "../shared/PreviewErrorBoundary";
import { createMockExecutor } from "./mockDatasource";

type Rec = Record<string, unknown>;

export function BlockPreview({ spec, seed }: { spec: Spec; seed: Record<string, Rec[]> }) {
  // Remount (fresh store + engine + reseeded mock) whenever the block changes.
  const key = useMemo(() => JSON.stringify(spec) + JSON.stringify(seed), [spec, seed]);

  const { store, engine, handlers, directive, runLocalAction } = useMemo(() => {
    const store = createStateStore({ ...(spec.state ?? {}) });

    const runLocalAction = async (
      action: string,
      rawParams: Record<string, unknown> | undefined,
    ): Promise<void> => {
      const params = resolveActionParams(rawParams, store.getSnapshot());
      switch (action) {
        case "setState": {
          const path = String(params?.statePath ?? "");
          if (path) store.set(path, params?.value);
          return;
        }
        case "ui.toast": {
          const message = String(params?.message ?? "");
          const kind = String(params?.kind ?? params?.variant ?? "default");
          if (kind === "error") toast.error(message);
          else if (kind === "success") toast.success(message);
          else toast(message);
          return;
        }
        case "ui.navigate": {
          // No app router in the gallery — surface the intent instead.
          toast(`navigate → ${String(params?.to ?? params?.path ?? "")}`);
          return;
        }
        case "datasource.refresh": {
          const names = Array.isArray(params?.names)
            ? (params.names as string[])
            : [String(params?.name ?? "")].filter(Boolean);
          await engine.refresh(names);
          return;
        }
        case "datasource.fire": {
          const name = String(params?.name ?? "");
          if (name) await engine.fire(name);
          return;
        }
        default:
          console.warn(`[block-preview] unknown action "${action}"`);
      }
    };

    const engine = new DatasourceEngine(
      "__showcase__",
      store,
      runLocalAction,
      (m, k) => (k === "error" ? toast.error(m) : toast(m)),
      createMockExecutor(seed),
    );

    const handlers: Record<string, (params: Record<string, unknown>) => unknown> = {
      "ui.toast": (p) => runLocalAction("ui.toast", p),
      "ui.navigate": (p) => runLocalAction("ui.navigate", p),
      "datasource.refresh": (p) => runLocalAction("datasource.refresh", p),
      "datasource.fire": (p) => runLocalAction("datasource.fire", p),
    };

    const directive = defineDirective({
      name: "$datasource",
      description: 'Read a datasource result envelope: "<name>" or "<name>/<path>".',
      schema: z.string(),
      resolve: (value, ctx) => {
        const ref =
          typeof value === "string"
            ? value
            : String((value as unknown as { $datasource: string }).$datasource);
        const [name, ...rest] = ref.split("/");
        const base = engine.has(name) ? engine.intoPathOf(name) : `/queries/${name}`;
        const path = rest.length ? `${base}/${rest.join("/")}` : base;
        return getByPath(ctx.stateModel, path);
      },
    });

    return { store, engine, handlers, directive, runLocalAction };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    engine.register(spec.datasources);
    let cancelled = false;
    void (async () => {
      for (const step of spec.init ?? []) {
        if (cancelled) break;
        try {
          await runLocalAction(step.action, step.params as Record<string, unknown> | undefined);
        } catch (e) {
          console.warn("[block-preview init]", e);
        }
      }
    })();
    return () => {
      cancelled = true;
      engine.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine]);

  return (
    <PreviewErrorBoundary key={key}>
      <JSONUIProvider
        registry={registry}
        store={store}
        handlers={handlers}
        navigate={() => {}}
        directives={[directive]}
      >
        <Renderer spec={spec as never} registry={registry} />
      </JSONUIProvider>
    </PreviewErrorBoundary>
  );
}

/** Resolve $-bindings in action params against live state (mirrors ScreenRenderer). */
function resolveActionParams(
  params: Record<string, unknown> | undefined,
  state: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (!params) return params;
  const resolve = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(resolve);
    if (value && typeof value === "object") {
      const obj = value as Record<string, unknown>;
      if (typeof obj.$datasource === "string") {
        const [name, ...rest] = (obj.$datasource as string).split("/");
        const base = `/queries/${name}`;
        return getByPath(state, rest.length ? `${base}/${rest.join("/")}` : base);
      }
      if (Object.keys(obj).some((k) => k.startsWith("$"))) {
        return resolveDynamicValue(obj as never, state);
      }
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(obj)) out[k] = resolve(v);
      return out;
    }
    return value;
  };
  return resolve(params) as Record<string, unknown>;
}
