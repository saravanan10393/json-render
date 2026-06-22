import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { fragmentRegistry } from "@/fragments";
import {
  AppIndexSchema,
  SHELL_LAYOUTS,
  SHELL_VARIANTS,
} from "@/lib/jr/schema";
import {
  authorThemeFromScratch,
  pickThemePreset,
  setThemeDuration,
} from "@/lib/server/design-md";
import {
  readSitemap,
  setMockupDuration,
  setSitemapDuration,
  writeMockup,
  writeSitemap,
} from "@/lib/server/design-artifacts";
import { stampNextDuration } from "@/lib/server/design-timing";
import { expandFragments } from "@/lib/server/fragment-expander";
import { searchFragments as searchFragmentIndex } from "@/lib/server/fragment-index";
import { getRun } from "@/lib/server/runs";
import {
  deletePage as deletePageFile,
  listPageIds,
  readAllPages,
  touchApp,
  writeAppIndex,
  writePage,
  writeSourceAudit,
} from "@/lib/server/apps";
import {
  countRecords,
  listEntities,
  saveEntity,
  saveRecord,
} from "@/lib/server/entity-store";
import { normalizePageSpec, validatePageSpec } from "@/lib/server/spec-validators";

const slug = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, "");

type ToolContext = { requestContext?: import("@mastra/core/request-context").RequestContext } | undefined;

function appIdFrom(context: { requestContext?: { get: (k: string) => unknown } } | undefined): string {
  const appId = context?.requestContext?.get("appId");
  if (!appId) throw new Error("appId missing from request context");
  return String(appId);
}

/** Stamp `durationMs` onto the artifact via `set`, if the design-timing ref
 *  is installed in the tool's RequestContext (chat-driven design turns + the
 *  scoped reruns both install it). No-op for backend/frontend stage tools. */
function stampDesignTiming(context: ToolContext, set: (ms: number) => void): void {
  if (!context?.requestContext) return;
  stampNextDuration(context.requestContext, set);
}

// ── Data model ────────────────────────────────────────────────────────────

export const defineEntity = createTool({
  id: "defineEntity",
  description:
    "Create or replace an entity (data table) the app's datasources read/write. Define entities BEFORE pages that reference them.",
  inputSchema: z.object({
    name: z
      .string()
      .min(1)
      .describe("PascalCase entity name, e.g. 'Task' or 'Order'. Used as the `bdo` value in datasources."),
    label: z.string().min(1).describe("Human-readable plural label, e.g. 'Tasks'."),
    fields: z
      .array(
        z.object({
          id: z.string().describe("PascalCase field id, e.g. 'Title', 'Status', 'DueDate'."),
          name: z.string().describe("Human label, e.g. 'Due date'."),
          type: z.enum(["text", "number", "boolean", "date", "select"]),
          options: z
            .array(z.string())
            .nullable()
            .describe("Allowed values — required when type is 'select'."),
        }),
      )
      .min(1),
  }),
  outputSchema: z.object({
    ok: z.boolean(),
    entity: z.string(),
    entities: z.array(z.string()).describe("All entity names defined so far."),
  }),
  execute: async (input, context) => {
    const appId = appIdFrom(context);
    saveEntity(appId, {
      name: input.name,
      label: input.label,
      fields: input.fields.map((f) => ({ ...f, options: f.options ?? undefined })),
    });
    touchApp(appId);
    return {
      ok: true,
      entity: input.name,
      entities: listEntities(appId).map((e) => e.name),
    };
  },
});

export const seedRecords = createTool({
  id: "seedRecords",
  description:
    "Insert realistic sample records into an entity so the app has data to show. Use real-sounding values, never lorem ipsum.",
  inputSchema: z.object({
    entity: z.string().describe("Entity name (must be defined first)."),
    records: z
      .array(z.record(z.string(), z.unknown()))
      .min(1)
      .max(50)
      .describe("Records keyed by field id, e.g. [{Title: 'Fix login', Status: 'Open'}]."),
  }),
  outputSchema: z.object({
    ok: z.boolean(),
    inserted: z.number(),
    totalRecords: z.number(),
  }),
  execute: async (input, context) => {
    const appId = appIdFrom(context);
    const entities = listEntities(appId);
    if (!entities.some((e) => e.name === input.entity)) {
      throw new Error(
        `Entity "${input.entity}" is not defined. Defined: [${entities.map((e) => e.name).join(", ")}]. Call defineEntity first.`,
      );
    }
    for (const record of input.records) {
      saveRecord(appId, input.entity, record);
    }
    return {
      ok: true,
      inserted: input.records.length,
      totalRecords: countRecords(appId, input.entity),
    };
  },
});

// ── Design system ─────────────────────────────────────────────────────────

export const applyDesignSystem = createTool({
  id: "applyDesignSystem",
  description:
    "Theme the app — TWO modes, pick ONE: (A) PICK a ready-made preset, or (B) CREATE a theme from scratch. The preview re-themes immediately (colors, fonts, radius, light+dark). Call ONCE per new app, after understanding the domain. Do NOT hand-edit a picked preset's colors — the human refines any theme later in the tweaker.",
  inputSchema: z.object({
    preset: z
      .string()
      .nullable()
      .describe(
        "MODE A (pick): a theme-preset id from the THEME PRESETS list — applies that preset's complete look (colors + fonts + radius, light+dark) as-is. Omit for MODE B.",
      ),
    colors: z
      .record(z.string(), z.string())
      .nullable()
      .describe(
        'MODE B (create from scratch): a FULL shadcn token set you author yourself, e.g. {"background":"...","primary":"...","ring":"...", "dark-background":"...", ...} — prefix "dark-" for the dark palette. Define every required token (see the DESIGN.md SCHEMA in your instructions). Use ONLY when no preset fits; do not combine with `preset`.',
      ),
    headingFont: z
      .string()
      .nullable()
      .describe("MODE B: Google Font family for headings (from the allowed list)."),
    bodyFont: z.string().nullable().describe("MODE B: Google Font family for body text (from the allowed list)."),
    radius: z
      .string()
      .nullable()
      .describe('MODE B: base corner radius, e.g. "0.5rem" (tighter) or "0.875rem" (rounder).'),
  }),
  outputSchema: z.object({
    ok: z.boolean(),
    issues: z.array(z.string()),
    applied: z.string().nullable(),
  }),
  execute: async (input, context) => {
    const appId = appIdFrom(context);

    // MODE A: pick a preset from the unified library (used as-is, no DESIGN.md).
    // MODE B: author a palette from scratch → writes DESIGN.md, then theme.json.
    const result = input.colors
      ? await authorThemeFromScratch({
          appId,
          colors: input.colors,
          headingFont: input.headingFont ?? undefined,
          bodyFont: input.bodyFont ?? undefined,
          radius: input.radius ?? undefined,
        })
      : pickThemePreset(appId, input.preset ?? "default");

    if (result.ok) stampDesignTiming(context, (ms) => setThemeDuration(appId, ms));
    touchApp(appId);
    return {
      ok: result.ok,
      issues: result.issues,
      applied: result.theme ? `${result.theme.name} (${result.theme.preset})` : null,
    };
  },
});

// ── Fragment retrieval ────────────────────────────────────────────────────

export const searchFragments = createTool({
  id: "searchFragments",
  description:
    "Semantic search over the prebuilt fragment library. Returns every fragment relevant to the need (no fixed limit) with its full params schema and usage notes. ALWAYS call this before designing pages.",
  inputSchema: z.object({
    query: z
      .string()
      .min(3)
      .describe(
        "What you're building, e.g. 'browse products with filters and add to cart' or 'list of past orders'.",
      ),
  }),
  outputSchema: z.object({
    matches: z.array(
      z.object({
        id: z.string().describe("Emit this as the element's $fragment value."),
        name: z.string().describe("Human label (display only)."),
        category: z.string(),
        doc: z.string(),
        score: z.number(),
        belowThreshold: z.boolean().nullable(),
      }),
    ),
  }),
  execute: async (input) => {
    const matches = await searchFragmentIndex(fragmentRegistry, input.query);
    return {
      matches: matches.map((m) => ({
        id: m.id,
        name: m.name,
        category: m.category,
        doc: m.doc,
        score: m.score,
        belowThreshold: m.belowThreshold ?? null,
      })),
    };
  },
});

// ── Design artifacts (sitemap + layout mockup) ─────────────────────────────

export const saveSitemap = createTool({
  id: "saveSitemap",
  description:
    "Save the app's information architecture: pages, the navigation rail, home, shell layout, and key user flows. The Frontend agent builds pages to this map, so every page the app needs must appear here.",
  inputSchema: z.object({
    pages: z
      .array(
        z.object({
          id: z.string().describe("kebab-case page id, e.g. 'dashboard' or 'task-list'."),
          name: z.string().describe("Screen name, e.g. 'Dashboard'."),
          role: z.string().nullable().describe("User role; null/omit → 'user'."),
          purpose: z.string().describe("One line: what this page is for."),
          primaryEntity: z.string().nullable().describe("Main entity this page works with, or null."),
          sections: z.array(z.string()).describe("Ordered section intents, top to bottom."),
          states: z.array(z.string()).describe("Empty/loading/error states to cover (may be [])."),
        }),
      )
      .min(1),
    navigation: z
      .array(
        z.object({
          label: z.string(),
          icon: z.string().nullable().describe("lucide icon name, or null."),
          page: z.string().describe("Target page id (must exist in pages)."),
        }),
      )
      .describe("Top-level nav only — exclude detail/form pages reached via row clicks."),
    home: z.string().describe("Landing page id (must exist in pages)."),
    shellLayout: z
      .string()
      .nullable()
      .describe("sidebar | topnav | icon-rail | compact-rail | minimal | split-rail, or null."),
    flows: z.array(z.string()).describe("Key user flows as short step sequences (may be [])."),
  }),
  outputSchema: z.object({ ok: z.boolean(), pages: z.number() }),
  execute: async (input, context) => {
    const appId = appIdFrom(context);
    writeSitemap(appId, {
      pages: input.pages.map((p) => ({ ...p, role: p.role ?? "user" })),
      navigation: input.navigation,
      home: input.home,
      shellLayout: input.shellLayout,
      flows: input.flows,
    });
    stampDesignTiming(context, (ms) => setSitemapDuration(appId, ms));
    touchApp(appId);
    return { ok: true, pages: input.pages.length };
  },
});

export const saveDesignArtifact = createTool({
  id: "saveDesignArtifact",
  description:
    "Save (or replace) ONE representation of ONE page's layout mockup. Mockup the page CONTENT only — do NOT draw the nav shell (sidebar/topnav); that's rendered separately from app.json at runtime. Mockups are PER PAGE — call once per (page, representation). Representations coexist (saving one keeps the others). Default to 'text' (markdown layout: sections top-to-bottom, what each shows, real copy); produce 'html' (static HTML/CSS, max-width 1100px) when the user asks. `pageId` MUST match a sitemap page id.",
  inputSchema: z.object({
    pageId: z.string().min(1).describe("Sitemap page id this mockup describes (must already exist in saveSitemap pages)."),
    mode: z.enum(["text", "html"]).describe("Which representation to write: 'text' (markdown layout) or 'html' (full HTML page, content area only, max-width 1100px)."),
    content: z
      .string()
      .min(1)
      .describe("The mockup for that single page in that representation: sections/hierarchy/intent and real copy."),
  }),
  outputSchema: z.object({
    ok: z.boolean(),
    issues: z.array(z.string()),
    pageId: z.string().nullable(),
    mode: z.string(),
  }),
  execute: async (input, context) => {
    const appId = appIdFrom(context);
    const sitemap = readSitemap(appId);
    if (!sitemap) {
      return {
        ok: false,
        issues: ["no sitemap yet — call saveSitemap first so pageId resolves"],
        pageId: null,
        mode: input.mode,
      };
    }
    const validIds = sitemap.pages.map((p) => p.id);
    if (!validIds.includes(input.pageId)) {
      return {
        ok: false,
        issues: [
          `pageId "${input.pageId}" is not in the sitemap. Valid ids: [${validIds.join(", ")}]`,
        ],
        pageId: null,
        mode: input.mode,
      };
    }
    writeMockup(appId, input.pageId, input.mode, input.content);
    stampDesignTiming(context, (ms) => setMockupDuration(appId, input.pageId, input.mode, ms));
    touchApp(appId);
    return { ok: true, issues: [], pageId: input.pageId, mode: input.mode };
  },
});

// ── Pages ─────────────────────────────────────────────────────────────────

export const savePage = createTool({
  id: "savePage",
  description:
    "Create or fully replace one page of the app. The spec is validated against the page schema AND data-flow rules; when `issues` are returned, fix the spec and save again.",
  inputSchema: z.object({
    role: z
      .string()
      .min(1)
      .describe("User role this page belongs to. Use 'user' for single-role apps."),
    businessEntity: z
      .string()
      .min(1)
      .describe("Primary entity this page works with (or 'general')."),
    name: z
      .string()
      .min(1)
      .describe("Screen name, e.g. 'Dashboard' or 'Task List' — drives the URL and ui.navigate targets."),
    spec: z
      .record(z.string(), z.unknown())
      .describe(
        "Page spec: { root, elements, state?, datasources?, init?, watch? }.",
      ),
  }),
  outputSchema: z.object({
    ok: z.boolean(),
    issues: z.array(z.string()),
    pageId: z.string().nullable(),
  }),
  execute: async (input, context) => {
    const appId = appIdFrom(context);
    const pageId = `${slug(input.role)}-${slug(input.businessEntity)}-${slug(input.name)}`;
    const existing = readAllPages(appId).filter((p) => p.id !== pageId);

    // Fragments-off guard: when the run disables fragments, reject $fragment
    // refs so the toggle is ENFORCED, not merely suggested by the prompt.
    const elements = ((input.spec as Record<string, unknown>).elements ?? {}) as Record<
      string,
      Record<string, unknown>
    >;
    const fragRefs = Object.keys(elements).filter(
      (k) => elements[k] && typeof elements[k] === "object" && "$fragment" in elements[k],
    );
    if (fragRefs.length > 0 && getRun(appId)?.config.fragments === false) {
      return {
        ok: false,
        issues: [
          `Fragments are disabled for this build — compose from base components instead. Remove the $fragment ref on element(s) [${fragRefs.join(", ")}] and build that UI from primitive components.`,
        ],
        pageId: null,
      };
    }

    // Eject-on-write: materialise $fragment refs to primitives first, then
    // validate the expanded page (so validators see what will actually run).
    const expansion = expandFragments(
      input.spec as Record<string, unknown>,
      fragmentRegistry,
    );
    if (expansion.issues.length > 0) {
      return { ok: false, issues: expansion.issues, pageId: null };
    }

    // Repair recurring shape mistakes (e.g. element-level `clickable`) so the
    // persisted spec is correct and validators see what will actually run.
    normalizePageSpec(expansion.spec);

    const issues = validatePageSpec({
      spec: expansion.spec,
      validPageNames: [...existing.map((p) => p.name), input.name],
      entities: listEntities(appId),
    });
    if (issues.length > 0) {
      return { ok: false, issues, pageId: null };
    }

    writePage(appId, {
      id: pageId,
      role: input.role,
      businessEntity: input.businessEntity,
      name: input.name,
      spec: expansion.spec as never,
    });
    // Audit trail: the raw agent-emitted spec ($fragment refs un-expanded),
    // persisted only now that every validation gate has passed.
    writeSourceAudit(appId, pageId, {
      id: pageId,
      role: input.role,
      businessEntity: input.businessEntity,
      name: input.name,
      savedAt: new Date().toISOString(),
      expandedFragments: expansion.expanded,
      spec: input.spec,
    });
    return { ok: true, issues: [], pageId };
  },
});

export const deletePage = createTool({
  id: "deletePage",
  description:
    "Delete a page file by id. Remember to re-save the app index (saveAppIndex) so navigation stays consistent.",
  inputSchema: z.object({ id: z.string().min(1) }),
  outputSchema: z.object({ ok: z.boolean(), id: z.string() }),
  execute: async (input, context) => {
    const appId = appIdFrom(context);
    deletePageFile(appId, input.id);
    return { ok: true, id: input.id };
  },
});

export const saveAppIndex = createTool({
  id: "saveAppIndex",
  description:
    "Write app.json — the app index with per-role navigation, home page, and shell layout. Call AFTER saving pages (page ids must exist).",
  inputSchema: z.object({
    roles: z.record(
      z.string(),
      z.object({
        home: z.string().describe("Landing pageId for this role."),
        navigation: z
          .array(
            z.object({
              label: z.string(),
              icon: z.string().nullable().describe("lucide icon name, e.g. 'layout-dashboard'."),
              page: z.string().describe("Target pageId."),
            }),
          )
          .describe("Top-level nav only — exclude detail/form pages reached via row clicks."),
        pages: z.array(z.string()).describe("EVERY pageId belonging to this role."),
        shellLayout: z.enum(SHELL_LAYOUTS).nullable(),
        shellVariant: z.enum(SHELL_VARIANTS).nullable(),
      }),
    ),
  }),
  outputSchema: z.object({ ok: z.boolean(), issues: z.array(z.string()) }),
  execute: async (input, context) => {
    const appId = appIdFrom(context);
    const onDisk = new Set(listPageIds(appId));
    const issues: string[] = [];

    for (const [role, entry] of Object.entries(input.roles)) {
      for (const pageId of entry.pages) {
        if (!onDisk.has(pageId)) {
          issues.push(
            `roles.${role}.pages: "${pageId}" has no page file. Saved pages: [${[...onDisk].join(", ")}]`,
          );
        }
      }
      if (!entry.pages.includes(entry.home)) {
        issues.push(`roles.${role}.home "${entry.home}" must be listed in roles.${role}.pages.`);
      }
      for (const nav of entry.navigation) {
        if (!entry.pages.includes(nav.page)) {
          issues.push(`roles.${role}.navigation: "${nav.page}" is not in roles.${role}.pages.`);
        }
      }
    }
    if (issues.length > 0) return { ok: false, issues };

    const index = AppIndexSchema.parse({
      version: "2.0",
      app: appId,
      roles: Object.fromEntries(
        Object.entries(input.roles).map(([role, entry]) => [
          role,
          {
            home: entry.home,
            navigation: entry.navigation.map((n) => ({
              label: n.label,
              icon: n.icon ?? undefined,
              page: n.page,
            })),
            pages: entry.pages,
            shellLayout: entry.shellLayout ?? undefined,
            shellVariant: entry.shellVariant ?? undefined,
          },
        ]),
      ),
    });
    writeAppIndex(appId, index);
    return { ok: true, issues: [] };
  },
});
