import { RequestContext } from "@mastra/core/request-context";
import type { UIMessage } from "ai";
import { readAllPages, readAppIndex } from "@/lib/server/apps";
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

  return [
    `App "${appName}" (id: ${appId}) — CURRENT STATE (modify via tools; re-save only what changes):`,
    `\nENTITIES:\n${entitySummary || "(none)"}`,
    `\nPAGES:\n${pageSummary || "(none)"}`,
    `\nAPP INDEX (app.json):\n${index ? JSON.stringify(index) : "(not written yet — call saveAppIndex)"}`,
    `\nFull page specs are on disk; savePage REPLACES a page entirely, so emit the complete spec when editing one. ui.navigate valid targets: [${pages.map((p) => p.name).join(", ")}].`,
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
    messages as unknown as Parameters<typeof agent.stream>[0],
    {
      maxSteps,
      requestContext: new RequestContext([["appId", appId]]),
      // Tag Langfuse traces so runs are filterable per app.
      tracingOptions: { metadata: { appId, appName } },
      context: [{ role: "system", content: buildAppContext(appId, appName) }],
    },
  );
}
