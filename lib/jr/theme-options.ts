/**
 * Shared theme-tweaker options — the SINGLE source of truth consumed by both
 * the builder's theme tweaker (the dropdown/slider) AND the design agent's
 * prompt (so the agent only emits values that are actually loadable/valid).
 *
 * Fonts are all Google Fonts (the runtime injects Google Fonts <link>s from
 * theme.json), grouped sans / serif-display / mono.
 */

export const SANS_FONTS = [
  "Inter",
  "Geist",
  "Roboto",
  "Open Sans",
  "Lato",
  "Montserrat",
  "Poppins",
  "Nunito",
  "Work Sans",
  "DM Sans",
  "Plus Jakarta Sans",
  "Manrope",
  "Source Sans 3",
  "Libre Franklin",
  "Figtree",
  "Outfit",
  "Space Grotesk",
  "Sora",
  "IBM Plex Sans",
] as const;

export const DISPLAY_FONTS = [
  "Bricolage Grotesque",
  "Playfair Display",
  "Merriweather",
  "Lora",
  "Fraunces",
  "Libre Baskerville",
  "Source Serif 4",
] as const;

export const MONO_FONTS = [
  "JetBrains Mono",
  "IBM Plex Mono",
  "Fira Code",
  "Space Mono",
  "Geist Mono",
] as const;

/** Every offered font family (sans + display + mono), for the dropdowns. */
export const FONT_OPTIONS: string[] = [...SANS_FONTS, ...DISPLAY_FONTS, ...MONO_FONTS];

/** Base corner radius slider bounds, in rem. */
export const RADIUS_MIN = 0;
export const RADIUS_MAX = 2;
export const RADIUS_STEP = 0.05;

/**
 * Theme tokens grouped by role (kebab-case shadcn names) — the single grouping
 * used both by the theme tweaker (editable rows) and the design page's Theme
 * artifact (read-only swatches), so the two stay in lock-step.
 */
export interface TokenGroup {
  title: string;
  tokens: string[];
  defaultOpen?: boolean;
}

export const TOKEN_GROUPS: TokenGroup[] = [
  { title: "Brand", tokens: ["primary", "primary-foreground", "accent", "accent-foreground", "ring"], defaultOpen: true },
  {
    title: "Surfaces",
    tokens: ["background", "foreground", "card", "card-foreground", "popover", "popover-foreground", "secondary", "secondary-foreground", "muted"],
  },
  { title: "Muted text", tokens: ["muted-foreground"] },
  { title: "Borders & focus", tokens: ["border", "input"] },
  { title: "Status", tokens: ["destructive", "success", "warning", "info"] },
  { title: "Sidebar", tokens: ["sidebar", "sidebar-foreground", "sidebar-primary", "sidebar-accent", "sidebar-border"] },
  { title: "Charts", tokens: ["chart-1", "chart-2", "chart-3", "chart-4", "chart-5"] },
];
