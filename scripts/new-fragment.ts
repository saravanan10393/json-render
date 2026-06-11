/**
 * Scaffold a new fragment and register + index it in one step:
 *
 *   bun run fragment:new <category> <FragmentName>
 *   bun run fragment:new ecommerce WishlistButton
 *
 * Creates fragments/<category>/<Name>.ts from a template, wires it into the
 * category index (creating the category + registry entry when new), then
 * syncs the vector index so the agent can retrieve it immediately.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { FRAGMENTS_ROOT, registerFragmentFile } from "../lib/server/fragment-files";

const [category, name] = process.argv.slice(2);
if (!category || !name || !/^[A-Z][A-Za-z0-9]*$/.test(name)) {
  console.error("usage: bun run fragment:new <category> <PascalCaseName>");
  process.exit(1);
}

const categoryDir = path.join(FRAGMENTS_ROOT, category);
const fragmentFile = path.join(categoryDir, `${name}.ts`);

if (existsSync(fragmentFile)) {
  console.error(`${fragmentFile} already exists`);
  process.exit(1);
}

const TEMPLATE = `/**
 * ${name} — TODO: one-line purpose.
 *
 * Authoring rules: every element id / datasource name must be ns-prefixed
 * (\`\${ns}\` or \`\${ns}-…\`); root must equal ns; build() is pure. In repeat-scope
 * ACTION params, {$item} resolves to a PATH — copy values with $template
 * bare names instead (see ProductGrid's itemSnapshot).
 */
import { z } from "zod";
import type { Fragment } from "@/lib/jr/schema";

const Params = z.object({
  title: z.string().default("${name}"),
});

type P = z.infer<typeof Params>;

export const ${name}: Fragment<P> = {
  name: "${name}",
  version: "1.0.0",
  description: "TODO: what this block renders and which entity fields it requires.",
  whenToUse: "TODO: retrieval hint — 'Use when the user wants …'.",
  category: "display",
  // REQUIRED when params have required fields without defaults — previews,
  // the test harness, and the promote gate evaluate with these.
  // previewParams: { ... },
  params: Params as z.ZodType<P>,
  build: ({ title }, ns) => ({
    root: ns,
    elements: {
      [ns]: {
        type: "Card",
        props: { title, description: null, maxWidth: null, centered: null, className: null },
        children: [],
      },
    },
  }),
};
`;

mkdirSync(categoryDir, { recursive: true });
writeFileSync(fragmentFile, TEMPLATE);
console.log(`created ${path.relative(process.cwd(), fragmentFile)}`);
for (const action of registerFragmentFile(category, name)) console.log(action);

// re-index so the agent can retrieve the new fragment immediately
const { syncFragmentIndex } = await import("../lib/server/fragment-index");
const { fragmentRegistry } = await import("../fragments");
const result = await syncFragmentIndex(fragmentRegistry);
console.log(
  `vector index synced — added: [${result.added.join(", ")}], updated: [${result.updated.join(", ")}], removed: [${result.removed.join(", ")}], unchanged: ${result.skipped}`,
);
console.log(`\nNext: edit ${path.relative(process.cwd(), fragmentFile)} (description, whenToUse, params, build), then re-run: bun run fragment:index`);
