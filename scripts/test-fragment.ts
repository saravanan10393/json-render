/**
 * Single-fragment test harness — expand + validate one fragment in isolation
 * and print what it ejects to, without touching any app.
 *
 *   bun run fragment:test <NameOrId> [paramsJson] [--full]
 *   bun run fragment:test ProductGrid               # PascalCase name
 *   bun run fragment:test fragment-product-grid     # …or the id
 *   bun run fragment:test ProductGrid '{"columns":4,"withDetailSheet":false}'
 *   bun run fragment:test CategoryNav '{"targetGridNs":"grid","categories":["A"]}' --full
 *
 * Runs the REAL pipeline savePage uses: eject-on-write expansion (ns-prefix
 * invariants, collision guards) + every page validator, against the standard
 * Product/CartItem/Order test entities. `--full` prints the whole expanded
 * spec instead of the summary.
 */
import { fragmentRegistry } from "../fragments";
import { expandFragments } from "../lib/server/fragment-expander";
import { validatePageSpec } from "../lib/server/spec-validators";
import { STANDARD_ENTITIES } from "../lib/server/standard-entities";

const args = process.argv.slice(2).filter((a) => a !== "--full");
const full = process.argv.includes("--full");
const [arg, paramsJson] = args;

if (!arg) {
  console.error("usage: bun run fragment:test <NameOrId> [paramsJson] [--full]");
  console.error(`available: ${Object.keys(fragmentRegistry).join(", ")}`);
  process.exit(1);
}
// Accept either the fragment id (registry key) or the PascalCase export name —
// derive the id from a PascalCase name the same way the contract does.
const toId = (s: string) =>
  s.startsWith("fragment-")
    ? s
    : `fragment-${s
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-")}`;
const id = toId(arg);
const fragment = fragmentRegistry[id];
if (!fragment) {
  console.error(`unknown fragment "${arg}" (id "${id}"). Available: ${Object.keys(fragmentRegistry).join(", ")}`);
  process.exit(1);
}

// previewParams cover fragments whose required params have no defaults
let params: Record<string, unknown> = fragment.previewParams ?? {};
if (paramsJson) {
  try {
    params = JSON.parse(paramsJson);
  } catch {
    console.error("paramsJson is not valid JSON");
    process.exit(1);
  }
}

// Wrap the ref in a minimal page, exactly as the agent would emit it.
const ns = "preview";
const page = {
  root: "page",
  elements: {
    page: {
      type: "Stack",
      props: { direction: "vertical", gap: "lg", className: "p-8" },
      children: [ns],
    },
    [ns]: { $fragment: id, params },
  },
};

const { spec, issues, expanded } = expandFragments(page, fragmentRegistry);
if (issues.length > 0) {
  console.error(`✗ expansion FAILED for ${id}:`);
  for (const issue of issues) console.error("  -", issue);
  process.exit(1);
}

const validationIssues = validatePageSpec({
  spec,
  validPageNames: ["Shop", "Cart", "Checkout", "Orders", "Dashboard"],
  entities: STANDARD_ENTITIES,
});

const elements = Object.keys(spec.elements as object).length;
const datasources = Object.keys((spec.datasources as object) ?? {}).length;
const initSteps = ((spec.init as unknown[]) ?? []).length;
const stateKeys = Object.keys((spec.state as object) ?? {});

console.log(`✓ expanded: ${expanded.join(", ")}`);
console.log(`  resolved params: ${JSON.stringify((fragment.params as { parse(v: unknown): unknown }).parse(params))}`);
console.log(`  elements: ${elements} | datasources: ${datasources} | init steps: ${initSteps} | state roots: [${stateKeys.join(", ")}]`);

if (validationIssues.length > 0) {
  console.error(`✗ validation FAILED (${validationIssues.length} issue(s)):`);
  for (const issue of validationIssues) console.error("  -", issue);
  process.exit(1);
}
console.log("✓ validation: clean");

if (full) {
  console.log("\n" + JSON.stringify(spec, null, 2));
} else {
  console.log(`\nelement tree:`);
  const els = spec.elements as Record<string, { type?: string; children?: string[] }>;
  const printTree = (key: string, depth: number) => {
    const el = els[key];
    console.log(`${"  ".repeat(depth)}${key} (${el?.type ?? "?"})`);
    for (const child of el?.children ?? []) printTree(child, depth + 1);
  };
  printTree("page", 0);
  console.log("\n(--full prints the complete expanded spec)");
}
