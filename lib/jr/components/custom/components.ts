/**
 * Runtime component map for everything we own ("custom"). Spread into
 * defineRegistry by the kit registry after the shadcn components, so these win
 * on name collisions. Spread order:
 *
 *   ui (primitives + ./ui/<Name>.tsx) → Stack override
 *
 * - `uiComponents` already includes the layout/typography primitives (folded in
 *   by ./ui/index.ts), so we spread it first.
 * - `Stack` (./ui/Stack.tsx) shadows the primitive Stack and MUST come after
 *   `...uiComponents`: the primitive defaults `align` to "start", collapsing
 *   vertical layouts to content width; the override restores the CSS-correct
 *   "stretch".
 *
 * NOTE: the experiment's routing outlets (PageOutlet/ModalOutlet) were dropped
 * in the port — rapp's TanStack Router owns routing (see ../../CATALOG_MIGRATION.md).
 */
import { uiComponents } from "./ui"
import { Stack } from "./ui/Stack"

export const customComponents = {
	...uiComponents,
	Stack
}
