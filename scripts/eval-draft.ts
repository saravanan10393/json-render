/**
 * Draft-fragment evaluator — runs in a FRESH bun subprocess per call (module
 * cache isolation; a re-saved draft always re-imports cleanly).
 *
 *   bun scripts/eval-draft.ts <absolute-draft-path> ['<paramsJson>']
 *
 * Imports the draft module, finds the exported Fragment, parses params with
 * the fragment's own Zod schema (defaults applied), expands it inside a
 * minimal page via the REAL eject-on-write expander (draft injected into a
 * temp registry), then runs every page validator against the standard studio
 * entities. Prints ONE JSON object to stdout:
 *   { ok, issues: string[], meta?, spec? }
 */
import { fragmentRegistry } from "../fragments";
import { expandFragments } from "../lib/server/fragment-expander";
import { validatePageSpec } from "../lib/server/spec-validators";
import { STANDARD_ENTITIES } from "../lib/server/standard-entities";
import { z } from "zod";
import type { Fragment } from "../lib/jr/schema";

interface EvalOutput {
  ok: boolean;
  issues: string[];
  meta?: {
    id: string;
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

function emit(out: EvalOutput): never {
  console.log(JSON.stringify(out));
  process.exit(0);
}

const [draftPath, paramsJson] = process.argv.slice(2);
if (!draftPath) emit({ ok: false, issues: ["usage: eval-draft <path> [paramsJson]"] });

let mod: Record<string, unknown>;
try {
  mod = (await import(draftPath)) as Record<string, unknown>;
} catch (error) {
  emit({
    ok: false,
    issues: [`draft failed to import (syntax/type error): ${error instanceof Error ? error.message : String(error)}`],
  });
}

const fragment = Object.values(mod!).find(
  (v): v is Fragment<unknown> =>
    !!v && typeof v === "object" && "build" in v && "params" in v && "id" in v && "name" in v,
);
if (!fragment) {
  emit({
    ok: false,
    issues: ["draft does not export a Fragment ({ id, name, version, description, category, params, build })"],
  });
}

let params: Record<string, unknown> = fragment!.previewParams ?? {};
if (paramsJson) {
  try {
    params = JSON.parse(paramsJson);
  } catch {
    emit({ ok: false, issues: ["params is not valid JSON"] });
  }
}

const ns = "preview";
const page = {
  root: "page",
  elements: {
    page: {
      type: "Stack",
      props: { direction: "vertical", gap: "lg", className: "p-8" },
      children: [ns],
    },
    [ns]: { $fragment: fragment!.id, params },
  },
};

const registry = { ...fragmentRegistry, [fragment!.id]: fragment! };
const { spec, issues, expanded } = expandFragments(page, registry);
if (issues.length > 0 || expanded.length === 0) {
  emit({ ok: false, issues: issues.length ? issues : ["fragment did not expand"] });
}

const validationIssues = validatePageSpec({
  spec,
  validPageNames: ["Shop", "Cart", "Checkout", "Orders", "Dashboard", "Home"],
  entities: STANDARD_ENTITIES,
});

let paramsResolved: unknown = params;
let paramsSchema: unknown = {};
try {
  paramsResolved = (fragment!.params as z.ZodType).parse(params);
  const json = z.toJSONSchema(fragment!.params as z.ZodType, {
    unrepresentable: "any",
    io: "input",
  }) as { properties?: unknown };
  paramsSchema = json.properties ?? {};
} catch {
  // params schema itself misbehaving is reported via expansion issues
}

emit({
  ok: validationIssues.length === 0,
  issues: validationIssues,
  meta: {
    id: fragment!.id,
    name: fragment!.name,
    category: fragment!.category,
    version: fragment!.version,
    description: fragment!.description,
    whenToUse: fragment!.whenToUse ?? null,
    paramsResolved,
    paramsSchema,
  },
  spec,
});
