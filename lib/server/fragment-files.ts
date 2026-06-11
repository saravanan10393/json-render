import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * Mechanical registration of a fragment file into the registry source files —
 * shared by the CLI scaffolder (scripts/new-fragment.ts) and the studio
 * approve flow. Idempotent: re-registering an already-wired fragment is a
 * no-op.
 */

export const FRAGMENTS_ROOT = path.join(process.cwd(), "fragments");

export function categoryRegistryConst(category: string): string {
  const camel = category.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
  return `${camel}Fragments`;
}

/** Wire fragments/<category>/<Name>.ts into the category + root registries. */
export function registerFragmentFile(category: string, name: string): string[] {
  const actions: string[] = [];
  const categoryDir = path.join(FRAGMENTS_ROOT, category);
  const categoryIndex = path.join(categoryDir, "index.ts");
  const rootIndex = path.join(FRAGMENTS_ROOT, "index.ts");
  const registryConst = categoryRegistryConst(category);

  mkdirSync(categoryDir, { recursive: true });

  if (!existsSync(categoryIndex)) {
    writeFileSync(
      categoryIndex,
      `import type { FragmentRegistry } from "@/lib/jr/schema";
import { ${name} } from "./${name}";

export const ${registryConst} = {
  ${name},
} as unknown as FragmentRegistry;
`,
    );
    actions.push(`created ${path.relative(process.cwd(), categoryIndex)}`);
  } else {
    let source = readFileSync(categoryIndex, "utf8");
    if (!source.includes(`./${name}`)) {
      source = source.replace(
        /(import type \{ FragmentRegistry \}[^\n]*\n)/,
        `$1import { ${name} } from "./${name}";\n`,
      );
      source = source.replace(/(\n\} as unknown as FragmentRegistry;)/, `\n  ${name},$1`);
      writeFileSync(categoryIndex, source);
      actions.push(`registered ${name} in fragments/${category}/index.ts`);
    }
  }

  let rootSource = readFileSync(rootIndex, "utf8");
  if (!rootSource.includes(`./${category}`)) {
    rootSource = rootSource.replace(
      /(import type \{ FragmentRegistry \}[^\n]*\n)/,
      `$1import { ${registryConst} } from "./${category}";\n`,
    );
    rootSource = rootSource.replace(
      /(export const fragmentRegistry: FragmentRegistry = \{\n)/,
      `$1  ...${registryConst},\n`,
    );
    writeFileSync(rootIndex, rootSource);
    actions.push(`added ${category} bundle to fragments/index.ts`);
  }
  return actions;
}
