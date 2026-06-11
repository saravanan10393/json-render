import { Mastra } from "@mastra/core";
import { Agent } from "@mastra/core/agent";
import { AGENT_INSTRUCTIONS } from "./instructions";
import {
  defineEntity,
  deletePage,
  saveAppIndex,
  savePage,
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
  tools: { defineEntity, seedRecords, savePage, deletePage, saveAppIndex },
});

export const mastra = new Mastra({
  agents: { appBuilderAgent },
});
