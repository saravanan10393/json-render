// Deterministic-math palette generator (ported from json-render-llm's
// builder/theme/shuffle.ts). The random part is just hue + vibe; everything
// downstream is OKLch math that guarantees AA-readable foregrounds, an even
// chart ramp, and a coherent dark partner — things an LLM can't reliably do.
// Emits kebab-case shadcn token names (matching our colorTweaks contract).

export type ShuffleVibe = "vibrant" | "muted" | "pastel" | "mono";

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function oklch(l: number, c: number, h: number): string {
  return `oklch(${clamp(l, 0, 1).toFixed(3)} ${clamp(c, 0, 0.4).toFixed(3)} ${((((h % 360) + 360) % 360)).toFixed(1)})`;
}

/** AA-tier foreground: white on dark surfaces, near-black on light ones. */
function pickFg(surfaceL: number): string {
  return surfaceL < 0.55 ? "oklch(0.985 0 0)" : "oklch(0.205 0 0)";
}

function rampHues(seedHue: number, n: number): number[] {
  const step = 360 / n;
  return Array.from({ length: n }, (_, i) => (seedHue + i * step) % 360);
}

interface Profile {
  chroma: number;
  primaryL: number;
  radius: number;
  chartChroma: number;
}

const PROFILES: Record<ShuffleVibe, Profile> = {
  vibrant: { chroma: 0.22, primaryL: 0.55, radius: 0.5, chartChroma: 0.18 },
  muted: { chroma: 0.11, primaryL: 0.5, radius: 0.625, chartChroma: 0.1 },
  pastel: { chroma: 0.08, primaryL: 0.72, radius: 1.0, chartChroma: 0.07 },
  mono: { chroma: 0, primaryL: 0.3, radius: 0.375, chartChroma: 0 },
};

// Neutral chassis (kebab token names) — surfaces/borders/muted stay close to
// the shadcn baseline; only the coloured tokens shift per shuffle.
const LIGHT_NEUTRALS: Record<string, string> = {
  background: "oklch(1 0 0)",
  foreground: "oklch(0.145 0 0)",
  card: "oklch(1 0 0)",
  "card-foreground": "oklch(0.145 0 0)",
  popover: "oklch(1 0 0)",
  "popover-foreground": "oklch(0.145 0 0)",
  secondary: "oklch(0.97 0 0)",
  "secondary-foreground": "oklch(0.205 0 0)",
  muted: "oklch(0.97 0 0)",
  "muted-foreground": "oklch(0.556 0 0)",
  accent: "oklch(0.97 0 0)",
  "accent-foreground": "oklch(0.205 0 0)",
  destructive: "oklch(0.577 0.245 27.325)",
  border: "oklch(0.922 0 0)",
  input: "oklch(0.922 0 0)",
  sidebar: "oklch(0.985 0 0)",
  "sidebar-foreground": "oklch(0.145 0 0)",
  "sidebar-accent": "oklch(0.97 0 0)",
  "sidebar-accent-foreground": "oklch(0.205 0 0)",
  "sidebar-border": "oklch(0.922 0 0)",
};

const DARK_NEUTRALS: Record<string, string> = {
  background: "oklch(0.145 0 0)",
  foreground: "oklch(0.985 0 0)",
  card: "oklch(0.205 0 0)",
  "card-foreground": "oklch(0.985 0 0)",
  popover: "oklch(0.205 0 0)",
  "popover-foreground": "oklch(0.985 0 0)",
  secondary: "oklch(0.269 0 0)",
  "secondary-foreground": "oklch(0.985 0 0)",
  muted: "oklch(0.269 0 0)",
  "muted-foreground": "oklch(0.708 0 0)",
  accent: "oklch(0.269 0 0)",
  "accent-foreground": "oklch(0.985 0 0)",
  destructive: "oklch(0.704 0.191 22.216)",
  border: "oklch(1 0 0 / 10%)",
  input: "oklch(1 0 0 / 15%)",
  sidebar: "oklch(0.205 0 0)",
  "sidebar-foreground": "oklch(0.985 0 0)",
  "sidebar-accent": "oklch(0.269 0 0)",
  "sidebar-accent-foreground": "oklch(0.985 0 0)",
  "sidebar-border": "oklch(1 0 0 / 10%)",
};

function makePalette(hue: number, p: Profile, dark: boolean): Record<string, string> {
  const primaryL = dark ? clamp(p.primaryL + 0.1, 0.4, 0.85) : p.primaryL;
  const primary = oklch(primaryL, p.chroma, hue);
  const fg = pickFg(primaryL);
  const h = rampHues(hue, 5);
  const cc = p.chartChroma;
  const base = dark ? DARK_NEUTRALS : LIGHT_NEUTRALS;
  return {
    ...base,
    primary,
    "primary-foreground": fg,
    ring: primary,
    "chart-1": oklch(dark ? 0.68 : 0.65, cc, h[0]),
    "chart-2": oklch(dark ? 0.62 : 0.6, cc * 0.85, h[1]),
    "chart-3": oklch(dark ? 0.56 : 0.55, cc * 0.7, h[2]),
    "chart-4": oklch(0.5, cc * 0.55, h[3]),
    "chart-5": oklch(dark ? 0.44 : 0.45, cc * 0.4, h[4]),
    "sidebar-primary": primary,
    "sidebar-primary-foreground": fg,
    "sidebar-ring": primary,
  };
}

export interface ShufflePalette {
  vibe: ShuffleVibe;
  radius: string;
  light: Record<string, string>;
  dark: Record<string, string>;
}

/** Roll a random palette (uniform hue + vibe). The yellow band is skipped for
 *  gentler vibes where low chroma reads as washed-out beige. */
export function shufflePalette(): ShufflePalette {
  const vibes: ShuffleVibe[] = ["vibrant", "muted", "pastel", "mono"];
  const vibe = vibes[Math.floor(Math.random() * vibes.length)];
  let hue = Math.random() * 360;
  if (vibe !== "vibrant" && hue >= 60 && hue <= 110) hue = (hue + 60) % 360;
  const p = PROFILES[vibe];
  return {
    vibe,
    radius: `${p.radius}rem`,
    light: makePalette(hue, p, false),
    dark: makePalette(hue, p, true),
  };
}
