import {
  LOCAL_ACTION_TYPES,
  SpecSchema,
  type Spec,
} from "@/lib/jr/schema";
import type { EntityDefinition } from "./entity-store";

/**
 * Data-flow validators ported from the rapp POC — the checks Zod's structural
 * pass can't see. Every message is written as a repair instruction for the
 * LLM: where, why, and the corrected shape.
 */

export interface ValidationInput {
  spec: unknown;
  /** Names of pages that exist (or are being created) — ui.navigate targets. */
  validPageNames: string[];
  entities: EntityDefinition[];
}

/**
 * In-place repairs for the agent's recurring shape mistakes, run BEFORE the
 * spec is written so the persisted page is correct.
 *
 * `clickable` hoist: the agent frequently emits `clickable: true` at the
 * ELEMENT level (sibling of type/props/on), but components read it from
 * `props.clickable` (e.g. Stack only wires its press onClick when
 * `props.clickable` is truthy). Misplaced, the element looks clickable
 * (cursor-pointer className) but never fires its `on.press` actions. Move it in.
 */
export function normalizePageSpec(spec: unknown): void {
  if (!spec || typeof spec !== "object") return;
  const elements = (spec as { elements?: unknown }).elements;
  if (!elements || typeof elements !== "object") return;
  for (const el of Object.values(elements as Record<string, unknown>)) {
    if (!el || typeof el !== "object") continue;
    const e = el as Record<string, unknown>;
    if ("clickable" in e) {
      const props = (e.props && typeof e.props === "object" ? e.props : {}) as Record<string, unknown>;
      if (props.clickable === undefined) props.clickable = e.clickable;
      e.props = props;
      delete e.clickable;
    }
  }
}

export function validatePageSpec(input: ValidationInput): string[] {
  const issues: string[] = [];

  const parsed = SpecSchema.safeParse(input.spec);
  if (!parsed.success) {
    for (const issue of parsed.error.issues.slice(0, 12)) {
      issues.push(`spec${issue.path.length ? "." + issue.path.join(".") : ""}: ${issue.message}`);
    }
    return issues;
  }
  const spec = parsed.data as Spec;
  const datasourceNames = new Set(Object.keys(spec.datasources ?? {}));
  const entityNames = new Set(input.entities.map((e) => e.name));
  const validSlugs = new Set(input.validPageNames.map(slug));

  checkChildrenRefs(spec, issues);
  walkValues(spec.elements, (value, path) => {
    checkDatasourceRefs(value, path, datasourceNames, issues);
    checkStateRefsToQueries(value, path, issues);
  });
  checkActions(spec, datasourceNames, validSlugs, input.validPageNames, issues);
  checkDatasources(spec, datasourceNames, entityNames, input.entities, issues);
  checkOrphanSeeds(spec, datasourceNames, issues);

  return issues;
}

const slug = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, "");

function checkChildrenRefs(spec: Spec, issues: string[]): void {
  for (const [key, element] of Object.entries(spec.elements)) {
    for (const child of element.children ?? []) {
      if (!(child in spec.elements)) {
        issues.push(
          `elements.${key}.children references "${child}" but no element with that key exists. Add the element or remove the reference.`,
        );
      }
    }
  }
}

/** Walk every prop/params value in elements, visiting directive objects. */
function walkValues(
  root: unknown,
  visit: (value: Record<string, unknown>, path: string) => void,
  path = "elements",
): void {
  if (Array.isArray(root)) {
    root.forEach((v, i) => walkValues(v, visit, `${path}[${i}]`));
    return;
  }
  if (root && typeof root === "object") {
    const obj = root as Record<string, unknown>;
    visit(obj, path);
    for (const [k, v] of Object.entries(obj)) walkValues(v, visit, `${path}.${k}`);
  }
}

function checkDatasourceRefs(
  value: Record<string, unknown>,
  path: string,
  declared: Set<string>,
  issues: string[],
): void {
  if (typeof value.$datasource !== "string") return;
  const name = value.$datasource.split("/")[0];
  if (!declared.has(name)) {
    issues.push(
      `${path}: {$datasource: "${value.$datasource}"} references datasource "${name}" which is not declared in spec.datasources. Declared: [${[...declared].join(", ")}]`,
    );
  }
}

function checkStateRefsToQueries(
  value: Record<string, unknown>,
  path: string,
  issues: string[],
): void {
  // `visible` conditions may legitimately test datasource results
  // (e.g. empty states on /queries/<ds>/page/total) — only prop/param
  // BINDINGS must go through $datasource.
  if (path.includes(".visible")) return;
  const ref = value.$state ?? value.$bindState;
  if (typeof ref !== "string") return;
  if (ref.startsWith("/queries/") || ref.startsWith("/metrics/")) {
    issues.push(
      `${path}: {$state: "${ref}"} reads a datasource result through $state. Use {"$datasource": "${ref.replace(/^\/queries\//, "").replace(/^\//, "")}"} instead — $state is for user-input state (/filters/*, /form/*, /ui/*) only.`,
    );
  }
}

function checkActions(
  spec: Spec,
  datasources: Set<string>,
  validSlugs: Set<string>,
  validNames: string[],
  issues: string[],
): void {
  const visitBinding = (binding: unknown, where: string) => {
    if (Array.isArray(binding)) {
      binding.forEach((b, i) => visitBinding(b, `${where}[${i}]`));
      return;
    }
    if (!binding || typeof binding !== "object") return;
    const b = binding as { action?: string; params?: Record<string, unknown> };
    if (!b.action) return;
    if (!(LOCAL_ACTION_TYPES as readonly string[]).includes(b.action)) {
      issues.push(
        `${where}: action "${b.action}" is not one of the 5 local actions [${LOCAL_ACTION_TYPES.join(", ")}]. Backend operations are DATASOURCES — declare it in spec.datasources and trigger it with {action: "datasource.fire", params: {name: "<dsName>"}}.`,
      );
      return;
    }
    if (b.action === "datasource.fire" || b.action === "datasource.refresh") {
      const names = Array.isArray(b.params?.names)
        ? (b.params!.names as string[])
        : [b.params?.name].filter((n): n is string => typeof n === "string");
      for (const name of names) {
        if (!datasources.has(name)) {
          issues.push(
            `${where}: ${b.action} targets datasource "${name}" which is not declared. Declared: [${[...datasources].join(", ")}]`,
          );
        }
      }
    }
    if (b.action === "ui.navigate") {
      const to = b.params?.to ?? b.params?.path;
      if (typeof to !== "string" || !to) {
        issues.push(`${where}: ui.navigate requires params.to (a page name). Valid targets: [${validNames.join(", ")}]`);
      } else if (validSlugs.size > 0 && !validSlugs.has(slug(to)) && !validSlugs.has(slug(to.split("/").pop() ?? ""))) {
        issues.push(
          `${where}: ui.navigate target "${to}" does not match any page. Valid targets: [${validNames.join(", ")}]. Never invent a page name; if the destination doesn't exist yet, create that page first or omit the button.`,
        );
      }
    }
  };

  for (const [key, element] of Object.entries(spec.elements)) {
    for (const [event, binding] of Object.entries(element.on ?? {})) {
      visitBinding(binding, `elements.${key}.on.${event}`);
    }
    for (const [watched, binding] of Object.entries(element.watch ?? {})) {
      visitBinding(binding, `elements.${key}.watch["${watched}"]`);
    }
  }
  (spec.init ?? []).forEach((step, i) => visitBinding(step, `init[${i}]`));
  for (const [watched, binding] of Object.entries(spec.watch ?? {})) {
    visitBinding(binding, `watch["${watched}"]`);
  }
}

function checkDatasources(
  spec: Spec,
  declared: Set<string>,
  entityNames: Set<string>,
  entities: EntityDefinition[],
  issues: string[],
): void {
  for (const [name, ds] of Object.entries(spec.datasources ?? {})) {
    const params = ds.params as Record<string, unknown>;
    const bdo = params?.bdo;
    if (typeof bdo === "string" && !entityNames.has(bdo)) {
      issues.push(
        `datasources.${name}: bdo "${bdo}" is not a defined entity. Defined entities: [${[...entityNames].join(", ")}]. Call defineEntity first.`,
      );
    }
    if (typeof bdo === "string" && entityNames.has(bdo)) {
      const entity = entities.find((e) => e.name === bdo)!;
      const fieldIds = new Set([...entity.fields.map((f) => f.id), "_id"]);
      walkValues(params, (value, path) => {
        if (typeof value.LHSField === "string" && !fieldIds.has(value.LHSField)) {
          issues.push(
            `datasources.${name} ${path}: filter field "${value.LHSField}" does not exist on entity "${bdo}". Fields: [${[...fieldIds].join(", ")}]`,
          );
        }
      }, "params");
    }
    if (!("type" in ds) || isRead(ds.type)) continue;
    const refresh = (ds as { refresh?: string[] }).refresh;
    for (const target of refresh ?? []) {
      if (!declared.has(target)) {
        issues.push(
          `datasources.${name}.refresh: "${target}" is not a declared datasource. Declared: [${[...declared].join(", ")}]`,
        );
      }
    }
  }
}

function isRead(type: string): boolean {
  return type.startsWith("bdo.") ? !["bdo.save", "bdo.delete"].includes(type) : type.endsWith(".list") || type.endsWith(".get");
}

function checkOrphanSeeds(spec: Spec, datasources: Set<string>, issues: string[]): void {
  const state = spec.state ?? {};
  for (const reserved of ["queries", "metrics"]) {
    const bucket = state[reserved];
    if (!bucket || typeof bucket !== "object") continue;
    for (const key of Object.keys(bucket as Record<string, unknown>)) {
      const covered = [...datasources].some((name) => {
        const ds = spec.datasources?.[name];
        const into = (ds as { into?: string } | undefined)?.into ?? `/queries/${name}`;
        return into === `/${reserved}/${key}`;
      });
      if (!covered) {
        issues.push(
          `state./${reserved}/${key}: seeded result data with NO datasource writing to /${reserved}/${key} — it would render as fake permanent data. Either declare a datasource with into "/${reserved}/${key}" or remove the seed.`,
        );
      }
    }
  }
}
