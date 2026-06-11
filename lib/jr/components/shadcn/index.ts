/**
 * Local shadcn layer — ejected from @json-render/shadcn (see scripts/eject-shadcn.ts).
 * The 28 components here are each backed by a real shadcn/ui primitive in ./ui
 * (29 files — `label.tsx` is a shared dependency of the Input/Field wrappers,
 * not its own catalog component; the `Label` component lives in ../custom).
 * Non-shadcn helpers that used to ship in the same package now live in
 * ../custom (see ../custom/ui/primitives.tsx).
 */

export {
	type ComponentDefinition,
	type ShadcnProps,
	shadcnComponentDefinitions
} from "./catalog"
export { shadcnComponents } from "./components"
