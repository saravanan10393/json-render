import { Mastra } from "@mastra/core";
import { Agent } from "@mastra/core/agent";
import { LangfuseExporter } from "@mastra/langfuse";
import { Observability } from "@mastra/observability";
import { buildInstructions } from "./instructions";
import {
  defineEntity,
  deletePage,
  saveAppIndex,
  savePage,
  seedRecords,
} from "./tools";

const OPENROUTER_MODEL =
  process.env.OPENROUTER_MODEL ?? "anthropic/claude-sonnet-4.5";

const AGENT_TOOLS = { defineEntity, seedRecords, savePage, deletePage, saveAppIndex };

/**
 * Creates a fresh App Builder agent. NOTE: agents returned here are NOT
 * registered with the Mastra instance and do NOT inherit Langfuse/
 * Observability wiring. For traced production use, import `appBuilderAgent`.
 */
export function makeAppBuilderAgent({ fragments }: { fragments: boolean }): Agent {
  return new Agent({
    id: fragments ? "app-builder" : "app-builder-nofrag",
    name: fragments ? "App Builder" : "App Builder (no fragments)",
    instructions: buildInstructions({ fragments }),
    // Mastra model-router string: routes through OpenRouter using OPENROUTER_API_KEY.
    model: `openrouter/${OPENROUTER_MODEL}`,
    tools: AGENT_TOOLS,
  });
}

export const appBuilderAgent = makeAppBuilderAgent({ fragments: true });

// Langfuse AI tracing — every agent run (LLM calls, tool calls, params,
// outputs) lands as a trace. Keys live in .env.local; tracing is simply
// disabled when they're absent.
const langfuseConfigured =
  !!process.env.LANGFUSE_PUBLIC_KEY && !!process.env.LANGFUSE_SECRET_KEY;

export const mastra = new Mastra({
  agents: { appBuilderAgent },
  ...(langfuseConfigured
    ? {
        observability: new Observability({
          configs: {
            langfuse: {
              serviceName: "patchwork-app-builder",
              exporters: [
                new LangfuseExporter({
                  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
                  secretKey: process.env.LANGFUSE_SECRET_KEY,
                  baseUrl: process.env.LANGFUSE_BASE_URL,
                  environment: process.env.NODE_ENV ?? "development",
                  // dev: flush per event so traces appear immediately
                  realtime: process.env.NODE_ENV !== "production",
                }),
              ],
            },
          },
        }),
      }
    : {}),
});
