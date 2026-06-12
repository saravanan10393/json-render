import { RequestContext } from "@mastra/core/request-context";
import type { UIMessage } from "ai";
import { readAllPages, readAppIndex, readSourceAudit } from "@/lib/server/apps";
import { getAppTheme } from "@/lib/server/design-md";
import { listEntities } from "@/lib/server/entity-store";
import { appBuilderAgent, makeAppBuilderAgent } from "@/mastra";

/** Snapshot of what exists so edit requests modify instead of recreate. */
export function buildAppContext(appId: string, appName: string): string {
  const entities = listEntities(appId);
  const pages = readAllPages(appId);
  const index = readAppIndex(appId);

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
  const SIZE_LIMIT = 24000;
  const PAGE_LIMIT = 8000;
  const auditParts: string[] = [];
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
    `\nFull page specs are on disk; savePage REPLACES a page entirely, so emit the complete spec when editing one. ui.navigate valid targets: [${pages.map((p) => p.name).join(", ")}].`,
    sourceSection,
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
