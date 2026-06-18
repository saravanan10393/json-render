/**
 * ProductManagement — the admin catalog table: searchable product list with a
 * thumbnail, price, stock (+ out-of-stock flag), and per-row Edit / Delete, plus
 * an "Add product" button. Edit/Add open a Sheet form bound to /ui/<ns>/draft;
 * Save is one bdo.save (create when draft._id is empty, update otherwise).
 *
 * Patterns (per build-fragment skill): repeat-scope capture via `$template`
 * (Edit copies the row into the draft; Delete captures _id), scope-correct
 * actions, per-row `visible:{$item}` for the out-of-stock badge, one shared
 * save/delete datasource that refreshes the list.
 *
 * Requires Product fields: Name, Description, Price, Category, ImageUrl, Stock.
 */
import { z } from "zod";
import type { Fragment } from "@/lib/jr/schema";

const Params = z.object({
  productBdo: z.string().default("Product").describe("Product entity name."),
  currency: z.string().nullable().default(null).describe("ISO 4217 code (default USD)."),
  pageSize: z.number().int().min(1).max(100).default(20),
  title: z.string().default("Products"),
});

type P = z.infer<typeof Params>;

const FIELDS = ["Name", "Category", "Price", "Stock", "ImageUrl", "Description"] as const;

export const ProductManagement: Fragment<P> = {
  id: "fragment-product-management",
  section: "admin",
  name: "Product Management",
  version: "1.0.0",
  description:
    "Admin catalog manager (bdo.list/save/delete Product): searchable product table with thumbnail, price, stock + out-of-stock flag, per-row Edit/Delete, and Add product — Edit/Add open a Sheet form. Operator-facing CRUD. Requires Product fields Name, Description, Price, Category, ImageUrl, Stock.",
  whenToUse:
    "Use on an admin/operations page to manage the product catalog — search, add, edit, and delete products. For the customer-facing grid use Product Grid.",
  category: "display",
  previewParams: {},
  params: Params as z.ZodType<P>,
  build: ({ productBdo, currency, pageSize, title }, ns) => {
    const ui = `/ui/${ns}`;
    const filters = `/filters/${ns}`;
    const draft = `${ui}/draft`;
    const list = `${ns}-products`;
    const save = `${ns}-save`;
    const del = `${ns}-delete`;

    const editAction = [
      {
        action: "setState",
        params: {
          statePath: draft,
          value: Object.fromEntries([
            ["_id", { $template: "${_id}" }],
            ...FIELDS.map((f) => [f, { $template: `\${${f}}` }]),
          ]),
        },
      },
      { action: "setState", params: { statePath: `${ui}/formOpen`, value: true } },
    ];
    const blankDraft = Object.fromEntries([["_id", ""], ...FIELDS.map((f) => [f, ""])]);

    const field = (f: string, label: string, type: string) => ({
      [`${ns}-f-${f}`]: { type: "Input", props: { label, type, placeholder: null, value: { $bindState: `${draft}/${f}` } } },
    });

    const elements: Record<string, Record<string, unknown>> = {
      [ns]: {
        type: "Stack",
        props: { direction: "vertical", gap: "md", className: "w-full" },
        children: [`${ns}-toolbar`, `${ns}-count`, `${ns}-table`, `${ns}-empty`, `${ns}-form`],
      },
      [`${ns}-toolbar`]: {
        type: "Stack",
        props: { direction: "horizontal", justify: "between", align: "center", className: "flex-wrap gap-2" },
        children: [`${ns}-title`, `${ns}-toolbar-actions`],
      },
      [`${ns}-title`]: { type: "Heading", props: { text: title, level: "h2", className: null } },
      [`${ns}-toolbar-actions`]: {
        type: "Stack",
        props: { direction: "horizontal", gap: "sm", align: "center" },
        children: [`${ns}-search`, `${ns}-add`],
      },
      [`${ns}-search`]: { type: "Input", props: { label: null, type: "text", placeholder: "Search products…", value: { $bindState: `${filters}/search` } } },
      [`${ns}-add`]: {
        type: "Button",
        props: { label: "Add product", variant: "primary", disabled: null },
        on: {
          press: [
            { action: "setState", params: { statePath: draft, value: blankDraft } },
            { action: "setState", params: { statePath: `${ui}/formOpen`, value: true } },
          ],
        },
      },
      [`${ns}-count`]: { type: "Text", props: { text: { $template: `\${/queries/${list}/page/total} products` }, variant: "muted", className: null } },
      [`${ns}-table`]: {
        type: "Stack",
        props: { direction: "vertical", gap: "none", className: "overflow-hidden rounded-xl border border-border" },
        repeat: { statePath: `/queries/${list}/data`, key: "_id" },
        children: [`${ns}-row`],
      },
      [`${ns}-row`]: {
        type: "Stack",
        props: { direction: "horizontal", align: "center", gap: "md", className: "border-b border-border px-4 py-3 last:border-b-0" },
        children: [`${ns}-row-img`, `${ns}-row-info`, `${ns}-row-stock`, `${ns}-row-price`, `${ns}-row-actions`],
      },
      [`${ns}-row-img`]: { type: "Image", props: { src: { $item: "ImageUrl" }, alt: { $item: "Name" }, aspectRatio: "1/1", fit: "cover", width: null, height: null, className: "size-12 shrink-0 rounded-md" } },
      [`${ns}-row-info`]: { type: "Stack", props: { direction: "vertical", gap: "none", className: "min-w-0 flex-1" }, children: [`${ns}-row-name`, `${ns}-row-cat`] },
      [`${ns}-row-name`]: { type: "Text", props: { text: { $item: "Name" }, variant: "body", className: "font-medium" } },
      [`${ns}-row-cat`]: { type: "Text", props: { text: { $item: "Category" }, variant: "caption", className: "uppercase tracking-wide text-muted-foreground" } },
      // Stock column: count + an out-of-stock badge (per-row visible on $item).
      [`${ns}-row-stock`]: { type: "Stack", props: { direction: "horizontal", gap: "sm", align: "center", className: "w-28 shrink-0" }, children: [`${ns}-row-stock-n`, `${ns}-row-stock-oos`] },
      [`${ns}-row-stock-n`]: { type: "Text", props: { text: { $template: `\${Stock} in stock` }, variant: "caption", className: "text-muted-foreground" } },
      [`${ns}-row-stock-oos`]: { type: "Badge", props: { text: "Out", variant: "destructive" }, visible: { $item: "Stock", eq: 0 } },
      [`${ns}-row-price`]: { type: "Money", props: { value: { $item: "Price" }, style: "currency", currency, locale: null, maximumFractionDigits: null, suffix: null, compareAt: null, showDiscount: null, size: "sm", className: "w-24 shrink-0 justify-end font-medium" } },
      [`${ns}-row-actions`]: {
        type: "Stack",
        props: { direction: "horizontal", gap: "sm", align: "center", justify: "end", className: "w-44 shrink-0" },
        children: [`${ns}-row-edit`, `${ns}-row-delete`],
      },
      [`${ns}-row-edit`]: { type: "Button", props: { label: "Edit", variant: "secondary", disabled: null }, on: { press: editAction } },
      [`${ns}-row-delete`]: {
        type: "Button",
        props: { label: "Delete", variant: "ghost", disabled: null },
        on: {
          press: [
            { action: "setState", params: { statePath: `${ui}/pendingDelete`, value: { $template: "${_id}" } } },
            { action: "datasource.fire", params: { name: del } },
          ],
        },
      },
      [`${ns}-empty`]: { type: "Empty", props: { title: "No products", description: "Add your first product to get started." }, visible: { $state: `/queries/${list}/page/total`, eq: 0 } },
      // Edit / Add form (Sheet bound to the draft).
      [`${ns}-form`]: {
        type: "Sheet",
        props: { title: "Product", description: null, side: "right", openPath: `${ui}/formOpen` },
        children: [`${ns}-form-body`],
      },
      [`${ns}-form-body`]: {
        type: "Stack",
        props: { direction: "vertical", gap: "md" },
        children: [`${ns}-f-Name`, `${ns}-f-Category`, `${ns}-f-grid`, `${ns}-f-ImageUrl`, `${ns}-f-Description`, `${ns}-form-save`],
      },
      ...field("Name", "Name", "text"),
      ...field("Category", "Category", "text"),
      [`${ns}-f-grid`]: { type: "Grid", props: { columns: 2, gap: "md" }, children: [`${ns}-f-Price`, `${ns}-f-Stock`] },
      ...field("Price", "Price", "number"),
      ...field("Stock", "Stock", "number"),
      ...field("ImageUrl", "Image URL", "text"),
      ...field("Description", "Description", "text"),
      [`${ns}-form-save`]: {
        type: "Button",
        props: { label: "Save product", variant: "primary", disabled: null },
        on: { press: [{ action: "datasource.fire", params: { name: save } }] },
      },
    };

    return {
      root: ns,
      elements: elements as unknown as ReturnType<Fragment<P>["build"]>["elements"],
      state: { filters: { [ns]: { search: "" } }, ui: { [ns]: { formOpen: false, draft: null, pendingDelete: null } } },
      datasources: {
        [list]: {
          type: "bdo.list",
          params: { bdo: productBdo, Search: { $state: `${filters}/search` }, Sort: [{ Name: "ASC" }], Page: { number: 1, size: pageSize } },
          debounceMs: 300,
        },
        [save]: {
          type: "bdo.save",
          params: {
            bdo: productBdo,
            _id: { $state: `${draft}/_id` },
            values: Object.fromEntries(FIELDS.map((f) => [f, { $state: `${draft}/${f}` }])),
          },
          refresh: [list],
          on: { success: [{ action: "ui.toast", params: { message: "Product saved", kind: "success" } }, { action: "setState", params: { statePath: `${ui}/formOpen`, value: false } }] },
        },
        [del]: {
          type: "bdo.delete",
          params: { bdo: productBdo, _id: { $state: `${ui}/pendingDelete` } },
          refresh: [list],
          on: { success: [{ action: "ui.toast", params: { message: "Product deleted", kind: "success" } }] },
        },
      },
      init: [{ action: "datasource.refresh", params: { names: [list] } }],
    };
  },
};
