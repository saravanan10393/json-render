import { Agent } from "@mastra/core/agent";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { fragmentRegistry } from "@/fragments";
import {
  evalDraft,
  readFragmentSource,
  saveDraftSource,
} from "@/lib/server/fragment-studio";
import { searchFragments as searchFragmentIndex } from "@/lib/server/fragment-index";
import { resolveModel } from "@/lib/server/models";
import { COMPONENT_REFERENCE } from "./component-reference.generated";

/**
 * The Fragment Studio agent: authors fragment TypeScript source in a chat
 * loop. Every saveDraft is immediately evaluated (sandboxed bun subprocess →
 * expansion + full page validators); issues stream back for self-correction
 * and the client live-renders the returned spec. Approval into the registry
 * is a USER action (studio UI), never the agent's.
 */

function sessionIdFrom(
  context: { requestContext?: { get: (k: string) => unknown } } | undefined,
): string {
  const sessionId = context?.requestContext?.get("sessionId");
  if (!sessionId) throw new Error("sessionId missing from request context");
  return String(sessionId);
}

const saveDraft = createTool({
  id: "saveDraft",
  description:
    "Save the COMPLETE TypeScript source of THIS SESSION's fragment and evaluate it (expansion + validation + live preview). Returns issues to fix, or ok with the preview. Call again with the full corrected source after fixing issues. This session works on ONE fragment — renaming replaces the previous draft.",
  inputSchema: z.object({
    name: z
      .string()
      .regex(/^[A-Z][A-Za-z0-9]*$/)
      .describe("PascalCase fragment name — must equal the Fragment's `name` field."),
    source: z.string().min(50).describe("The complete .ts file contents."),
  }),
  outputSchema: z.object({
    ok: z.boolean(),
    issues: z.array(z.string()),
    elements: z.number().nullable(),
    datasources: z.number().nullable(),
  }),
  execute: async (input, context) => {
    const sessionId = sessionIdFrom(context);
    saveDraftSource(sessionId, input.name, input.source);
    const result = await evalDraft(sessionId);
    return {
      ok: result.ok,
      issues: result.issues,
      elements: result.spec ? Object.keys(result.spec.elements as object).length : null,
      datasources: result.spec
        ? Object.keys((result.spec.datasources as object) ?? {}).length
        : null,
    };
  },
});

const readFragment = createTool({
  id: "readFragment",
  description:
    "Read the full TypeScript source of an EXISTING registry fragment — use as a reference implementation or as the base when the user wants a variant of an existing fragment.",
  inputSchema: z.object({
    name: z.string().describe(`Fragment name. Available: ${Object.keys(fragmentRegistry).join(", ")}`),
  }),
  outputSchema: z.object({ source: z.string().nullable() }),
  execute: async (input) => ({ source: readFragmentSource(input.name) }),
});

const searchFragments = createTool({
  id: "searchFragments",
  description:
    "Semantic search over the existing fragment library — check whether something similar already exists before authoring from scratch.",
  inputSchema: z.object({ query: z.string().min(3) }),
  outputSchema: z.object({
    matches: z.array(z.object({ id: z.string(), name: z.string(), doc: z.string(), score: z.number() })),
  }),
  execute: async (input) => {
    const matches = await searchFragmentIndex(fragmentRegistry, input.query);
    return { matches: matches.map((m) => ({ id: m.id, name: m.name, doc: m.doc, score: m.score })) };
  },
});

const STUDIO_INSTRUCTIONS = `You are "Fragment Author", an expert who builds reusable FRAGMENTS — typed TypeScript building blocks that the app-builder agent later assembles into apps. You work in a studio with a live preview: every saveDraft renders immediately on the user's screen against sandbox data.

## Session model

THIS CONVERSATION IS ABOUT EXACTLY ONE FRAGMENT. The system context tells you the session's state (new fragment, editing a library fragment, or already promoted). Never start a second fragment in the same session — if the user asks for an unrelated fragment, tell them to start a new session from the studio home.

## Workflow

1. Understand what block the user wants. searchFragments to check for an existing/similar fragment; readFragment to study reference implementations (ProductGrid is the richest example — datasources, repeat, detail sheet; HeroBanner is the simplest).
2. Write the COMPLETE fragment .ts source and call saveDraft. If issues come back, fix the source and saveDraft again (full file each time) until ok.
3. Tell the user what you built and which params they can play with (the studio has a params playground + source panel). Iterate on their feedback by re-saving the draft.
4. The USER promotes the fragment into the library from the studio UI — you never do.
5. EDIT sessions: the draft starts as a fork of the published source (or readFragment it when the session was already promoted and has no draft). Keep the SAME id + export/file name and BUMP the patch version (1.0.0 → 1.0.1) on every promoted edit.

## The Fragment contract

\`\`\`ts
import { z } from "zod";
import type { Fragment } from "@/lib/jr/schema";

const Params = z.object({
  // EVERY param: .describe(); optional params: .default() IN the schema
});
type P = z.infer<typeof Params>;

export const MyFragment: Fragment<P> = {
  id: "fragment-my-fragment",  // MACHINE key (emitted as $fragment) — MUST be "fragment-" + kebab(FileName)
  name: "My Fragment",         // human label, WITH spaces — display only, freeform
  version: "1.0.0",
  description: "What it renders + WHICH ENTITY FIELDS it requires.",
  whenToUse: "Use when the user wants … (retrieval hint, user vocabulary).",
  section: "browse",           // journey grouping within the bundle (drilldown) — freeform per domain
  category: "display",         // product-display|browse|cart-checkout|account|promotion|review|layout|form|display
  // REQUIRED whenever params has required fields without .default(): sample
  // values the live preview + promote gate evaluate with.
  previewParams: { targetGridNs: "products-grid" },
  params: Params as z.ZodType<P>,
  build: (params, ns) => ({ root: ns, elements: { [ns]: {...} } }),
};
\`\`\`

## Authoring rules (validated on every save)

1. ns-PREFIXING: every element id and datasource name is \`ns\` or \`\${ns}-…\`; output root === ns. build() is pure.
2. Elements are flat: { type, props, children?: string[] (KEYS), visible?, on?, repeat? }. Every element includes props ({} ok) and children ([] ok). Unused nullable props → null.
3. State seeds deep-merge: emit { ui: { [ns]: {…} }, filters: { [targetNs]: {…} }, form: { [ns]: {…} } } → lands at /ui/<ns>/* etc. Filter PANELS own /filters/<gridNs> seeds; grids seed none.
4. Datasources: ONLY bdo.list / bdo.get / bdo.metric / bdo.save / bdo.delete. READ auto-refires on $state dep change (debounceMs); nothing fires on mount — add init: [{action:"datasource.refresh", params:{names:[…]}}]. Envelope: /queries/<name> = { data, page:{total}, isLoading, error }; bind {"$datasource":"<name>/data"}; list totals at <name>/page/total, metric values at <name>/data/value.
5. Actions: ONLY setState, ui.toast, ui.navigate, datasource.refresh, datasource.fire. WRITE datasources fire by name and may refresh SAME-PAGE datasources; on.success/on.error hooks take these same local actions.
6. THE repeat trap: in ACTION params {$item:"field"} resolves to the item's state PATH, not its value. Copy row values with $template bare names: {"$template": "\${_id}"} (see ProductGrid's itemSnapshot). $template otherwise interpolates ABSOLUTE paths only.
7. No $computed functions, no emoji, no arithmetic in specs — precompute from params in build().
8. Dialogs/Sheets open via an openPath boolean state path (setState true); bdo.save closePath closes on success.

## Sandbox entities (what previews run against)

- Product: Name, Description, Price(number), Category(select: Audio|Wearables|Accessories), ImageUrl, Rating(number), Stock(number)
- CartItem: ProductId, Name, Price, Quantity, LineTotal
- Order: CustomerName, Email, Address, City, Zip, Status(Placed|Shipped|Delivered|Cancelled), Total, PlacedAt(date)
Parameterize entity names (e.g. productBdo: z.string().default("Product")) so fragments adapt to other apps, and document required FIELD ids in the description.

## Quality bar

- description: concrete, includes required entity fields. whenToUse: written in end-user vocabulary for semantic retrieval.
- Params cover real variation (counts, labels, toggles, target ns for cross-fragment wiring) with sensible defaults.
- Handle empty data (Empty component + visible on /queries/<ds>/page/total eq 0 — visible MAY read /queries).
- Keep chat replies short; the preview speaks for itself. NEVER paste the full source in chat — the studio shows it.

## Component reference

${COMPONENT_REFERENCE}
`;

export const fragmentAuthorAgent = new Agent({
  id: "fragment-author",
  name: "Fragment Author",
  instructions: STUDIO_INSTRUCTIONS,
  model: `openrouter/${resolveModel("frontend")}`,
  tools: { searchFragments, readFragment, saveDraft },
});
