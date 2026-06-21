/**
 * Smoke test for the fragment expander: composes the canonical shop page from
 * $fragment refs, expands it, and runs the full page validators against the
 * standard entity contracts.  Run:  bun scripts/test-fragment-expansion.ts
 */
import { fragmentRegistry } from "../fragments";
import { expandFragments } from "../lib/server/fragment-expander";
import { validatePageSpec } from "../lib/server/spec-validators";
import type { EntityDefinition } from "../lib/server/entity-store";

const entities: EntityDefinition[] = [
  {
    name: "Product",
    label: "Products",
    fields: [
      { id: "Name", name: "Name", type: "text" },
      { id: "Description", name: "Description", type: "text" },
      { id: "Price", name: "Price", type: "number" },
      { id: "Category", name: "Category", type: "select", options: ["Audio", "Wearables"] },
      { id: "ImageUrl", name: "Image URL", type: "text" },
      { id: "Rating", name: "Rating", type: "number" },
      { id: "Stock", name: "Stock", type: "number" },
    ],
  },
  {
    name: "CartItem",
    label: "Cart items",
    fields: [
      { id: "ProductId", name: "Product id", type: "text" },
      { id: "Name", name: "Name", type: "text" },
      { id: "Price", name: "Price", type: "number" },
      { id: "Quantity", name: "Quantity", type: "number" },
      { id: "LineTotal", name: "Line total", type: "number" },
    ],
  },
  {
    name: "Order",
    label: "Orders",
    fields: [
      { id: "CustomerName", name: "Customer", type: "text" },
      { id: "Email", name: "Email", type: "text" },
      { id: "Address", name: "Address", type: "text" },
      { id: "City", name: "City", type: "text" },
      { id: "Zip", name: "Zip", type: "text" },
      { id: "Status", name: "Status", type: "select", options: ["Placed", "Shipped", "Delivered", "Cancelled"] },
      { id: "Total", name: "Total", type: "number" },
      { id: "PlacedAt", name: "Placed at", type: "date" },
    ],
  },
];

const shopPage = {
  root: "page",
  elements: {
    page: {
      type: "Stack",
      props: { direction: "vertical", gap: "lg", className: "p-8" },
      children: ["hero", "category-nav", "main"],
    },
    hero: {
      $fragment: "fragment-hero-banner",
      params: {
        title: "Gear up for summer",
        subtitle: "Up to 40% off headphones and wearables.",
        ctaLabel: "Shop deals",
        ctaTarget: "Shop",
      },
    },
    "category-nav": {
      $fragment: "fragment-category-nav",
      params: { targetGridNs: "products-grid", categories: ["Audio", "Wearables"] },
    },
    main: {
      type: "Stack",
      props: { direction: "horizontal", gap: "lg", align: "start" },
      children: ["filters-panel", "products-grid"],
    },
    "filters-panel": {
      $fragment: "fragment-product-filters",
      params: { targetGridNs: "products-grid", categories: ["Audio", "Wearables"] },
    },
    "products-grid": {
      $fragment: "fragment-product-grid",
      params: { columns: 3, cartRefresh: ["cart-panel-items", "cart-panel-total"] },
    },
    "cart-panel": {
      $fragment: "fragment-cart-summary",
      params: { checkoutTarget: "Checkout" },
    },
  },
};

const { spec, issues, expanded } = expandFragments(
  shopPage as unknown as Record<string, unknown>,
  fragmentRegistry,
);

console.log("expanded:", expanded);
if (issues.length > 0) {
  console.error("EXPANSION ISSUES:");
  for (const issue of issues) console.error("  -", issue);
  process.exit(1);
}

const elementCount = Object.keys((spec.elements as object) ?? {}).length;
const dsCount = Object.keys((spec.datasources as object) ?? {}).length;
console.log(`elements: ${elementCount}, datasources: ${dsCount}, init steps: ${(spec.init as unknown[])?.length}`);
console.log("boundaries:", Object.keys((spec._boundaries as object) ?? {}));

// cart-panel must be reachable from the tree for the children-ref validator.
(spec.elements as Record<string, { children?: string[] }>).page.children = [
  "hero",
  "category-nav",
  "main",
  "cart-panel",
];

const validationIssues = validatePageSpec({
  spec,
  validPageNames: ["Shop", "Cart", "Checkout", "Orders"],
  entities,
});
if (validationIssues.length > 0) {
  console.error("VALIDATION ISSUES:");
  for (const issue of validationIssues) console.error("  -", issue);
  process.exit(1);
}
console.log("validation: clean ✓");
