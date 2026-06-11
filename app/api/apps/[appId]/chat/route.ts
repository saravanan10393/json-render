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
import { runBuilderTurn } from "@/lib/server/builder-run";

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

  const agentStream = await runBuilderTurn({ appId, appName: app.name, messages });

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

function formatStreamError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("OPENROUTER_API_KEY") || message.includes("API key")) {
    return "OpenRouter API key is missing or invalid. Add OPENROUTER_API_KEY to .env.local and restart the dev server.";
  }
  return message.split("\n")[0];
}
