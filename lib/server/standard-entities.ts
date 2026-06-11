import type { EntityDefinition } from "./entity-store";

/**
 * The standard e-commerce entity contracts fragments are written against
 * (field ids are FIXED — see fragments/ecommerce/index.ts). Used by the
 * fragment test harness, the draft evaluator, and the studio sandbox seeder.
 */
export const STANDARD_ENTITIES: EntityDefinition[] = [
  {
    name: "Product",
    label: "Products",
    fields: [
      { id: "Name", name: "Name", type: "text" },
      { id: "Description", name: "Description", type: "text" },
      { id: "Price", name: "Price", type: "number" },
      { id: "Category", name: "Category", type: "select", options: ["Audio", "Wearables", "Accessories"] },
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

/** Demo records for the studio sandbox so previews render with real data. */
export const STANDARD_SEEDS: Record<string, Array<Record<string, unknown>>> = {
  Product: [
    { Name: "Nimbus Headphones", Description: "Over-ear noise cancelling headphones", Price: 199, Category: "Audio", ImageUrl: "https://picsum.photos/seed/nimbus/400/300", Rating: 4.5, Stock: 12 },
    { Name: "Pulse Earbuds", Description: "True wireless earbuds with long battery", Price: 89, Category: "Audio", ImageUrl: "https://picsum.photos/seed/pulse/400/300", Rating: 4.1, Stock: 30 },
    { Name: "Tempo Watch", Description: "Fitness watch with GPS and heart-rate", Price: 249, Category: "Wearables", ImageUrl: "https://picsum.photos/seed/tempo/400/300", Rating: 4.7, Stock: 8 },
    { Name: "Strap Band", Description: "Replacement silicone watch band", Price: 19, Category: "Accessories", ImageUrl: "https://picsum.photos/seed/strap/400/300", Rating: 3.9, Stock: 50 },
    { Name: "Aero Speaker", Description: "Portable bluetooth speaker, 20h playtime", Price: 129, Category: "Audio", ImageUrl: "https://picsum.photos/seed/aero/400/300", Rating: 4.3, Stock: 17 },
    { Name: "Lumen Ring", Description: "Sleep + recovery tracking smart ring", Price: 299, Category: "Wearables", ImageUrl: "https://picsum.photos/seed/lumen/400/300", Rating: 4.0, Stock: 6 },
  ],
  CartItem: [
    { ProductId: "demo-1", Name: "Nimbus Headphones", Price: 199, Quantity: 1, LineTotal: 199 },
    { ProductId: "demo-2", Name: "Strap Band", Price: 19, Quantity: 1, LineTotal: 19 },
  ],
  Order: [
    { CustomerName: "Maya Lin", Email: "maya@example.com", Address: "12 Cedar Way", City: "Austin", Zip: "73301", Status: "Delivered", Total: 218, PlacedAt: "2026-05-28" },
    { CustomerName: "Tom Hale", Email: "tom@example.com", Address: "8 Birch Road", City: "Denver", Zip: "80014", Status: "Shipped", Total: 129, PlacedAt: "2026-06-02" },
    { CustomerName: "Ana Cruz", Email: "ana@example.com", Address: "3 Palm Court", City: "Miami", Zip: "33101", Status: "Placed", Total: 299, PlacedAt: "2026-06-08" },
  ],
};
