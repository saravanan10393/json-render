import { RequestContext } from "@mastra/core/request-context";
import type { UIMessage } from "ai";
import { deletePage, listPageIds, readAllPages, readAppIndex, readSourceAudit } from "@/lib/server/apps";
import {
  clearDesignArtifacts,
  clearMockups,
  type DesignMode,
  listMockupSlots,
  type Mockups,
  readMockups,
  readSitemap,
  selectedMockups,
  setMockupDuration, // image-gen path stamps directly (no agent tool boundary)
  writeMockup,
} from "@/lib/server/design-artifacts";
import { computeFragmentCoverage, coverageToPrompt } from "@/lib/server/fragment-coverage";
import { getAppTheme, getAppThemeOrDefault } from "@/lib/server/design-md";
import { installDesignTiming } from "@/lib/server/design-timing";
import { listEntities } from "@/lib/server/entity-store";
import { generateMockupImage } from "@/lib/server/image-gen";
import { agentForStage, type RunConfig, type Stage } from "@/lib/server/runs";
import {
  appBuilderAgent,
  makeAppBuilderAgent,
  makeBackendAgent,
  makeDesignAgent,
  makeFrontendAgent,
} from "@/mastra";

/** Render the APPROVED DESIGN MOCKUPS block for the frontend agent's prompt.
 *  Text/HTML modes are inlined verbatim; image mode just announces what's
 *  coming and the handoff in runStageTurn attaches the raster as a vision
 *  part on a separate user message. The per-page budgets reflect what each
 *  format carries — text is concise markdown (5KB ample), HTML is a styled
 *  document the agent needs to reproduce structurally (20KB). Within Sonnet
 *  4.5's 200K context for any realistic app size. */
const MOCKUP_PER_PAGE_BUDGET: Record<"text" | "html", number> = {
  text: 5000,
  html: 20000,
};
function formatMockups(sel: ReturnType<typeof selectedMockups>): string {
  if (!sel) return "";
  if (sel.mode === "image") {
    return `\nAPPROVED DESIGN MOCKUPS: one IMAGE per page provided as a vision input on the next user message (${sel.pages.length} pages: ${sel.pages.map((p) => p.pageId).join(", ")}) — read each image and build the matching page faithfully in real components.`;
  }
  const perPage = MOCKUP_PER_PAGE_BUDGET[sel.mode] ?? 5000;
  const body = sel.pages
    .map((p) => `\n### Page: ${p.pageId}\n${p.content.slice(0, perPage)}`)
    .join("\n");
  return `\nAPPROVED DESIGN MOCKUPS (${sel.mode}, one per page) — build each faithfully in real components:\n${body}`;
}

/** Snapshot of what exists so edit requests modify instead of recreate. */
export function buildAppContext(
  appId: string,
  appName: string,
  options: { fresh?: boolean } = {},
): string {
  const entities = listEntities(appId);
  const pages = readAllPages(appId);
  const index = readAppIndex(appId);
  const sitemap = readSitemap(appId);
  const sel = selectedMockups(appId);

  if (entities.length === 0 && pages.length === 0) {
    return `App "${appName}" (id: ${appId}) is EMPTY — nothing built yet. Follow the NEW APP workflow.`;
  }

  const entitySummary = entities
    .map(
      (e) =>
        `- ${e.name} (${e.label}): ${e.fields
          .map((f) => `${f.id}:${f.type}${f.options ? `[${f.options.join("|")}]` : ""}`)
          .join(", ")}`,
    )
    .join("\n");

  const pageSummary = pages
    .map((p) => `- id "${p.id}" name "${p.name}" role "${p.role}" entity "${p.businessEntity}"`)
    .join("\n");

  // Build source-audit section (pre-expansion specs with $fragment refs intact).
  // SKIPPED for a `fresh` rebuild — the goal there is to rebuild PAGES from the
  // approved design artifacts, so handing the agent its previous output would
  // bias it into refactoring instead of rebuilding. The PAGES summary above is
  // kept (it's just an id/name table, used by navigation tools).
  const SIZE_LIMIT = 24000;
  const PAGE_LIMIT = 8000;
  const auditParts: string[] = [];
  if (!options.fresh) {
    for (const page of pages) {
      const audit = readSourceAudit(appId, page.id);
      if (!audit) continue;
      const payload = JSON.stringify(audit.spec ?? audit);
      if (payload.length < PAGE_LIMIT) {
        auditParts.push(`\n--- page "${page.id}" (${page.name}) ---\n${payload}`);
      } else {
        auditParts.push(`\n--- page "${page.id}" (${page.name}) --- [source omitted, ${payload.length} chars — request it explicitly to edit]\n`);
      }
    }
  }

  const sourceSection =
    auditParts.length > 0
      ? (() => {
          const joined = auditParts.join("");
          if (joined.length > SIZE_LIMIT) {
            // Re-build: include full source only while under the limit, truncate the rest.
            const trimmed: string[] = [];
            let total = 0;
            for (const part of auditParts) {
              if (total + part.length <= SIZE_LIMIT) {
                trimmed.push(part);
                total += part.length;
              } else {
                // Replace the full-source entry with an omission note if it was inline.
                const match = part.match(/^(\n--- page "([^"]+)" \(([^)]+)\) ---\n)/);
                if (match) {
                  const omission = `\n--- page "${match[2]}" (${match[3]}) --- [source omitted — total context limit reached]\n`;
                  trimmed.push(omission);
                }
              }
            }
            return `\nSOURCE SPECS (pre-fragment-expansion — EDIT THESE, re-emit with the same $fragment refs):\n${trimmed.join("")}`;
          }
          return `\nSOURCE SPECS (pre-fragment-expansion — EDIT THESE, re-emit with the same $fragment refs):\n${joined}`;
        })()
      : "";

  // Fresh-rebuild framing: this run is NOT an edit — there are no pages and no
  // app.json to modify. Frame it as the agent's first arrival at the frontend
  // stage: data model + theme + sitemap + mockups are approved, build pages from
  // scratch. Edit-mode framing would bias the agent toward incremental tweaks.
  if (options.fresh) {
    return [
      `App "${appName}" (id: ${appId}) — FRESH BUILD. The data model + design are approved (below); existing pages have been wiped. Build EVERY page in the sitemap from scratch (one savePage per sitemap page), then call saveAppIndex once with the full navigation. Use the page ids from the sitemap.`,
      `\nENTITIES:\n${entitySummary || "(none)"}`,
      `\nDESIGN SYSTEM: ${
        getAppTheme(appId)
          ? (() => {
              const theme = getAppTheme(appId)!;
              return `${theme.name} (preset ${theme.preset}, fonts ${theme.fonts.heading}/${theme.fonts.body}) — applied; do NOT call applyDesignSystem.`;
            })()
          : "(missing — should not happen during rebuild)"
      }`,
      sitemap
        ? `\nAPPROVED SITEMAP (build pages to this IA — every page id, name, sections, and the navigation):\n${JSON.stringify(sitemap)}`
        : "\n(MISSING SITEMAP — cannot rebuild; ask the user to run the design stage first.)",
      sel ? formatMockups(sel) : "",
    ].join("\n");
  }

  return [
    `App "${appName}" (id: ${appId}) — CURRENT STATE (modify via tools; re-save only what changes):`,
    `\nENTITIES:\n${entitySummary || "(none)"}`,
    `\nPAGES:\n${pageSummary || "(none)"}`,
    `\nAPP INDEX (app.json):\n${index ? JSON.stringify(index) : "(not written yet — call saveAppIndex)"}`,
    `\nDESIGN SYSTEM: ${
      getAppTheme(appId)
        ? (() => {
            const theme = getAppTheme(appId)!;
            return `${theme.name} (preset ${theme.preset}, fonts ${theme.fonts.heading}/${theme.fonts.body}) — applied; re-run applyDesignSystem only if the user wants a different look.`;
          })()
        : "none yet — call applyDesignSystem first."
    }`,
    sitemap
      ? `\nAPPROVED SITEMAP (build pages to this IA — match these page names + navigation):\n${JSON.stringify(sitemap)}`
      : "",
    sel ? formatMockups(sel) : "",
    `\nFull page specs are on disk; savePage REPLACES a page entirely, so emit the complete spec when editing one. ui.navigate valid targets: [${pages.map((p) => p.name).join(", ")}].`,
    sourceSection,
  ].join("\n");
}

/** Compact context for the design stage — entities + theme + any prior design. */
export function buildDesignContext(appId: string, appName: string): string {
  const entities = listEntities(appId);
  const theme = getAppTheme(appId);
  const sitemap = readSitemap(appId);
  const mockups = readMockups(appId);
  const slots = listMockupSlots(appId);
  const entitySummary = entities.length
    ? entities
        .map(
          (e) =>
            `- ${e.name} (${e.label}): ${e.fields
              .map((f) => `${f.id}:${f.type}${f.options ? `[${f.options.join("|")}]` : ""}`)
              .join(", ")}`,
        )
        .join("\n")
    : "(none)";

  // Per-page slot summary (which (pageId, mode) already exist).
  const slotSummary =
    slots.length === 0
      ? ""
      : "\nEXISTING MOCKUP SLOTS (pageId · mode):\n" +
        Object.entries(
          slots.reduce<Record<string, DesignMode[]>>((acc, s) => {
            (acc[s.pageId] ??= []).push(s.mode);
            return acc;
          }, {}),
        )
          .map(([pageId, modes]) => `- ${pageId}: ${modes.join(", ")}`)
          .join("\n") +
        `\n(selected for build: ${mockups?.selected ?? "(none)"})`;

  return [
    `App "${appName}" (id: ${appId}) — DESIGN STAGE: produce the theme, sitemap (IA), and a per-page layout mockup for this data model. The Frontend agent builds pages after the user approves the design.`,
    `\nMOCKUP: call saveDesignArtifact ONCE PER PAGE in the sitemap (pageId from the sitemap), default representation 'text'. Produce 'html', 'svg', or 'image' only when the user asks. Representations coexist — saving one (pageId, mode) keeps the others.`,
    `\nENTITIES:\n${entitySummary}`,
    `\nTHEME: ${theme ? `${theme.name} (preset ${theme.preset})` : "none yet — call applyDesignSystem."}`,
    sitemap ? `\nEXISTING SITEMAP (revise via saveSitemap):\n${JSON.stringify(sitemap)}` : "",
    slotSummary,
  ].join("\n");
}

export interface RunBuilderTurnOptions {
  appId: string;
  appName: string;
  messages: UIMessage[];
  fragments?: boolean; // default true
  /**
   * Use the Mastra-registered (Langfuse-traced) agent when possible.
   * The benchmark passes false for BOTH modes so baseline and fragments runs
   * are symmetric — the registered agent carries tracing overhead the
   * factory-built one doesn't.
   * Only takes effect when fragments=true — there is no registered no-fragments agent, so traced is silently ignored otherwise.
   */
  traced?: boolean; // default true
  maxSteps?: number; // default 40
}

/**
 * The ONE code path that invokes the builder agent — used by the chat route
 * and the benchmark CLI so measurements match real usage.
 */
export async function runBuilderTurn({
  appId,
  appName,
  messages,
  fragments = true,
  traced = true,
  maxSteps = 40,
}: RunBuilderTurnOptions) {
  const agent = traced && fragments ? appBuilderAgent : makeAppBuilderAgent({ fragments });
  return agent.stream(
    // UIMessage and Mastra's stream input are runtime-compatible but not assignable.
    messages as unknown as Parameters<typeof agent.stream>[0],
    {
      maxSteps,
      requestContext: new RequestContext([["appId", appId]]),
      // Tags Langfuse traces per app (no-op for factory-built agents; kept for symmetry).
      tracingOptions: { metadata: { appId, appName } },
      context: [{ role: "system", content: buildAppContext(appId, appName) }],
    },
  );
}

/** Compact context for the backend stage — entities only (no theme, no pages).
 *  Theming is never the backend agent's job: with the designer on, the Design
 *  agent owns it; with the designer off, the app keeps the default theme. */
export function buildBackendContext(appId: string, appName: string): string {
  const entities = listEntities(appId);
  const entitySummary = entities.length
    ? entities
        .map(
          (e) =>
            `- ${e.name} (${e.label}): ${e.fields
              .map((f) => `${f.id}:${f.type}${f.options ? `[${f.options.join("|")}]` : ""}`)
              .join(", ")}`,
        )
        .join("\n")
    : "(none yet)";
  return [
    `App "${appName}" (id: ${appId}) — BACKEND STAGE: define the data model. The Frontend agent builds pages once the user approves the model.`,
    `\nENTITIES:\n${entitySummary}`,
  ].join("\n");
}

/**
 * SYSTEM action (not a chat turn): run the design agent server-side to produce
 * ONE mockup representation for ONE page. Scoped so it touches nothing else;
 * callers fan out per-page to generate in parallel. If `pageId` is omitted,
 * generates the mockup for every page in the sitemap in parallel.
 */
export async function generateMockupRepresentation(
  appId: string,
  appName: string,
  mode: DesignMode,
  pageId?: string,
  modelOverride?: string,
  imageGenOverride?: string,
): Promise<Mockups | null> {
  const sitemap = readSitemap(appId);
  if (!sitemap) return null;
  const targetIds = pageId ? [pageId] : sitemap.pages.map((p) => p.id);
  // Theme is referenced only by the image-mode prompt; saves a read for text/html.
  const theme = mode === "image" ? getAppThemeOrDefault(appId) : null;

  await Promise.all(
    targetIds.map(async (id) => {
      const page = sitemap.pages.find((p) => p.id === id);
      if (!page) return;

      // IMAGE mode: bypass the design agent — synthesize a single-shot prompt
      // from the sitemap section + theme and call the text→image model
      // directly. Save the returned PNG (data URL) as the mockup content;
      // the build handoff attaches it as a vision part without re-encoding.
      if (mode === "image" && theme) {
        const startMs = performance.now();
        const prompt = buildImageMockupPrompt(appName, page, theme);
        const { dataUrl } = await generateMockupImage(prompt, imageGenOverride);
        writeMockup(appId, page.id, "image", dataUrl);
        setMockupDuration(appId, page.id, "image", Math.round(performance.now() - startMs));
        return;
      }

      const agent = makeDesignAgent({ model: modelOverride });
      const sysContent = `${buildDesignContext(appId, appName)}\n\nSYSTEM TASK: produce ONLY the '${mode}' representation of the layout mockup for ONE page: "${page.name}" (pageId="${page.id}"). Mockup ONLY the page CONTENT AREA — the body of the screen inside the nav shell. Do NOT draw the navigation chrome (sidebar / topnav / nav links); the runtime renders that from app.json + shellLayout. Call saveDesignArtifact({ pageId: "${page.id}", mode: "${mode}", content }) exactly once, covering this page's sections + states with real copy. Do NOT touch other pages, applyDesignSystem, or saveSitemap. Reply with one short sentence when done.`;
      // installDesignTiming → saveDesignArtifact's execute stamps durationMs
      // on the slot at the moment it fires.
      const requestContext = new RequestContext([["appId", appId]]);
      installDesignTiming(requestContext);
      await agent.generate(
        [
          {
            role: "user",
            content: `Generate the ${mode} mockup for page "${page.name}".`,
          },
        ] as unknown as Parameters<typeof agent.generate>[0],
        {
          maxSteps: 6,
          requestContext,
          context: [{ role: "system", content: sysContent }],
        },
      );
    }),
  );

  return readMockups(appId);
}

/** Synthesize the text→image prompt for ONE page. Low-fidelity, layout-only —
 *  we want a layout reference the frontend agent can read at a glance, not a
 *  polished product shot. The image-gen model sees the page's purpose +
 *  sections + theme, and is told to omit the nav shell (the runtime renders
 *  it). The "no decorative imagery" line keeps Nano Banana 2 from inserting
 *  stock photos in card slots. */
function buildImageMockupPrompt(
  appName: string,
  page: import("@/lib/server/design-artifacts").Sitemap["pages"][number],
  theme: import("@/lib/server/design-md").AppTheme,
): string {
  const sections = page.sections.length > 0 ? page.sections.map((s) => `  - ${s}`).join("\n") : "  - (single hero section)";
  const states = page.states.length > 0 ? `\nStates to include hints for: ${page.states.join(", ")}.` : "";
  return [
    `Low-fidelity UI wireframe of the "${page.name}" CONTENT AREA of a desktop web app called "${appName}".`,
    "",
    `Page purpose: ${page.purpose}`,
    "",
    "Sections from top to bottom:",
    sections + states,
    "",
    "Visual style:",
    `- Theme: ${theme.name}`,
    `- Primary color: ${theme.light.primary}`,
    `- Background: ${theme.light.background}`,
    `- Heading font: ${theme.fonts.heading}; body font: ${theme.fonts.body}`,
    `- Corner radius: ${theme.radius}`,
    "",
    "Render the page CONTENT only — do NOT draw a sidebar / topnav / nav links (the app shell handles those). Aspect 1100x900, low fidelity: grey placeholder blocks for content, real labels, minimal real copy. Goal is LAYOUT INSPIRATION, not a finished product. No decorative imagery, no stock photos.",
  ].join("\n");
}

/** Which slice of the design phase a rerun regenerates. */
export type DesignScope = "all" | "theme" | "sitemap" | "mockups";

// The per-scope agent task (the "mockups" scope is handled by the per-page
// generator, not by these one-shot tasks).
const SCOPE_TASK: Record<Exclude<DesignScope, "mockups">, string> = {
  all: `redesign this app FROM SCRATCH. In order: (1) call applyDesignSystem to pick the theme afresh from the app's domain; (2) call saveSitemap with the full information architecture (every page + navigation); (3) call saveDesignArtifact ONCE PER PAGE with mode "text", covering that page's sections + states in real copy, using the sitemap page ids.`,
  theme: `regenerate the THEME only. Call applyDesignSystem once — pick the best preset for the app's domain, or author one from scratch if none fits. Do NOT call saveSitemap or saveDesignArtifact.`,
  sitemap: `regenerate the SITEMAP only. Call saveSitemap once with the full information architecture (every page + navigation). Do NOT call applyDesignSystem or saveDesignArtifact.`,
};

/** Run ONE scoped slice of the design agent (theme or sitemap) as a self-
 *  contained `agent.generate` call, then stamp the wall-clock duration onto
 *  the produced artifact via the relevant setter. Returns the elapsed ms. */
async function runDesignScope(
  appId: string,
  appName: string,
  scope: "theme" | "sitemap",
  modelOverride?: string,
): Promise<number> {
  const agent = makeDesignAgent({ model: modelOverride });
  const sysContent = `${buildDesignContext(appId, appName)}\n\nSYSTEM TASK: ${SCOPE_TASK[scope]} Do not ask questions. Reply with one short sentence when done.`;
  // installDesignTiming → the tool (applyDesignSystem or saveSitemap) stamps
  // the duration onto the produced artifact at its execute boundary. We keep
  // a wall-clock outer measurement for the caller (runDesignParallel uses it
  // as the per-stage time in its summary banner).
  const requestContext = new RequestContext([["appId", appId]]);
  installDesignTiming(requestContext);
  const startMs = performance.now();
  await agent.generate(
    [
      {
        role: "user",
        content: `Regenerate the ${scope} for "${appName}" now.`,
      },
    ] as unknown as Parameters<typeof agent.generate>[0],
    {
      maxSteps: 8,
      requestContext,
      context: [{ role: "system", content: sysContent }],
    },
  );
  return Math.round(performance.now() - startMs);
}

/** Wall-clock timings (ms) returned by `runDesignParallel` so the caller can
 *  surface a per-stage + total summary in the UI. */
export interface DesignTimings {
  theme: number;
  sitemap: number;
  mockups: number;
  total: number;
}

/**
 * SYSTEM action: redesign FROM SCRATCH with theme + sitemap running in
 * PARALLEL (two concurrent agent.generate calls — they have no data
 * dependency), then per-page mockups in parallel once the sitemap lands.
 * Saves ~28% vs the single-agent sequential "all" path; returns per-stage
 * timings so the caller can show a breakdown.
 *
 *   Wave 1 (parallel):   theme  ║  sitemap
 *                                   ↓
 *                            (sitemap ready)
 *                                   ↓
 *   Wave 2 (parallel):   mockup(p1) ║ mockup(p2) ║ ... ║ mockup(pN)
 */
export async function runDesignParallel(
  appId: string,
  appName: string,
  modelOverride?: string,
  imageGenOverride?: string,
): Promise<{ mockups: Mockups | null; timings: DesignTimings }> {
  clearDesignArtifacts(appId);
  const totalStart = performance.now();

  // Wave 1 — theme + sitemap, no data dependency, fire concurrently.
  const [theme, sitemap] = await Promise.all([
    runDesignScope(appId, appName, "theme", modelOverride),
    runDesignScope(appId, appName, "sitemap", modelOverride),
  ]);

  // Wave 2 — mockups (already parallel across pages inside the function).
  const mockupStart = performance.now();
  const selectedMode: DesignMode = readMockups(appId)?.selected ?? "text";
  await generateMockupRepresentation(appId, appName, selectedMode, undefined, modelOverride, imageGenOverride);
  const mockups = Math.round(performance.now() - mockupStart);

  const total = Math.round(performance.now() - totalStart);
  return {
    mockups: readMockups(appId),
    timings: { theme, sitemap, mockups, total },
  };
}

/**
 * SYSTEM action (not a chat turn): rerun a slice of the design phase from
 * scratch by running the design agent autonomously — no conversation.
 *  - "all"     → parallel theme + sitemap, then parallel per-page mockups (runDesignParallel)
 *  - "theme"   → re-pick the theme only (applyDesignSystem)
 *  - "sitemap" → re-derive the sitemap only (saveSitemap)
 *  - "mockups" → wipe mockups, regenerate the selected representation for every page
 * Returns the (possibly unchanged) mockups so the caller can refresh.
 */
export async function rerunDesign(
  appId: string,
  appName: string,
  scope: DesignScope = "all",
  modelOverride?: string,
  imageGenOverride?: string,
): Promise<Mockups | null> {
  if (scope === "mockups") {
    const selected = readMockups(appId)?.selected ?? "text";
    clearMockups(appId);
    return generateMockupRepresentation(appId, appName, selected, undefined, modelOverride, imageGenOverride);
  }

  if (scope === "all") {
    const { mockups } = await runDesignParallel(appId, appName, modelOverride, imageGenOverride);
    return mockups;
  }

  // scope === "theme" | "sitemap" — single scoped agent.generate.
  await runDesignScope(appId, appName, scope, modelOverride);
  return readMockups(appId);
}

/**
 * SYSTEM action (not a chat turn): rebuild every page of the app from the
 * approved design artifacts by running the frontend agent autonomously. Wipes
 * the existing page files first so the agent has NO previous source specs to
 * inherit (which is what makes a "rebuild" a true rebuild instead of a refactor
 * of the previous output). Returns the list of page ids that were written.
 *
 * Auto-snapshots the resulting build into `data/<appId>/builds/<model-slug>/`
 * once it finishes, so model A/B comparisons survive the next overwrite.
 */
export async function runRebuild(
  appId: string,
  appName: string,
  config: RunConfig,
): Promise<{ pageIds: string[] }> {
  // Wipe page files (NOT theme, sitemap, mockups, source audits) — the agent
  // must rebuild from the design artifacts, not from its previous output.
  for (const id of listPageIds(appId)) deletePage(appId, id);

  const agent = makeFrontendAgent({
    fragments: config.fragments,
    model: config.models?.frontend,
  });

  const content = `${buildAppContext(appId, appName, { fresh: true })}\n\nSYSTEM TASK: rebuild the app's pages and navigation from scratch to match the APPROVED SITEMAP and DESIGN MOCKUPS above. Call savePage ONCE per sitemap page (use the sitemap page ids) and saveAppIndex once with the full nav. Do not ask questions. Reply with one short sentence when done.`;

  await agent.generate(
    [
      {
        role: "user",
        content: `Rebuild "${appName}" now.`,
      },
    ] as unknown as Parameters<typeof agent.generate>[0],
    {
      maxSteps: 60,
      requestContext: new RequestContext([["appId", appId]]),
      context: [{ role: "system", content }],
    },
  );

  return { pageIds: listPageIds(appId) };
}

export interface RunStageTurnOptions {
  appId: string;
  appName: string;
  messages: UIMessage[];
  stage: Stage;
  config: RunConfig;
  maxSteps?: number;
}

/**
 * Orchestrated turn — routes the message to the active stage's agent with
 * stage-scoped context. backend → Backend agent (data model, + theme when the
 * designer is off); design → Design agent (theme + sitemap + mockup);
 * frontend/done → Frontend agent (pages + nav).
 */
export async function runStageTurn({
  appId,
  appName,
  messages,
  stage,
  config,
  maxSteps = 40,
}: RunStageTurnOptions) {
  const which = agentForStage(stage);
  let content =
    which === "backend"
      ? buildBackendContext(appId, appName)
      : which === "design"
        ? buildDesignContext(appId, appName)
        : buildAppContext(appId, appName);

  const agent =
    which === "backend"
      ? makeBackendAgent({ model: config.models?.backend })
      : which === "design"
        ? makeDesignAgent({ model: config.models?.design })
        : makeFrontendAgent({
            fragments: config.fragments,
            model: config.models?.frontend,
          });

  // Preponed fragment identification: hand the frontend agent the semantic
  // matches for the approved sitemap as a head start (cached; computed lazily).
  if (which === "frontend" && config.fragments) {
    const coverage = await computeFragmentCoverage(appId);
    if (coverage && coverage.sections.length > 0) {
      content += `\n\n${coverageToPrompt(coverage)}`;
    }
  }

  // Image-mockup handoff: when the approved mockup is image-mode, attach the
  // PNG per page as a vision part on a synthetic user message. Sonnet 4.5
  // (the frontend default) is vision-native — no model swap, no rasterising.
  let turnMessages = messages;
  if (which === "frontend") {
    const sel = selectedMockups(appId);
    if (sel?.mode === "image" && sel.pages.length > 0) {
      const parts: Array<Record<string, unknown>> = [
        {
          type: "text",
          text: `Approved design mockups — ${sel.pages.length} images follow (page id labels each). Build each page's content area to match the mockup faithfully in real components.`,
        },
      ];
      for (const p of sel.pages) {
        if (!p.content.startsWith("data:image/")) continue;
        const mt = /^data:(image\/[a-zA-Z0-9.+-]+)/.exec(p.content)?.[1] ?? "image/png";
        parts.push({ type: "text", text: `--- page: ${p.pageId} ---` });
        parts.push({ type: "file", mediaType: mt, url: p.content });
      }
      turnMessages = [
        ...messages,
        { id: "design-mockup-images", role: "user", parts } as unknown as UIMessage,
      ];
    }
  }

  // Design-stage chat turns: install the tool-timing ref so each design tool
  // (applyDesignSystem / saveSitemap / saveDesignArtifact) stamps durationMs
  // on its own artifact at the moment it fires. Backend/frontend stages skip
  // — their tools have no timing instrumentation.
  const requestContext = new RequestContext([["appId", appId]]);
  if (which === "design") installDesignTiming(requestContext);

  return agent.stream(turnMessages as unknown as Parameters<typeof agent.stream>[0], {
    maxSteps,
    requestContext,
    tracingOptions: { metadata: { appId, appName, stage } },
    context: [{ role: "system", content }],
  });
}
