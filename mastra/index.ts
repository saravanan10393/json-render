import { Mastra } from "@mastra/core";
import { Agent } from "@mastra/core/agent";
import { LangfuseExporter } from "@mastra/langfuse";
import { Observability } from "@mastra/observability";
import { AGENT_INSTRUCTIONS } from "./instructions";
import { fragmentAuthorAgent } from "./studio-agent";
import {
  defineEntity,
  deletePage,
  saveAppIndex,
  savePage,
  searchFragments,
  seedRecords,
} from "./tools";

const OPENROUTER_MODEL =
  process.env.OPENROUTER_MODEL ?? "anthropic/claude-sonnet-4.5";

export const appBuilderAgent = new Agent({
  id: "app-builder",
  name: "App Builder",
  instructions: AGENT_INSTRUCTIONS,
  // Mastra model-router string: routes through OpenRouter using OPENROUTER_API_KEY.
  model: `openrouter/${OPENROUTER_MODEL}`,
  tools: { searchFragments, defineEntity, seedRecords, savePage, deletePage, saveAppIndex },
});

// Langfuse AI tracing — every agent run (LLM calls, tool calls, params,
// outputs) lands as a trace. Keys live in .env.local; tracing is simply
// disabled when they're absent.
const langfuseConfigured =
  !!process.env.LANGFUSE_PUBLIC_KEY && !!process.env.LANGFUSE_SECRET_KEY;

export const mastra = new Mastra({
  agents: { appBuilderAgent, fragmentAuthorAgent },
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
