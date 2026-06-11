import { notFound } from "next/navigation";
import type { UIMessage } from "ai";
import { AppBuilder } from "@/components/builder/app-builder";
import { getApp, loadChatMessages } from "@/lib/server/apps";

export const dynamic = "force-dynamic";

export default async function AppBuilderPage(props: {
  params: Promise<{ appId: string }>;
}) {
  const { appId } = await props.params;
  const app = getApp(appId);
  if (!app) notFound();

  const initialMessages = loadChatMessages(appId) as UIMessage[];

  return (
    <AppBuilder
      app={{ id: app.id, name: app.name, description: app.description }}
      initialMessages={initialMessages}
    />
  );
}
