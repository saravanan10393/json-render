import { toAISdkStream } from "@mastra/ai-sdk";
import { RequestContext } from "@mastra/core/request-context";
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  type UIMessage,
} from "ai";
import { NextResponse } from "next/server";
import {
  getApp,
  loadChatMessages,
  readAllPages,
  readAppIndex,
  saveChatMessage,
} from "@/lib/server/apps";
import { listEntities } from "@/lib/server/entity-store";
import { mastra } from "@/mastra";

export const maxDuration = 600;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ appId: string }> },
) {
  const { appId } = await params;
  return NextResponse.json({ messages: loadChatMessages(appId) });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ appId: string }> },
) {
  const { appId } = await params;
  const app = getApp(appId);
  if (!app) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { messages } = (await req.json()) as { messages: UIMessage[] };

  const agent = mastra.getAgent("appBuilderAgent");
  const agentStream = await agent.stream(
    messages as unknown as Parameters<typeof agent.stream>[0],
    {
      maxSteps: 40,
      requestContext: new RequestContext([["appId", appId]]),
      // Tag Langfuse traces so runs are filterable per app.
      tracingOptions: { metadata: { appId, appName: app.name } },
      context: [{ role: "system", content: buildAppContext(appId, app.name) }],
    },
  );

  const stream = createUIMessageStream({
    originalMessages: messages,
    execute: async ({ writer }) => {
      writer.merge(
        toAISdkStream(agentStream, {
          from: "agent",
          version: "v6",
          onError: formatStreamError,
        }),
      );
    },
    onFinish: ({ messages: allMessages }) => {
      for (const message of allMessages) {
        saveChatMessage(appId, message);
      }
    },
  });

  return createUIMessageStreamResponse({ stream });
}

/** Snapshot of what exists so edit requests modify instead of recreate. */
function buildAppContext(appId: string, appName: string): string {
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

function formatStreamError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("OPENROUTER_API_KEY") || message.includes("API key")) {
    return "OpenRouter API key is missing or invalid. Add OPENROUTER_API_KEY to .env.local and restart the dev server.";
  }
  return message.split("\n")[0];
}
