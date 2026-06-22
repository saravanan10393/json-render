/**
 * Per-role model registry. Each agent role resolves to a model independently
 * so the user can pick per-app (e.g. cheap text-only for the data-model agent,
 * highest-fidelity for the build).
 *
 * Resolution order (per role): explicit per-app override (run.config.models)
 *   → env override (OPENROUTER_<ROLE>_MODEL or legacy OPENROUTER_MODEL)
 *   → DEFAULT_MODELS.
 *
 * The string returned is the OpenRouter slug Mastra's model-router expects
 * (prefix `openrouter/` is added at call sites). `imageGen` is the text→image
 * model used for image-mode mockups; it bypasses the agent loop and is called
 * directly via lib/server/image-gen.ts.
 */

export type ModelRole = "backend" | "design" | "frontend" | "imageGen";

export const MODEL_ROLES: ModelRole[] = ["backend", "design", "frontend", "imageGen"];

/** Curated picks surfaced in the per-app model picker — the few combos we want
 *  the human to flip between, not every OpenRouter model. */
export interface ModelOption {
  id: string;
  label: string;
  /** Short character note shown in the picker tooltip. */
  description: string;
  /** Provider family — groups the dropdown. */
  family: "GLM" | "Anthropic" | "Google";
  /** True iff this model GENERATES images (text→image output). Filters the
   *  imageGen slot in the picker so text models aren't selectable there. */
  imageGen?: boolean;
}

export const MODEL_OPTIONS: ModelOption[] = [
  // Text agents (tool calling, long-horizon).
  {
    id: "z-ai/glm-5.2",
    label: "GLM 5.2",
    description: "Zhipu · 1M ctx · long-horizon tool use · the cheapest tier",
    family: "GLM",
  },
  {
    id: "google/gemini-3.5-flash",
    label: "Gemini 3.5 Flash",
    description: "Google · 1M ctx · fast, multimodal input · slight premium over GLM 5.2",
    family: "Google",
  },
  {
    id: "anthropic/claude-sonnet-4.5",
    label: "Claude Sonnet 4.5",
    description: "Anthropic · highest layout fidelity & strongest tool calling",
    family: "Anthropic",
  },
  // Image generation (text→image). Used only for image-mode mockups.
  {
    id: "google/gemini-3.1-flash-image",
    label: "Gemini 3.1 Flash Image (Nano Banana 2)",
    description: "Google · pro-level UI mockups at flash speed · $0.50/$3 per 1M",
    family: "Google",
    imageGen: true,
  },
];

export const DEFAULT_MODELS: Record<ModelRole, string> = {
  // Backend: GLM 5.2 — entities + seed data, cheap and reliable.
  backend: "z-ai/glm-5.2",
  // Design: Gemini 3.5 Flash — fast, multimodal (handles theme/sitemap/text
  // mockups in one turn). Slight premium over GLM 5.2; trade for speed.
  design: "google/gemini-3.5-flash",
  // Frontend: Sonnet 4.5 — vision-native (reads image mockups directly, no
  // model swap needed). Most expensive per-turn but only fires on build.
  frontend: "anthropic/claude-sonnet-4.5",
  // Image gen: Gemini 3.1 Flash Image — cheap + clean UI mockups, used only
  // when the user picks image-mode in the design step.
  imageGen: "google/gemini-3.1-flash-image",
};

const ENV_KEY: Record<ModelRole, string> = {
  backend: "OPENROUTER_BACKEND_MODEL",
  design: "OPENROUTER_DESIGN_MODEL",
  frontend: "OPENROUTER_FRONTEND_MODEL",
  imageGen: "OPENROUTER_IMAGE_GEN_MODEL",
};

/** Resolve the model slug for a role, honouring per-app override → env → default.
 *  The legacy `OPENROUTER_MODEL` env applies only to text roles — image-gen has
 *  its own dedicated env var (different model category, distinct API surface). */
export function resolveModel(role: ModelRole, override?: string): string {
  if (override) return override;
  const roleEnv = process.env[ENV_KEY[role]];
  if (roleEnv) return roleEnv;
  if (role !== "imageGen" && process.env.OPENROUTER_MODEL) return process.env.OPENROUTER_MODEL;
  return DEFAULT_MODELS[role];
}
