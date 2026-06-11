import { z } from "zod";
import type { Fragment, FragmentRegistry } from "@/lib/jr/schema";
import { FragmentRefSchema } from "@/lib/jr/schema";

/** What build() actually returns (the authoring-contract FragmentOutput). */
type BuildOutput = ReturnType<Fragment<unknown>["build"]>;

/**
 * Eject-on-write fragment expander.
 *
 * A SOURCE spec may contain elements of the form
 *   "products-grid": { "$fragment": "ProductGrid", "params": {...} }
 * The element KEY becomes the namespace `ns`. Expansion validates params with
 * the fragment's own Zod schema, calls build(params, ns), enforces the
 * ns-prefix invariant, and merges the output into the page:
 *
 *   elements     — collision-guarded merge; output.root === ns keeps parent
 *                  `children` references valid with zero rewriting
 *   datasources  — collision-guarded merge (names must be ns-prefixed)
 *   state        — DEEP merge of top-level subtrees, so a fragment seeding
 *                  { ui: { [ns]: {...} }, filters: { [ns]: {...} } } lands at
 *                  the conventional /ui/<ns>/* and /filters/<ns>/* paths
 *   init         — appended after page-authored init steps
 *
 * Everything emitted is tagged with _meta.boundary and recorded in the
 * top-level _boundaries manifest so tooling can recover instance boundaries.
 * The persisted page contains primitives only.
 */

interface ExpandResult {
  spec: Record<string, unknown>;
  issues: string[];
  expanded: string[];
}

type Elements = Record<string, Record<string, unknown>>;

export function expandFragments(
  sourceSpec: Record<string, unknown>,
  registry: FragmentRegistry,
): ExpandResult {
  const issues: string[] = [];
  const expanded: string[] = [];

  const spec = structuredClone(sourceSpec);
  const elements = (spec.elements ?? {}) as Elements;
  const datasources = (spec.datasources ?? {}) as Record<string, unknown>;
  const state = (spec.state ?? {}) as Record<string, unknown>;
  const init = [...((spec.init ?? []) as unknown[])];
  const boundaries = (spec._boundaries ?? {}) as Record<string, unknown>;

  const refs = Object.entries(elements).filter(([, el]) => "$fragment" in el);
  if (refs.length === 0) return { spec, issues, expanded };

  for (const [ns, rawRef] of refs) {
    const parsedRef = FragmentRefSchema.safeParse(rawRef);
    if (!parsedRef.success) {
      issues.push(
        `elements.${ns}: invalid $fragment reference — expected { "$fragment": "<Name>", "params": {...} }`,
      );
      continue;
    }
    const { $fragment: name, params: rawParams } = parsedRef.data;

    const fragment = registry[name] as Fragment<unknown> | undefined;
    if (!fragment) {
      issues.push(
        `elements.${ns}: unknown fragment "${name}". Available: [${Object.keys(registry).join(", ")}]`,
      );
      continue;
    }

    const paramsResult = (fragment.params as z.ZodType).safeParse(rawParams ?? {});
    if (!paramsResult.success) {
      for (const issue of paramsResult.error.issues.slice(0, 6)) {
        issues.push(
          `elements.${ns} ($fragment ${name}) params${issue.path.length ? "." + issue.path.join(".") : ""}: ${issue.message}`,
        );
      }
      continue;
    }

    let output: BuildOutput;
    try {
      output = fragment.build(paramsResult.data, ns);
    } catch (error) {
      issues.push(
        `elements.${ns} ($fragment ${name}): build() threw — ${error instanceof Error ? error.message : String(error)}`,
      );
      continue;
    }

    const invariantProblems = checkNsInvariants(output, ns);
    if (invariantProblems.length > 0) {
      issues.push(
        `elements.${ns} ($fragment ${name}): ${invariantProblems.join("; ")}`,
      );
      continue;
    }

    const boundaryId = `${name}:${ns}`;

    // elements — replace the ref; root key === ns keeps parent children valid
    delete elements[ns];
    let collided = false;
    for (const [key, element] of Object.entries(output.elements)) {
      if (key in elements) {
        issues.push(
          `elements.${ns} ($fragment ${name}): emitted element "${key}" collides with an existing element`,
        );
        collided = true;
        continue;
      }
      elements[key] = {
        ...(element as unknown as Record<string, unknown>),
        _meta: {
          ...((element as { _meta?: Record<string, unknown> })._meta ?? {}),
          boundary: boundaryId,
          role: key === ns ? "root" : "child",
        },
      };
    }
    if (collided) continue;

    // datasources
    const datasourceIds: string[] = [];
    for (const [dsName, ds] of Object.entries(output.datasources ?? {})) {
      if (dsName in datasources) {
        issues.push(
          `elements.${ns} ($fragment ${name}): datasource "${dsName}" collides with an existing datasource`,
        );
        continue;
      }
      datasources[dsName] = {
        ...(ds as unknown as Record<string, unknown>),
        _meta: { boundary: boundaryId },
      };
      datasourceIds.push(dsName);
    }

    // state — deep merge of subtrees ({ ui: { [ns]: {...} } } → /ui/<ns>/*)
    deepMergeState(state, output.state ?? {}, issues, `$fragment ${name} (${ns})`);

    // init — appended; record contributed indices
    const initIndices: number[] = [];
    for (const step of output.init ?? []) {
      initIndices.push(init.length);
      init.push(step);
    }

    boundaries[boundaryId] = {
      fragmentName: fragment.name,
      fragmentVersion: fragment.version,
      instanceId: ns,
      params: (rawParams ?? {}) as Record<string, unknown>,
      ejectedAt: new Date().toISOString(),
      rootElementId: ns,
      elementIds: Object.keys(output.elements),
      datasourceIds,
      initIndices,
    };
    expanded.push(`${name} → ${ns}`);
  }

  spec.elements = elements;
  if (Object.keys(datasources).length > 0) spec.datasources = datasources;
  if (Object.keys(state).length > 0) spec.state = state;
  if (init.length > 0) spec.init = init;
  if (Object.keys(boundaries).length > 0) spec._boundaries = boundaries;

  // One level of nesting is allowed (a fragment may emit $fragment refs);
  // recurse until stable with a small depth cap as a runaway guard.
  const hasNestedRefs = Object.values(spec.elements as Elements).some(
    (el) => "$fragment" in el,
  );
  if (issues.length === 0 && hasNestedRefs) {
    const depth = ((spec.__expandDepth as number) ?? 0) + 1;
    if (depth > 3) {
      issues.push("fragment expansion exceeded max nesting depth (3)");
      return { spec, issues, expanded };
    }
    spec.__expandDepth = depth;
    const nested = expandFragments(spec, registry);
    delete (nested.spec as Record<string, unknown>).__expandDepth;
    return {
      spec: nested.spec,
      issues: nested.issues,
      expanded: [...expanded, ...nested.expanded],
    };
  }
  delete spec.__expandDepth;

  return { spec, issues, expanded };
}

/** root === ns, root key present, every element/datasource key ns-prefixed. */
function checkNsInvariants(output: BuildOutput, ns: string): string[] {
  const problems: string[] = [];
  if (output.root !== ns) {
    problems.push(`build() root "${output.root}" must equal ns "${ns}"`);
  }
  if (!(ns in output.elements)) {
    problems.push(`build() output is missing the root element key "${ns}"`);
  }
  const ok = (key: string) => key === ns || key.startsWith(`${ns}-`);
  for (const key of Object.keys(output.elements)) {
    if (!ok(key)) problems.push(`element id "${key}" is not ns-prefixed ("${ns}-")`);
  }
  for (const key of Object.keys(output.datasources ?? {})) {
    if (!ok(key)) problems.push(`datasource "${key}" is not ns-prefixed ("${ns}-")`);
  }
  return problems;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function deepMergeState(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
  issues: string[],
  origin: string,
  path = "",
): void {
  for (const [key, value] of Object.entries(source)) {
    const at = path ? `${path}/${key}` : `/${key}`;
    if (!(key in target)) {
      target[key] = value;
      continue;
    }
    if (isPlainObject(target[key]) && isPlainObject(value)) {
      deepMergeState(
        target[key] as Record<string, unknown>,
        value,
        issues,
        origin,
        at,
      );
      continue;
    }
    // Identical scalar seeds are not a conflict — silently keep the existing value.
    if (target[key] === value || JSON.stringify(target[key]) === JSON.stringify(value)) {
      continue;
    }
    issues.push(
      `${origin}: state seed at "${at}" conflicts with an existing non-object value`,
    );
  }
}
