/**
 * The custom catalog — Zod definitions for every component we own, the mirror
 * of ../shadcn/catalog.ts for the out-of-box layer. Definitions are co-located
 * with their components under ./ui and aggregated into `uiComponentDefinitions`
 * by ./ui/index.ts.
 *
 * Definition-only module: it never imports a component file that reaches the
 * registry, so the kit catalog can import it without a cycle. The runtime
 * component map lives in ./components.ts.
 *
 * NOTE: the experiment's routing outlets (PageOutlet/ModalOutlet) were dropped
 * in the port — rapp's TanStack Router owns routing (see ../../CATALOG_MIGRATION.md).
 */
import { uiComponentDefinitions } from "./ui"

export const customComponentDefinitions = {
	...uiComponentDefinitions
}
