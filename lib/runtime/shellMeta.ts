/**
 * Metadata for every navigation shell the design agent can pick. This is the
 * single source of truth — consumed by:
 *  - the showcase (showcase/shells/ShellCatalog.tsx) → human picker
 *  - the design agent prompt (mastra/instructions.ts NAV_SHELL_SECTION) → agent picker
 *
 * Keep this list aligned with SHELL_COMPONENTS in ./shells.tsx (same ids).
 * No `"use client"` here so server-side prompt code can import the same data.
 */

export interface ShellMeta {
  /** Matches the keys in lib/runtime/shells.tsx SHELL_COMPONENTS. */
  id: string;
  /** Display label (Title Case). */
  label: string;
  /** One-line visual character note. */
  description: string;
  /** 3–5 short structural traits (e.g. "left rail", "icon-only", "two-tier nav"). */
  traits: string[];
  /** Primary pick signal — the strongest reason to choose this shell. */
  useWhen: string;
  /** Counter-signal — apps that should NOT pick this shell. Optional. */
  avoidWhen?: string;
  /** 2–3 concrete example app types to anchor the agent's intuition. */
  examples: string[];
}

export const SHELL_META: ShellMeta[] = [
  {
    id: "sidebar",
    label: "Sidebar",
    description: "Classic left rail with icon + label per entry.",
    traits: ["left rail", "icon + full label", "flat list", "scrollable"],
    useWhen:
      "Business apps with 3-7 primary pages and a flat IA — every page is a top-level destination.",
    avoidWhen:
      "Single-purpose apps, marketing/consumer flows, or dense ops tools where horizontal space matters.",
    examples: [
      "CRM contact manager",
      "Linear-style issue tracker",
      "Settings-heavy admin tool",
    ],
  },
  {
    id: "topnav",
    label: "Top nav",
    description: "Horizontal header with brand + pill nav across the top.",
    traits: ["top bar", "horizontal nav", "brand left, links right", "no left rail"],
    useWhen:
      "Consumer-facing apps where pages feel like destinations and pages are few (≤6).",
    avoidWhen:
      "Operational tools with 7+ pages — the top bar gets cramped fast and the IA loses prominence.",
    examples: [
      "E-commerce storefront",
      "Marketing or blog site",
      "Content reader app",
    ],
  },
  {
    id: "icon-rail",
    label: "Icon rail",
    description: "Slim left column of icons, labels on hover only.",
    traits: ["left rail", "icon-only", "narrow (~56px)", "tooltips for labels"],
    useWhen:
      "Dense ops/admin tools where horizontal space is precious and users learn icons fast.",
    avoidWhen:
      "Apps for occasional users — icons-only is a learning tax. Skip if any page label is ambiguous.",
    examples: [
      "IDE-style developer tool",
      "Media editor",
      "High-density monitoring dashboard",
    ],
  },
  {
    id: "compact-rail",
    label: "Compact rail",
    description: "Slim left rail with icons stacked above tiny labels.",
    traits: ["left rail", "icon + tiny label below", "narrow (~80px)", "more discoverable than icon-only"],
    useWhen:
      "Dashboards with 4-6 sections that want a narrow rail but still need text labels for discoverability.",
    avoidWhen:
      "Apps with 7+ items (vertical labels stack awkwardly) or 1-2 items (the rail feels empty).",
    examples: [
      "Analytics dashboard",
      "Monitoring tool",
      "Fintech app with a few sections",
    ],
  },
  {
    id: "minimal",
    label: "Minimal",
    description: "No nav chrome; tiny floating page switcher in the corner.",
    traits: ["no rail", "no header", "floating switcher", "page = whole screen"],
    useWhen:
      "Single-purpose apps (1-2 pages), landing pages, focus-mode tools, or any app where chrome would distract.",
    avoidWhen:
      "Apps with 3+ pages that users actively switch between — the corner switcher hides the IA.",
    examples: [
      "Single-flow form / wizard",
      "Password generator",
      "Landing-style portfolio",
    ],
  },
  {
    id: "split-rail",
    label: "Split rail",
    description: "Icon rail (level 1) plus a labelled panel beside it (level 2).",
    traits: ["two-tier left nav", "icon rail + secondary panel", "wider total footprint", "supports grouped IA"],
    useWhen:
      "Multi-module apps where each module has sub-sections — pick a module on the rail, see its pages in the panel.",
    avoidWhen:
      "Apps without natural two-tier IA — adds visual complexity for nothing.",
    examples: [
      "Mail client (folders + threads)",
      "Admin console (modules + pages)",
      "Design tool with multi-page projects",
    ],
  },
  {
    id: "grouped-sidebar",
    label: "Grouped sidebar",
    description: "Left rail with section-label headers above each group of entries.",
    traits: ["left rail", "icon + full label", "section headers", "single flat list per group"],
    useWhen:
      "Apps with 7+ top-level pages that benefit from being grouped (e.g. Operations · Reports · Settings).",
    avoidWhen:
      "Apps with ≤6 pages — group headers add noise without IA benefit. Use plain `sidebar` instead.",
    examples: [
      "Multi-module admin console",
      "Workspace settings app",
      "BI app with grouped report sections",
    ],
  },
  {
    id: "nested-sidebar",
    label: "Nested sidebar",
    description: "Left rail with collapsible group sections — fold whole sections away.",
    traits: ["left rail", "collapsible groups", "chevron toggles", "deep IA support"],
    useWhen:
      "Apps with 10+ pages or deep IA where users want to hide whole sections to focus on one area.",
    avoidWhen:
      "Apps with shallow IA — the toggle interaction is a tax when nothing needs hiding.",
    examples: [
      "Enterprise admin (modules + many pages per module)",
      "Documentation portal",
      "Compliance / audit app with deep section trees",
    ],
  },
  {
    id: "inset-sidebar",
    label: "Inset sidebar",
    description: "Flush left rail; main content sits in a rounded card with margin.",
    traits: ["left rail", "rounded inset canvas", "soft modern look", "margin around content"],
    useWhen:
      "Modern SaaS feel — softens dense apps and signals a more consumer-tier product.",
    avoidWhen:
      "High-density ops tools where every pixel of canvas matters — the margin wastes screen real estate.",
    examples: [
      "Modern productivity SaaS",
      "Workspace / docs apps (Notion-style)",
      "Premium consumer-tier dashboards",
    ],
  },
  {
    id: "floating-sidebar",
    label: "Floating sidebar",
    description: "Both rail AND main content float as rounded cards with a gap from the edges.",
    traits: ["rail floats with rounded card", "gap around everything", "shadow lift", "most polished look"],
    useWhen:
      "Consumer-facing or marketing-style apps where the polish/lift matters more than density.",
    avoidWhen:
      "Operational/ops tools — the gap and lift waste space and signal the wrong tier.",
    examples: [
      "Consumer fintech",
      "Marketing-style portals",
      "Polished launch products",
    ],
  },
  {
    id: "right-sidebar",
    label: "Right sidebar",
    description: "Mirror of `sidebar` — nav on the right.",
    traits: ["right rail", "icon + full label", "flat list", "left-handed canvas"],
    useWhen:
      "Tools-panel apps where the main canvas reads left-to-right and controls sit on the right where the dominant hand reaches.",
    avoidWhen:
      "Standard business apps — users expect nav on the left, breaking that convention surprises them.",
    examples: [
      "Image / video editors",
      "Audio workstations",
      "Apps where the dominant action area is on the left",
    ],
  },
  {
    id: "dual-sidebar",
    label: "Dual sidebar",
    description: "Primary nav on the left + persistent context/properties panel on the right.",
    traits: ["left primary nav", "right context panel", "wide chrome", "editor-style"],
    useWhen:
      "Editor-style apps where the canvas needs a persistent context panel (page outline, properties, comments, AI assist).",
    avoidWhen:
      "Apps without per-page context — the right panel becomes empty visual weight.",
    examples: [
      "Visual editors (Figma-style)",
      "Document editors with outline/properties",
      "IDEs with file tree + inspector",
    ],
  },
];
