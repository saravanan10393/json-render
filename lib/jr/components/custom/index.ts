/**
 * "custom" — every component we own, as opposed to the out-of-box shadcn layer
 * in ../shadcn. Mirrors the shadcn folder's shape:
 *   - ./catalog.ts    → `customComponentDefinitions` (Zod catalog; registry-free)
 *   - ./components.ts → `customComponents` (runtime registry map)
 *
 * Both are built from the same three groups:
 *   1. primitives    — layout/typography helpers; components in
 *                      ./ui/primitives.tsx, Zod defs inline in ./catalog.ts.
 *   2. outlets        — PageOutlet + ModalOutlet; components in
 *                      ./ui/{PageOutlet,ModalOutlet}.tsx, defs inline in ./catalog.ts.
 *   3. ui components — one ./ui/<Name>.tsx each (def + component), aggregated
 *                      by ./ui/index.ts.
 * The components map additionally layers the Stack override (./ui/Stack.tsx)
 * over the primitive Stack; the catalog has no separate entry for it.
 *
 * Prefer importing ./catalog or ./components directly on the catalog/registry
 * paths (keeps the registry import-cycle contained). This barrel is for outside
 * convenience only.
 */
export { customComponents } from "./components"
export { customComponentDefinitions } from "./catalog"
