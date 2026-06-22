import { Mastra } from "@mastra/core";
import { Agent } from "@mastra/core/agent";
import { LangfuseExporter } from "@mastra/langfuse";
import { Observability } from "@mastra/observability";
import { resolveModel } from "@/lib/server/models";
import {
  buildBackendInstructions,
  buildDesignInstructions,
  buildFrontendInstructions,
  buildInstructions,
} from "./instructions";
import { fragmentAuthorAgent } from "./studio-agent";
import {
  applyDesignSystem,
  defineEntity,
  deletePage,
  saveAppIndex,
  saveDesignArtifact,
  savePage,
  saveSitemap,
  searchFragments,
  seedRecords,
} from "./tools";

// OpenRouter occasionally drops the streaming socket mid-request (EPIPE /
// "other side closed"); these are retryable. Bump the AI SDK default (2) so a
// flaky window recovers automatically instead of surfacing to the UI.
const MAX_RETRIES = Number(process.env.OPENROUTER_MAX_RETRIES ?? 4);

const BASE_TOOLS = { applyDesignSystem, defineEntity, seedRecords, savePage, deletePage, saveAppIndex };

// Staged-pipeline agents: the combined builder split along its tool boundary.
// Backend owns the data model (+ theme when the designer is off); Design owns
// theme + sitemap + mockup; Frontend owns pages + navigation (and fragments
// when enabled). The combined makeAppBuilderAgent stays for the benchmark.
const DATA_TOOLS = { defineEntity, seedRecords };
const DESIGN_TOOLS = { applyDesignSystem, saveSitemap, saveDesignArtifact };
const FRONTEND_TOOLS = { savePage, deletePage, saveAppIndex };

// Backend owns the DATA MODEL only — never the theme. With the designer on the
// Design agent themes; with it off the app keeps the default theme. Theming is
// never a side effect of the data agent — it only happens when the designer is on.
export function makeBackendAgent({ model }: { model?: string } = {}): Agent {
  return new Agent({
    id: "backend-designer",
    name: "Backend Designer",
    instructions: buildBackendInstructions(),
    model: `openrouter/${resolveModel("backend", model)}`,
    maxRetries: MAX_RETRIES,
    tools: DATA_TOOLS,
  });
}

export function makeDesignAgent({ model }: { model?: string } = {}): Agent {
  return new Agent({
    id: "design-agent",
    name: "Designer",
    instructions: buildDesignInstructions(),
    model: `openrouter/${resolveModel("design", model)}`,
    maxRetries: MAX_RETRIES,
    tools: DESIGN_TOOLS,
  });
}

export function makeFrontendAgent({
  fragments,
  model,
}: {
  fragments: boolean;
  /** Pass the vision model here for the image-input turn; otherwise the role default. */
  model?: string;
}): Agent {
  return new Agent({
    id: fragments ? "frontend-builder" : "frontend-builder-nofrag",
    name: fragments ? "Frontend Builder" : "Frontend Builder (no fragments)",
    instructions: buildFrontendInstructions({ fragments }),
    model: `openrouter/${resolveModel("frontend", model)}`,
    maxRetries: MAX_RETRIES,
    tools: fragments ? { searchFragments, ...FRONTEND_TOOLS } : FRONTEND_TOOLS,
  });
}

/**
 * Creates a fresh App Builder agent. The fragments flag controls BOTH the
 * prompt (RAG retrieval directive + names line) and the searchFragments tool
 * — the baseline variant hand-builds pages from raw components only.
 *
 * NOTE: agents returned here are NOT registered with the Mastra instance and
 * do NOT inherit Langfuse/Observability wiring. For traced production use,
 * import `appBuilderAgent`.
 */
export function makeAppBuilderAgent({
  fragments,
  model,
}: {
  fragments: boolean;
  model?: string;
}): Agent {
  return new Agent({
    id: fragments ? "app-builder" : "app-builder-nofrag",
    name: fragments ? "App Builder" : "App Builder (no fragments)",
    instructions: buildInstructions({ fragments }),
    // Mastra model-router string: routes through OpenRouter using OPENROUTER_API_KEY.
    model: `openrouter/${resolveModel("frontend", model)}`,
    maxRetries: MAX_RETRIES,
    tools: fragments ? { searchFragments, ...BASE_TOOLS } : BASE_TOOLS,
  });
}

export const appBuilderAgent = makeAppBuilderAgent({ fragments: true });

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
