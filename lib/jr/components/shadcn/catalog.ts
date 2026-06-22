import { z } from "zod"

// =============================================================================
// shadcn/ui Component Definitions
// =============================================================================

/**
 * shadcn/ui component definitions for json-render catalogs.
 *
 * These can be used directly or extended with custom components.
 * All components are built using Radix UI primitives + Tailwind CSS.
 */
export const shadcnComponentDefinitions = {
	// ==========================================================================
	// Layout Components
	// ==========================================================================

	Card: {
		props: z.object({
			title: z.string().nullable(),
			description: z.string().nullable(),
			maxWidth: z.enum(["sm", "md", "lg", "full"]).nullable(),
			centered: z.boolean().nullable(),
			className: z.string().nullable().describe("Additional CSS classes"),
			clickable: z
				.boolean()
				.nullable()
				.describe("When true the card emits a press event on click (wire on.press) — e.g. a list card that opens a detail page.")
		}),
		slots: ["default"],
		events: ["press"],
		description: "Container card for content sections. Use for forms/content boxes, NOT for page headers.",
		example: { title: "Overview", description: "Your account summary" }
	},

	Separator: {
		props: z.object({
			orientation: z.enum(["horizontal", "vertical"]).nullable()
		}),
		description: "Visual separator line"
	},

	Tabs: {
		props: z.object({
			tabs: z.array(
				z.object({
					label: z.string(),
					value: z.string()
				})
			),
			defaultValue: z.string().nullable(),
			value: z.string().nullable()
		}),
		slots: ["default"],
		events: ["change"],
		description: "Tab navigation. Use { $bindState } on value for active tab binding."
	},

	Accordion: {
		props: z.object({
			items: z.array(
				z.object({
					title: z.string(),
					content: z.string()
				})
			),
			type: z.enum(["single", "multiple"]).nullable()
		}),
		description: "Collapsible sections. Items as [{title, content}]. Type 'single' (default) or 'multiple'."
	},

	Collapsible: {
		props: z.object({
			title: z.string(),
			defaultOpen: z.boolean().nullable()
		}),
		slots: ["default"],
		description: "Collapsible section with trigger. Children render inside."
	},

	Dialog: {
		props: z.object({
			title: z.string(),
			description: z.string().nullable(),
			openPath: z.string()
		}),
		slots: ["default"],
		description: "Modal dialog. Set openPath to a boolean state path. Use setState to toggle."
	},

	Drawer: {
		props: z.object({
			title: z.string(),
			description: z.string().nullable(),
			openPath: z.string()
		}),
		slots: ["default"],
		description: "Bottom sheet drawer. Set openPath to a boolean state path. Use setState to toggle."
	},

	Carousel: {
		props: z.object({
			items: z.array(
				z.object({
					title: z.string().nullable(),
					description: z.string().nullable(),
					image: z.string().nullable()
				})
			),
			aspectRatio: z
				.string()
				.nullable()
				.describe("Aspect ratio for image slides, e.g. '1/1' or '4/3'.")
		}),
		description:
			"Horizontally scrollable carousel with prev/next arrows. Each item renders as a card " +
			"(title/description) OR, when `image` (a URL) is set, a full-width image slide — use " +
			"`aspectRatio` for image slides (product galleries, banners)."
	},

	// ==========================================================================
	// Data Display Components
	// ==========================================================================

	Table: {
		props: z.object({
			columns: z.array(z.string()),
			rows: z.array(z.array(z.string())),
			caption: z.string().nullable()
		}),
		description:
			'Data table. columns: header labels. rows: 2D array of cell strings, e.g. [["Alice","admin"],["Bob","user"]].',
		example: {
			columns: ["Name", "Role"],
			rows: [
				["Alice", "Admin"],
				["Bob", "User"]
			]
		}
	},

	Avatar: {
		props: z.object({
			src: z.string().nullable(),
			name: z.string(),
			size: z.enum(["sm", "md", "lg"]).nullable()
		}),
		description: "User avatar with fallback initials",
		example: { name: "Jane Doe", size: "md" }
	},

	Badge: {
		props: z.object({
			text: z.string(),
			variant: z.enum(["default", "secondary", "destructive", "success", "soft", "outline"]).nullable()
		}),
		description:
			"A small inline pill for a short label, status, count, or tag. Variants carry " +
			"meaning by colour: `success` (soft green) for positive/up, `destructive` (solid " +
			"red) or `soft` (soft red) for negative/down, `secondary`/`outline` for neutral " +
			"emphasis, `default` for primary. `success` and `soft` are a matched soft-tinted " +
			"pair. Generic — use anywhere a compact labelled marker is needed.",
		example: { text: "Active", variant: "default" }
	},

	Alert: {
		props: z.object({
			title: z.string(),
			message: z.string().nullable(),
			type: z.enum(["info", "success", "warning", "error"]).nullable()
		}),
		description: "Alert banner",
		example: {
			title: "Note",
			message: "Your changes have been saved.",
			type: "success"
		}
	},

	Progress: {
		props: z.object({
			value: z.number(),
			max: z.number().nullable(),
			label: z.string().nullable()
		}),
		description: "Progress bar (value 0-100)",
		example: { value: 65, max: 100, label: "Upload progress" }
	},

	Skeleton: {
		props: z.object({
			width: z.string().nullable(),
			height: z.string().nullable(),
			rounded: z.boolean().nullable()
		}),
		description: "Loading placeholder skeleton"
	},

	Tooltip: {
		props: z.object({
			content: z.string(),
			text: z.string()
		}),
		description: "Hover tooltip. Shows content on hover over text."
	},

	Popover: {
		props: z.object({
			trigger: z.string(),
			content: z.string().nullable(),
			badge: z.string().nullable()
		}),
		slots: ["default"],
		description:
			"Popover on click of a trigger button. Pass CHILDREN for rich content (e.g. a filter facet: a CheckboxGroup or RangeSlider); `content` is a plain-text fallback used only when there are no children. `badge` shows a small count/indicator in the trigger (e.g. active filter count)."
	},

	// ==========================================================================
	// Form Input Components
	// ==========================================================================

	// These are PRIMITIVES, not form fields — bare controls for ad-hoc state
	// (search boxes, list filters, a standalone toggle). Bind `value`/`checked`
	// with { $bindState }. To create/update a BDO record, use Form +
	// Field (which own labels, validation, options and submit); never
	// hand-assemble a form from these. (Backward-compat: `label`/`checked`/etc.
	// remain accepted by the components so EXISTING specs keep rendering, but the
	// form-only `name`/`checks`/`validateOn` props are no longer advertised.)
	Input: {
		props: z.object({
			label: z.string().nullable(),
			type: z.enum(["text", "email", "password", "number"]).nullable(),
			placeholder: z.string().nullable(),
			value: z.string().nullable()
		}),
		events: ["submit", "focus", "blur"],
		description:
			"Text input primitive for ad-hoc state (search/filters). Bind `value` with { $bindState }. For record forms use Form/Field.",
		example: { type: "text", placeholder: "Search…" }
	},

	Textarea: {
		props: z.object({
			label: z.string().nullable(),
			placeholder: z.string().nullable(),
			rows: z.number().nullable(),
			value: z.string().nullable()
		}),
		description: "Multi-line text input primitive. Bind `value` with { $bindState }. For record forms use Form/Field."
	},

	Select: {
		props: z.object({
			label: z.string().nullable(),
			options: z.array(z.string()),
			placeholder: z.string().nullable(),
			value: z.string().nullable()
		}),
		events: ["change"],
		description: "Dropdown select primitive. Bind `value` with { $bindState }. For record forms use Form/Field."
	},

	Checkbox: {
		props: z.object({
			label: z.string().nullable(),
			checked: z.boolean().nullable()
		}),
		events: ["change"],
		description: "Checkbox primitive. Bind `checked` with { $bindState }. For record forms use Form/Field."
	},

	Radio: {
		props: z.object({
			label: z.string().nullable(),
			options: z.array(z.string()),
			value: z.string().nullable()
		}),
		events: ["change"],
		description: "Radio group primitive. Bind `value` with { $bindState }. For record forms use Form/Field."
	},

	Switch: {
		props: z.object({
			label: z.string().nullable(),
			checked: z.boolean().nullable()
		}),
		events: ["change"],
		description: "Toggle switch primitive. Bind `checked` with { $bindState }. For record forms use Form/Field."
	},

	Slider: {
		props: z.object({
			label: z.string().nullable(),
			min: z.number().nullable(),
			max: z.number().nullable(),
			step: z.number().nullable(),
			value: z.number().nullable()
		}),
		events: ["change"],
		description: "Range slider input. Use { $bindState } on value for binding."
	},

	// ==========================================================================
	// Action Components
	// ==========================================================================

	Button: {
		props: z.object({
			label: z.string(),
			variant: z.enum(["primary", "secondary", "danger"]).nullable(),
			disabled: z.boolean().nullable()
		}),
		events: ["press"],
		description: "Clickable button. Bind on.press for handler.",
		example: { label: "Submit", variant: "primary" }
	},

	DropdownMenu: {
		props: z.object({
			label: z.string(),
			items: z.array(
				z.object({
					label: z.string(),
					value: z.string()
				})
			),
			value: z.string().nullable()
		}),
		events: ["select"],
		description:
			"Dropdown menu with trigger button and selectable items. Use { $bindState } on value for selected item binding."
	},

	Toggle: {
		props: z.object({
			label: z.string(),
			pressed: z.boolean().nullable(),
			variant: z.enum(["default", "outline"]).nullable()
		}),
		events: ["change"],
		description: "Toggle button. Use { $bindState } on pressed for state binding."
	},

	ToggleGroup: {
		props: z.object({
			items: z.array(
				z.object({
					label: z.string(),
					value: z.string()
				})
			),
			type: z.enum(["single", "multiple"]).nullable(),
			value: z.string().nullable()
		}),
		events: ["change"],
		description: "Group of toggle buttons. Type 'single' (default) or 'multiple'. Use { $bindState } on value."
	},

	Pagination: {
		props: z.object({
			totalPages: z.number(),
			page: z.number().nullable()
		}),
		events: ["change"],
		description: "Page navigation. Use { $bindState } on page for current page number."
	}
}

// =============================================================================
// Types
// =============================================================================

/**
 * Type for a component definition
 */
export type ComponentDefinition = {
	props: z.ZodType
	slots?: string[]
	events?: string[]
	description: string
	example?: Record<string, unknown>
}

/**
 * Infer the props type for a shadcn component by name.
 * Derives the TypeScript type directly from the Zod schema,
 * so component implementations stay in sync with catalog definitions.
 *
 * @example
 * ```ts
 * type CardProps = ShadcnProps<"Card">;
 * // { title: string | null; description: string | null; ... }
 * ```
 */
export type ShadcnProps<K extends keyof typeof shadcnComponentDefinitions> = z.output<
	(typeof shadcnComponentDefinitions)[K]["props"]
>
