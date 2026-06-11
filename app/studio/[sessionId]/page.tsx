import { notFound } from "next/navigation";
import type { UIMessage } from "ai";
import { SessionBuilder } from "@/components/studio/session-builder";
import { loadChatMessages } from "@/lib/server/apps";
import {
  ensureStudioSandbox,
  getSession,
  listCategories,
} from "@/lib/server/fragment-studio";

export const dynamic = "force-dynamic";

export default async function StudioSessionPage(props: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await props.params;
  ensureStudioSandbox();
  const session = getSession(sessionId);
  if (!session) notFound();

  return (
    <SessionBuilder
      session={session}
      initialMessages={loadChatMessages(sessionId) as UIMessage[]}
      categories={listCategories()}
    />
  );
}
