import { toAISdkStream } from "@mastra/ai-sdk";
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  type UIMessage,
} from "ai";
import { NextResponse } from "next/server";
import {
  getApp,
  loadChatMessages,
  saveChatMessage,
} from "@/lib/server/apps";
import { runStageTurn } from "@/lib/server/builder-run";
import { snapshotBuild } from "@/lib/server/builds";
import { resolveModel } from "@/lib/server/models";
import { ensureRun } from "@/lib/server/runs";

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

  // Orchestrator: route the turn to the active stage's agent.
  const run = ensureRun(appId);
  const agentStream = await runStageTurn({
    appId,
    appName: app.name,
    messages,
    stage: run.stage,
    config: run.config,
  });

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
      // After a frontend (build) turn, stash whatever pages landed under the
      // model that produced them — enables A/B between models on the same
      // design artifacts (cheap, idempotent; skipped on non-frontend turns).
      if (run.stage === "frontend") {
        try {
          snapshotBuild(appId, resolveModel("frontend", run.config.models?.frontend));
        } catch (error) {
          console.warn("[builds] snapshot failed:", error instanceof Error ? error.message : error);
        }
      }
    },
  });

  return createUIMessageStreamResponse({ stream });
}

function formatStreamError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("OPENROUTER_API_KEY") || message.includes("API key")) {
    return "OpenRouter API key is missing or invalid. Add OPENROUTER_API_KEY to .env.local and restart the dev server.";
  }
  return message.split("\n")[0];
}
