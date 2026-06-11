import { toAISdkStream } from "@mastra/ai-sdk";
import { RequestContext } from "@mastra/core/request-context";
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  type UIMessage,
} from "ai";
import { NextResponse } from "next/server";
import { loadChatMessages, saveChatMessage } from "@/lib/server/apps";
import {
  ensureStudioSandbox,
  getDraft,
  getSession,
} from "@/lib/server/fragment-studio";
import { mastra } from "@/mastra";

export const maxDuration = 600;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;
  if (!getSession(sessionId)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ messages: loadChatMessages(sessionId) });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;
  ensureStudioSandbox();
  const session = getSession(sessionId);
  if (!session) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { messages } = (await req.json()) as { messages: UIMessage[] };

  const draft = getDraft(sessionId);
  const contextLines = [
    `SESSION STATE — this session is about ONE fragment.`,
    session.fragmentName
      ? `Fragment: ${session.fragmentName} (status: ${session.status}, origin: ${session.origin}${session.category ? `, category: ${session.category}` : ""}).`
      : "Fragment: not named yet — the first saveDraft sets it.",
    draft
      ? `A draft exists on disk; re-save the FULL source to modify it. Current draft source:\n\`\`\`ts\n${draft.source}\n\`\`\``
      : session.status === "promoted"
        ? "No draft — the fragment is published. To edit it: readFragment, modify, saveDraft the full source with a bumped version."
        : "No draft yet.",
  ];

  const agent = mastra.getAgent("fragmentAuthorAgent");
  const agentStream = await agent.stream(
    messages as unknown as Parameters<typeof agent.stream>[0],
    {
      maxSteps: 25,
      requestContext: new RequestContext([["sessionId", sessionId]]),
      tracingOptions: { metadata: { surface: "fragment-studio", sessionId } },
      context: [{ role: "system", content: contextLines.join("\n") }],
    },
  );

  const stream = createUIMessageStream({
    originalMessages: messages,
    execute: async ({ writer }) => {
      writer.merge(
        toAISdkStream(agentStream, {
          from: "agent",
          version: "v6",
          onError: (error) =>
            (error instanceof Error ? error.message : String(error)).split("\n")[0],
        }),
      );
    },
    onFinish: ({ messages: allMessages }) => {
      for (const message of allMessages) saveChatMessage(sessionId, message);
    },
  });

  return createUIMessageStreamResponse({ stream });
}
