/**
 * Direct text→image call to OpenRouter for the design-stage image mockup.
 * Bypasses the design agent's tool loop entirely — `generateMockupRepresentation`
 * synthesises a single-shot prompt (sitemap section + theme) and we hit the
 * image-gen model with `modalities: ["image"]`. The returned base64 PNG is
 * stored as a data URL in the mockup slot; the build handoff attaches the
 * same data URL as a vision part to the frontend agent (Sonnet 4.5, native
 * multimodal) — no model swap, no rasterisation.
 *
 * Default model: google/gemini-3.1-flash-image (Nano Banana 2). FLUX models
 * + Gemini 2.5 Flash Image also work — pick via run.config.models.imageGen.
 */

import { resolveModel } from "@/lib/server/models";

interface ImageGenResponse {
  choices?: Array<{
    message?: {
      images?: Array<{ image_url?: { url?: string } }>;
    };
  }>;
  error?: { message?: string };
}

/** Synthesize an image-mode mockup from a single prompt and return its data URL. */
export async function generateMockupImage(
  prompt: string,
  modelOverride?: string,
): Promise<{ dataUrl: string }> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is required for image generation.");

  const model = resolveModel("imageGen", modelOverride);
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      // image-only output works for every text→image model on OpenRouter
      // (Gemini Nano Banana, FLUX, …); asking for ["image","text"] gets a
      // 404 on image-only models like FLUX that can't emit text alongside.
      modalities: ["image"],
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`image-gen request failed: ${res.status} ${res.statusText} — ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as ImageGenResponse;
  if (json.error) throw new Error(`image-gen API error: ${json.error.message ?? "unknown"}`);
  const dataUrl = json.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!dataUrl || !dataUrl.startsWith("data:image/")) {
    throw new Error(`image-gen returned no image (response shape changed?)`);
  }
  return { dataUrl };
}
