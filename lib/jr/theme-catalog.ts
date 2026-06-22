/**
 * The unified theme-preset library, bridged to the design agent: a lookup and a
 * reference string built from each preset's own description + font pairing.
 * Descriptions live on each preset in theme-presets.ts (the single source).
 */

import { THEME_PRESETS, type ThemePreset } from "./theme-presets";

/** Look up a theme preset by id. */
export function findThemePreset(id: string): ThemePreset | undefined {
  return THEME_PRESETS.find((p) => p.id === id);
}

/** Preset list for the agent prompt, grouped by category (visual style). */
export function themePresetReference(): string {
  const byCategory = new Map<string, ThemePreset[]>();
  for (const p of THEME_PRESETS) {
    const list = byCategory.get(p.category) ?? [];
    list.push(p);
    byCategory.set(p.category, list);
  }
  return [...byCategory.entries()]
    .map(
      ([category, presets]) =>
        `${category}:\n` +
        presets
          .map((p) => `  - ${p.id} (${p.label}): ${p.description} — fonts: ${p.fonts.heading}/${p.fonts.body}`)
          .join("\n"),
    )
    .join("\n");
}
