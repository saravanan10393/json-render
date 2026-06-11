"use client";

import type { ChatStatus, UIMessage } from "ai";
import {
  AlertTriangle,
  Database,
  FileCode2,
  Loader2,
  PencilLine,
  Sparkles,
  Trash2,
} from "lucide-react";
import type { ReactNode } from "react";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  "A task tracker: dashboard with KPIs, filterable task list, add/edit tasks",
  "An expense manager with categories, a spending dashboard, and entry form",
  "A tiny CRM: contacts list with search, deal pipeline, new-contact form",
];

interface ChatPanelProps {
  messages: UIMessage[];
  status: ChatStatus;
  error?: Error;
  onSend: (text: string) => void;
  onStop: () => void;
}

export function ChatPanel({
  messages,
  status,
  error,
  onSend,
  onStop,
}: ChatPanelProps) {
  const busy = status === "submitted" || status === "streaming";

  const handleSubmit = (message: PromptInputMessage) => {
    const text = message.text.trim();
    if (!text || busy) return;
    onSend(text);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Conversation className="min-h-0 flex-1">
        <ConversationContent className="gap-4 px-4 py-5">
          {messages.length === 0 ? (
            <EmptyState onPick={onSend} />
          ) : (
            messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))
          )}
          {status === "submitted" && (
            <div className="flex items-center gap-2 px-1 font-mono text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              thinking…
            </div>
          )}
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              <span>{formatChatError(error)}</span>
            </div>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="border-t border-border p-3">
        <PromptInput onSubmit={handleSubmit}>
          <PromptInputBody>
            <PromptInputTextarea
              placeholder="Describe the app you want to build…"
              autoFocus
            />
          </PromptInputBody>
          <PromptInputFooter>
            <PromptInputTools>
              <span className="px-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                json-render · shadcn
              </span>
            </PromptInputTools>
            <PromptInputSubmit status={status} onStop={onStop} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}

function formatChatError(error: Error): string {
  // Server stream errors arrive as JSON blobs; show only the message.
  try {
    const parsed = JSON.parse(error.message) as { message?: string };
    if (parsed.message) return parsed.message;
  } catch {
    // not JSON — fall through
  }
  return error.message || "Something went wrong. Try again.";
}

function ChatMessage({ message }: { message: UIMessage }) {
  const blocks: ReactNode[] = [];

  message.parts.forEach((part, index) => {
    const key = `${message.id}-${index}`;
    if (part.type === "text" && part.text.trim()) {
      blocks.push(<MessageResponse key={key}>{part.text}</MessageResponse>);
    } else if (part.type.startsWith("tool-")) {
      blocks.push(<BuildStep key={key} part={part as unknown as ToolPartLike} />);
    }
  });

  if (blocks.length === 0) return null;

  return (
    <Message from={message.role}>
      <MessageContent
        className={cn(
          message.role === "assistant" &&
            "w-full max-w-full bg-transparent p-0",
        )}
      >
        {blocks}
      </MessageContent>
    </Message>
  );
}

interface ToolPartLike {
  type: string;
  state:
    | "input-streaming"
    | "input-available"
    | "output-available"
    | "output-error"
    | string;
  input?: Record<string, unknown>;
  output?: { ok?: boolean; issues?: string[]; name?: string } | null;
  errorText?: string;
}

/** Compact activity chip for one agent tool call (page save/delete, naming). */
function BuildStep({ part }: { part: ToolPartLike }) {
  const input = part.input ?? {};
  const running = part.state === "input-streaming" || part.state === "input-available";
  const failed =
    part.state === "output-error" || (part.output != null && part.output.ok === false);
  const issues = part.output?.issues ?? [];

  let icon: ReactNode;
  let label: string;
  switch (part.type) {
    case "tool-savePage": {
      icon = <FileCode2 className="size-3.5" />;
      const title = (input.name as string) ?? "page";
      label = running ? `Building page: ${title}` : `Page: ${title}`;
      break;
    }
    case "tool-defineEntity":
      icon = <Database className="size-3.5" />;
      label = `Entity: ${(input.name as string) ?? "…"}`;
      break;
    case "tool-seedRecords": {
      icon = <Database className="size-3.5" />;
      const n = Array.isArray(input.records) ? input.records.length : "";
      label = `Seeded ${n} ${(input.entity as string) ?? ""} records`;
      break;
    }
    case "tool-saveAppIndex":
      icon = <PencilLine className="size-3.5" />;
      label = "Navigation & app index";
      break;
    case "tool-deletePage":
      icon = <Trash2 className="size-3.5" />;
      label = `Removed page ${(input.id as string) ?? ""}`;
      break;
    default:
      icon = <Sparkles className="size-3.5" />;
      label = part.type.replace("tool-", "");
  }

  return (
    <div
      className={cn(
        "flex w-fit max-w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 font-mono text-xs",
        running && "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
        failed && "border-destructive/40 bg-destructive/10 text-destructive",
        !running && !failed && "border-border bg-muted/50 text-muted-foreground",
      )}
    >
      {running ? <Loader2 className="size-3.5 animate-spin" /> : icon}
      <span className="truncate">{label}</span>
      {failed && issues.length > 0 && (
        <span title={issues.join("\n")}>
          <AlertTriangle className="size-3.5 shrink-0" />
        </span>
      )}
    </div>
  );
}

function EmptyState({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="flex flex-col gap-6 px-1 pt-10">
      <div className="space-y-2">
        <p className="font-heading text-xl font-semibold">
          What should we build?
        </p>
        <p className="text-sm text-muted-foreground">
          Describe an app and the agent assembles it page by page — live, on
          the right.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => onPick(suggestion)}
            className="rounded-lg border border-border bg-card px-3 py-2.5 text-left text-sm text-card-foreground transition-colors hover:border-amber-500/50 hover:bg-accent"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}
