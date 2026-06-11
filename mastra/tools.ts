import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { fragmentRegistry } from "@/fragments";
import {
  AppIndexSchema,
  SHELL_LAYOUTS,
  SHELL_VARIANTS,
} from "@/lib/jr/schema";
import { expandFragments } from "@/lib/server/fragment-expander";
import { searchFragments as searchFragmentIndex } from "@/lib/server/fragment-index";
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
import { validatePageSpec } from "@/lib/server/spec-validators";

const slug = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, "");

function appIdFrom(context: { requestContext?: { get: (k: string) => unknown } } | undefined): string {
  const appId = context?.requestContext?.get("appId");
  if (!appId) throw new Error("appId missing from request context");
  return String(appId);
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
        name: z.string(),
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
        name: m.name,
        category: m.category,
        doc: m.doc,
        score: m.score,
        belowThreshold: m.belowThreshold ?? null,
      })),
    };
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

    // Eject-on-write: materialise $fragment refs to primitives first, then
    // validate the expanded page (so validators see what will actually run).
    const expansion = expandFragments(
      input.spec as Record<string, unknown>,
      fragmentRegistry,
    );
    if (expansion.issues.length > 0) {
      return { ok: false, issues: expansion.issues, pageId: null };
    }

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
