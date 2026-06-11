"use client";

import {
  createStateStore,
  defineDirective,
  getByPath,
  resolveDynamicValue,
} from "@json-render/core";
import { JSONUIProvider, Renderer } from "@json-render/react";
import { useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { z } from "zod";
import type { Spec } from "@/lib/jr/schema";
import { registry } from "@/lib/jr/registry";
import { DatasourceEngine } from "./datasource-engine";
import { useRouterBridge } from "./router-bridge";

/**
 * Renders ONE page spec with the full rapp runtime contract:
 * fresh state store per mount, datasource engine, $datasource directive,
 * the 5 LOCAL actions, and the mount-time init chain.
 */
export function ScreenRenderer({ appId, spec }: { appId: string; spec: Spec }) {
  const navigate = useNavigate();
  const bridge = useRouterBridge();
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  const { store, engine, handlers, jrNavigate, runLocalAction } = useMemo(() => {
    const store = createStateStore({ ...(spec.state ?? {}) });

    const runLocalAction = async (
      action: string,
      rawParams: Record<string, unknown> | undefined,
    ): Promise<void> => {
      // Hook/init params may carry bindings — resolve against live state.
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
          const target = String(params?.to ?? params?.path ?? "");
          if (target) jrNavigate(target);
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
          console.warn(`[actions] unknown action "${action}"`);
      }
    };

    const engine = new DatasourceEngine(appId, store, runLocalAction, (m, k) =>
      k === "error" ? toast.error(m) : toast(m),
    );

    /** Resolves page targets through the app's route table (set by AppShell). */
    const jrNavigate = (target: string) => {
      const path = bridge.resolve(target);
      navigateRef.current(path);
    };

    const handlers: Record<string, (params: Record<string, unknown>) => unknown> = {
      "ui.toast": (p) => runLocalAction("ui.toast", p),
      "ui.navigate": (p) => runLocalAction("ui.navigate", p),
      "datasource.refresh": (p) => runLocalAction("datasource.refresh", p),
      "datasource.fire": (p) => runLocalAction("datasource.fire", p),
      // legacy alias used by the phase-1 agent specs
      navigate: (p) => runLocalAction("ui.navigate", { to: p.path }),
    };

    return { store, engine, handlers, jrNavigate, runLocalAction };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appId, spec]);

  const datasourceDirective = useMemo(
    () =>
      defineDirective({
        name: "$datasource",
        description: "Read a datasource result envelope: \"<name>\" or \"<name>/<path>\".",
        schema: z.string(),
        resolve: (value, ctx) => {
          // core passes the WHOLE directive object, not the key's value
          const ref =
            typeof value === "string"
              ? value
              : String((value as unknown as { $datasource: string }).$datasource);
          const [name, ...rest] = ref.split("/");
          const base = engine.has(name) ? engine.intoPathOf(name) : `/queries/${name}`;
          const path = rest.length ? `${base}/${rest.join("/")}` : base;
          return getByPath(ctx.stateModel, path);
        },
      }),
    [engine],
  );

  useEffect(() => {
    engine.register(spec.datasources);
    let cancelled = false;
    void (async () => {
      for (const step of spec.init ?? []) {
        if (cancelled) break;
        try {
          await runLocalAction(
            step.action,
            step.params as Record<string, unknown> | undefined,
          );
        } catch (e) {
          console.warn("[init]", e);
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
    <JSONUIProvider
      registry={registry}
      store={store}
      handlers={handlers}
      navigate={jrNavigate}
      directives={[datasourceDirective]}
    >
      <Renderer spec={spec as never} registry={registry} />
    </JSONUIProvider>
  );
}

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
