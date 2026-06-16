/**
 * Showcase metadata for blocks (fragments). Each block's name/description/
 * category comes from the live fragment; the preview is driven by the
 * fragment's OWN `previewParams` (the same params Fragment Studio + the promote
 * gate use), rendered against the in-memory mock executor seeded from SEED.
 *
 * Blocks are grouped by BUNDLE — which maps 1:1 to the fragments/<bundle>
 * folders. A bundle's tier decides the top-level group: "generic" (entity-
 * agnostic — you pass bdo + a field map) vs "domain" (fixed entity contracts,
 * shipped as a wired bundle, e.g. ecommerce).
 *
 * Seed bank: Product + Order do most of the work (the generic kit's
 * previewParams use them, and several domain bundles reuse Order/Product as a
 * stand-in). The domain entities below let the CRM/helpdesk/projects/blog
 * previews populate too. A fragment whose datasources hit an unseeded entity
 * still renders — just with empty states.
 */
import { fragmentBundles, type FragmentTier } from "@/fragments";
import type { Fragment } from "@/lib/jr/schema";

type Rec = Record<string, unknown>;
export type BlockTier = FragmentTier;

export interface BlockDemo {
  /** Sample records per entity the block reads/writes. */
  seed: Record<string, Rec[]>;
  /** Single-ref demo: params for this block's $fragment ref. */
  params?: Record<string, unknown>;
  /**
   * Composite demo: a full source spec (multiple $fragment refs wired
   * together) — reserved for blocks only meaningful alongside another.
   */
  source?: { root: string; elements: Record<string, unknown> };
}

export interface BlockEntry {
  /** Machine id (the $fragment value). */
  id: string;
  /** Human display label (with spaces). */
  name: string;
  tier: BlockTier;
  /** Source bundle/folder under fragments/ (e.g. "generic", "ecommerce"). */
  bundle: string;
  /** Journey grouping within the bundle (drives the Section drilldown). */
  section: string;
  category: string;
  description: string;
  /** The fragment's Zod params schema — drives the Schema tab + playground. */
  paramsSchema: unknown;
  /** null when the fragment ships no previewParams. */
  demo: BlockDemo | null;
}

// ── Seed bank ───────────────────────────────────────────────────────────────
const PRODUCTS: Rec[] = [
  { Name: "Aurora Desk Lamp", Description: "Warm-dimming LED with USB-C", Price: 79, Category: "Lighting", ImageUrl: "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=320", Rating: 4, Stock: 42 },
  { Name: "Nimbus Office Chair", Description: "Mesh-back ergonomic chair", Price: 329, Category: "Furniture", ImageUrl: "https://images.unsplash.com/photo-1580480055273-228ff5388ef8?w=320", Rating: 5, Stock: 12 },
  { Name: "Pulse Mechanical Keyboard", Description: "Hot-swap, 75% layout", Price: 149, Category: "Electronics", ImageUrl: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=320", Rating: 4, Stock: 0 },
  { Name: "Drift Wireless Mouse", Description: "Silent click, 70-day battery", Price: 59, Category: "Electronics", ImageUrl: "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=320", Rating: 3, Stock: 88 },
  { Name: "Loom Wool Throw", Description: "Hand-loomed merino blanket", Price: 119, Category: "Home", ImageUrl: "https://images.unsplash.com/photo-1600369671236-e74521d4b6ad?w=320", Rating: 5, Stock: 23 },
  { Name: "Verde Planter Set", Description: "Set of 3 ceramic planters", Price: 44, Category: "Home", ImageUrl: "https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=320", Rating: 4, Stock: 67 },
];

const ORDERS: Rec[] = [
  { CustomerName: "Priya Nair", Email: "priya@example.com", Address: "12 Linden Ave", City: "Austin", Zip: "73301", Status: "Delivered", Total: 408, PlacedAt: "2026-05-28" },
  { CustomerName: "Marcus Reid", Email: "marcus@example.com", Address: "9 Castle Row", City: "Denver", Zip: "80014", Status: "Shipped", Total: 149, PlacedAt: "2026-06-02" },
  { CustomerName: "Lena Fischer", Email: "lena@example.com", Address: "5 Hafenstr", City: "Austin", Zip: "73302", Status: "Placed", Total: 79, PlacedAt: "2026-06-09" },
  { CustomerName: "Sam Okoye", Email: "sam@example.com", Address: "88 Marina Blvd", City: "Seattle", Zip: "98101", Status: "Delivered", Total: 588, PlacedAt: "2026-06-11" },
  { CustomerName: "Aisha Khan", Email: "aisha@example.com", Address: "3 Rose Ct", City: "Denver", Zip: "80202", Status: "Cancelled", Total: 59, PlacedAt: "2026-06-12" },
  { CustomerName: "Diego Marín", Email: "diego@example.com", Address: "21 Sol St", City: "Seattle", Zip: "98109", Status: "Shipped", Total: 273, PlacedAt: "2026-06-14" },
];

const CONTACTS: Rec[] = [
  { Name: "Priya Nair", Email: "priya@acme.io", Phone: "555-0142", Company: "Acme", Title: "VP Eng", Status: "Active" },
  { Name: "Marcus Reid", Email: "marcus@globex.com", Phone: "555-0198", Company: "Globex", Title: "Buyer", Status: "Lead" },
  { Name: "Lena Fischer", Email: "lena@initech.de", Phone: "555-0110", Company: "Initech", Title: "CTO", Status: "Active" },
  { Name: "Sam Okoye", Email: "sam@umbrella.co", Phone: "555-0173", Company: "Umbrella", Title: "Ops", Status: "Inactive" },
];

const DEALS: Rec[] = [
  { Name: "Acme platform rollout", ContactName: "Priya Nair", Company: "Acme", Value: 48000, Stage: "Proposal", CloseDate: "2026-07-15", Owner: "Dana Lee" },
  { Name: "Globex pilot", ContactName: "Marcus Reid", Company: "Globex", Value: 12000, Stage: "Qualified", CloseDate: "2026-06-30", Owner: "Dana Lee" },
  { Name: "Initech renewal", ContactName: "Lena Fischer", Company: "Initech", Value: 96000, Stage: "Won", CloseDate: "2026-06-01", Owner: "Theo Park" },
  { Name: "Umbrella expansion", ContactName: "Sam Okoye", Company: "Umbrella", Value: 30000, Stage: "Lost", CloseDate: "2026-05-20", Owner: "Theo Park" },
];

const TICKETS: Rec[] = [
  { Subject: "Login redirect loop", Description: "Users bounce on SSO", Status: "Open", Priority: "Urgent", Requester: "priya@acme.io", Assignee: "Theo Park", Category: "Auth", CreatedAt: "2026-06-14" },
  { Subject: "Export to CSV fails", Description: "500 on large sets", Status: "In Progress", Priority: "High", Requester: "marcus@globex.com", Assignee: "Dana Lee", Category: "Reports", CreatedAt: "2026-06-13" },
  { Subject: "Dark mode toggle", Description: "Feature request", Status: "Waiting", Priority: "Low", Requester: "lena@initech.de", Assignee: "Theo Park", Category: "UI", CreatedAt: "2026-06-10" },
  { Subject: "Billing webhook retries", Description: "Duplicate charges", Status: "Resolved", Priority: "Medium", Requester: "sam@umbrella.co", Assignee: "Dana Lee", Category: "Billing", CreatedAt: "2026-06-05" },
];

const REPLIES: Rec[] = [
  { TicketId: "Ticket-0", Author: "Theo Park", Body: "Looking into the SSO config now.", CreatedAt: "2026-06-14", Internal: false },
  { TicketId: "Ticket-0", Author: "Theo Park", Body: "Root cause: stale redirect URI.", CreatedAt: "2026-06-15", Internal: true },
  { TicketId: "Ticket-1", Author: "Dana Lee", Body: "Reproduced with 50k rows.", CreatedAt: "2026-06-13", Internal: false },
];

const POSTS: Rec[] = [
  { Title: "Shipping faster with fragments", Slug: "shipping-faster", Excerpt: "How prebuilt blocks cut build time.", Body: "…", AuthorName: "Priya Nair", Category: "Engineering", Status: "Published", CoverUrl: "https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=320", PublishedAt: "2026-06-01" },
  { Title: "Designing for dark mode", Slug: "dark-mode", Excerpt: "Token-driven theming notes.", Body: "…", AuthorName: "Lena Fischer", Category: "Design", Status: "Draft", CoverUrl: "https://images.unsplash.com/photo-1545239351-ef35f43d514b?w=320", PublishedAt: "2026-06-10" },
  { Title: "A field guide to datasources", Slug: "datasources", Excerpt: "READ vs WRITE, refresh, hooks.", Body: "…", AuthorName: "Sam Okoye", Category: "Engineering", Status: "Archived", CoverUrl: "https://images.unsplash.com/photo-1516116216624-53e697fedbea?w=320", PublishedAt: "2026-05-12" },
];

const AUTHORS: Rec[] = [
  { Name: "Priya Nair", Bio: "Platform engineer and writer.", AvatarUrl: "https://i.pravatar.cc/80?img=5", Email: "priya@blog.dev" },
  { Name: "Lena Fischer", Bio: "Design systems lead.", AvatarUrl: "https://i.pravatar.cc/80?img=9", Email: "lena@blog.dev" },
];

const CATEGORIES: Rec[] = [
  { Name: "Engineering", Description: "Build notes and deep dives" },
  { Name: "Design", Description: "Craft, polish, and theming" },
  { Name: "Product", Description: "Roadmap and releases" },
];

const TASKS: Rec[] = [
  { Title: "Fix login redirect loop", ProjectName: "Auth", Assignee: "Priya Nair", Status: "Todo", Priority: "High", Estimate: 5, DueDate: "2026-06-20" },
  { Title: "Write onboarding docs", ProjectName: "Docs", Assignee: "Marcus Reid", Status: "In Progress", Priority: "Medium", Estimate: 3, DueDate: "2026-06-22" },
  { Title: "Ship dark mode toggle", ProjectName: "UI", Assignee: "Lena Fischer", Status: "Review", Priority: "Low", Estimate: 2, DueDate: "2026-06-18" },
  { Title: "Migrate to Next 16", ProjectName: "Platform", Assignee: "Sam Okoye", Status: "Done", Priority: "High", Estimate: 8, DueDate: "2026-06-15" },
];

/** Passed to every block; the mock executor only reads the entities the block queries. */
const SEED: Record<string, Rec[]> = {
  Product: PRODUCTS,
  Order: ORDERS,
  Contact: CONTACTS,
  Deal: DEALS,
  Ticket: TICKETS,
  Reply: REPLIES,
  Post: POSTS,
  Author: AUTHORS,
  Category: CATEGORIES,
  Task: TASKS,
};

/**
 * Bundles surfaced in the blocks showcase. We're reviewing bundles one at a
 * time, so the gallery is intentionally scoped — add a bundle name here to
 * bring it in. This is showcase-only: the full fragmentRegistry (what the
 * app-builder agent consumes) is unaffected.
 */
const SHOWCASE_BUNDLES = new Set<string>(["ecommerce"]);

const showcaseBundles = fragmentBundles.filter((b) => SHOWCASE_BUNDLES.has(b.name));

export function buildBlockEntries(): BlockEntry[] {
  return showcaseBundles.flatMap((bundle) =>
    Object.values(bundle.fragments).map((raw) => {
      const f = raw as Fragment<unknown>;
      return {
        id: f.id,
        name: f.name,
        tier: bundle.tier,
        bundle: bundle.name,
        section: f.section ?? "other",
        category: f.category,
        description: f.description,
        paramsSchema: f.params,
        // Drive the preview off the fragment's own previewParams.
        demo: f.previewParams ? { params: f.previewParams, seed: SEED } : null,
      };
    }),
  );
}

/** Tier display order, derived from the bundles currently in the showcase. */
export const TIER_ORDER: BlockTier[] = [...new Set(showcaseBundles.map((b) => b.tier))];

/**
 * Section display order + labels for the drilldown (Tier → Bundle → Section →
 * Block). Sections not listed here sort last (alphabetically) under their raw id.
 */
export const SECTION_ORDER: string[] = [
  "discovery",
  "browse",
  "product-detail",
  "reviews",
  "cart",
  "checkout",
  "account",
  "promotion",
  "admin",
];
export const SECTION_LABEL: Record<string, string> = {
  discovery: "Store chrome & discovery",
  browse: "Browse / Category",
  "product-detail": "Product detail",
  reviews: "Reviews",
  cart: "Cart",
  checkout: "Checkout",
  account: "Account & orders",
  promotion: "Promotion",
  admin: "Admin / analytics",
  other: "Other",
};
