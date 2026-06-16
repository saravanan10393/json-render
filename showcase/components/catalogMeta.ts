/**
 * Showcase metadata — the bridge between the live catalog and the /showcase page.
 *
 * For every component in the catalog we derive a **source** (two buckets) and
 * assign a **category** (the standard UI taxonomy, the page's primary
 * organizing axis). Source is **capability-based**, not folder-based: a
 * component is `shadcn` whenever the official shadcn/ui catalog ships it —
 * regardless of which of our folders holds the json-render wrapper. Only
 * components with no shadcn equivalent are `ours`. Each entry also carries a
 * **demo** that ComponentPreview turns into a live render:
 *   - `props`  — render a single element with these props (falls back to the
 *                catalog `example` when omitted),
 *   - `spec`   — a full hand-authored spec + seed `state` (for containers,
 *                overlays, and anything that needs children or state),
 *   - `note`   — no live preview is meaningful (needs router/host context).
 */
import type { Spec } from "@json-render/react"
import { customComponentDefinitions } from "@/lib/jr/components/custom/catalog"
import { shadcnComponentDefinitions } from "@/lib/jr/components/shadcn/catalog"

export type Source = "shadcn" | "ours"

export type Category =
	| "Primitives"
	| "Layout"
	| "Forms & Inputs"
	| "Data Display"
	| "Navigation"
	| "Overlays & Disclosure"
	| "Feedback"
	| "System / Outlets"

/** Order the categories render in on the page. */
export const CATEGORY_ORDER: Category[] = [
	"Primitives",
	"Layout",
	"Forms & Inputs",
	"Data Display",
	"Navigation",
	"Overlays & Disclosure",
	"Feedback",
	"System / Outlets"
]

export interface CatalogDefinition {
	props?: unknown
	slots?: readonly string[]
	events?: readonly string[]
	description?: string
	example?: Record<string, unknown>
}

type Demo = { props?: Record<string, unknown> } | { spec: Spec; state?: Record<string, unknown> } | { note: string }

export interface ShowcaseEntry {
	name: string
	source: Source
	category: Category
	description: string
	events: readonly string[]
	/** The example/demo props or spec, shown as collapsible JSON on the card. */
	example?: Record<string, unknown>
	/** The component's Zod props schema (for the Schema tab). */
	propsSchema?: unknown
	demo: Demo
}

// ---------------------------------------------------------------------------
// Merge the catalog definitions exactly like genui/catalog.ts does (our
// overrides win for shared names like Button / Input / Heading / Text).
// ---------------------------------------------------------------------------
const definitions: Record<string, CatalogDefinition> = {
	...(shadcnComponentDefinitions as Record<string, CatalogDefinition>),
	...(customComponentDefinitions as Record<string, CatalogDefinition>)
}

/**
 * `shadcn` = every component the official shadcn/ui catalog ships, mapped to
 * our component names. This is capability-based: a component counts as shadcn
 * even when we authored the json-render wrapper ourselves (Combobox, Sidebar,
 * Chart, …) or override it (Button, Input) — what matters is that shadcn
 * offers it. Anything NOT in this set is `ours`: json-render's layout/
 * typography helpers (Stack, Grid, Heading, Text, Image, Link), our RAPP
 * File-field editor (FileUrls), and the routing outlets (PageOutlet,
 * ModalOutlet). Keep this list in sync with https://ui.shadcn.com/docs/components.
 */
const SHADCN = new Set<string>([
	"Accordion",
	"Alert",
	"AlertDialog",
	"AspectRatio",
	"Avatar",
	"Badge",
	"Breadcrumb",
	"Button",
	"ButtonGroup",
	"Calendar",
	"Card",
	"Carousel",
	"Chart",
	"Checkbox",
	"Collapsible",
	"Combobox",
	"Command",
	"ContextMenu",
	"DataTable",
	"DatePicker",
	"Dialog",
	"Drawer",
	"DropdownMenu",
	"Empty",
	"Field",
	"Form",
	"HoverCard",
	"Input",
	"InputGroup",
	"InputOTP",
	"Item",
	"Kbd",
	"Label",
	"Menubar",
	"NavigationMenu",
	"Pagination",
	"Popover",
	"Progress",
	"Radio",
	"Resizable",
	"ScrollArea",
	"Select",
	"Separator",
	"Sheet",
	"Sidebar",
	"Skeleton",
	"Slider",
	"Spinner",
	"Switch",
	"Table",
	"Tabs",
	"Textarea",
	"Toaster",
	"Toggle",
	"ToggleGroup",
	"Tooltip"
])

const CATEGORY: Record<string, Category> = {
	// Primitives
	Button: "Primitives",
	Input: "Primitives",
	Textarea: "Primitives",
	Label: "Primitives",
	Badge: "Primitives",
	Text: "Primitives",
	Heading: "Primitives",
	Avatar: "Primitives",
	AvatarGroup: "Primitives",
	Spinner: "Primitives",
	Switch: "Primitives",
	Checkbox: "Primitives",
	Radio: "Primitives",
	Slider: "Primitives",
	Link: "Primitives",
	Kbd: "Primitives",
	Image: "Primitives",
	Toggle: "Primitives",
	Progress: "Primitives",
	Skeleton: "Primitives",
	Separator: "Primitives",
	// Layout
	Stack: "Layout",
	Grid: "Layout",
	Card: "Layout",
	ScrollArea: "Layout",
	Resizable: "Layout",
	AspectRatio: "Layout",
	// Forms & Inputs
	Field: "Forms & Inputs",
	Form: "Forms & Inputs",
	Select: "Forms & Inputs",
	Combobox: "Forms & Inputs",
	InputGroup: "Forms & Inputs",
	InputOTP: "Forms & Inputs",
	DatePicker: "Forms & Inputs",
	Calendar: "Forms & Inputs",
	FileUrls: "Forms & Inputs",
	ToggleGroup: "Forms & Inputs",
	ButtonGroup: "Forms & Inputs",
	// Data Display
	DataTable: "Data Display",
	Table: "Data Display",
	Chart: "Data Display",
	Item: "Data Display",
	Empty: "Data Display",
	Pagination: "Data Display",
	// Navigation
	Tabs: "Navigation",
	Breadcrumb: "Navigation",
	Sidebar: "Navigation",
	NavigationMenu: "Navigation",
	Menubar: "Navigation",
	// Overlays & Disclosure
	Dialog: "Overlays & Disclosure",
	Drawer: "Overlays & Disclosure",
	Sheet: "Overlays & Disclosure",
	Popover: "Overlays & Disclosure",
	Tooltip: "Overlays & Disclosure",
	HoverCard: "Overlays & Disclosure",
	AlertDialog: "Overlays & Disclosure",
	Accordion: "Overlays & Disclosure",
	Collapsible: "Overlays & Disclosure",
	DropdownMenu: "Overlays & Disclosure",
	ContextMenu: "Overlays & Disclosure",
	Command: "Overlays & Disclosure",
	Carousel: "Overlays & Disclosure",
	// Data Display (composites we own)
	Stat: "Data Display",
	DescriptionList: "Data Display",
	Timeline: "Data Display",
	// Navigation
	Stepper: "Navigation",
	// Forms & Inputs
	MultiSelect: "Forms & Inputs",
	Rating: "Forms & Inputs",
	InputMask: "Forms & Inputs",
	Counter: "Forms & Inputs",
	// Feedback
	Alert: "Feedback",
	Toaster: "Feedback",
	// System / Outlets
	PageOutlet: "System / Outlets",
	ModalOutlet: "System / Outlets",
	// Long-tail primitives (ours)
	Icon: "Primitives",
	CopyButton: "Primitives",
	CheckboxGroup: "Forms & Inputs",
	TagInput: "Forms & Inputs",
	TimePicker: "Forms & Inputs",
	DateRangePicker: "Forms & Inputs",
	RangeSlider: "Forms & Inputs",
	ColorPicker: "Forms & Inputs",
	StatusDot: "Feedback",
	ProgressCircle: "Feedback",
	Tree: "Data Display"
}

// ---------------------------------------------------------------------------
// Demo builders. Specs use the json-render shape: { root, elements, state? }.
// ---------------------------------------------------------------------------
const text = (id: string, value: string, variant?: string) => ({
	[id]: { type: "Text", props: variant ? { text: value, variant } : { text: value }, children: [] }
})

/** A trigger Button + an overlay gated on `openPath`; seeds the path to false. */
const overlayDemo = (
	overlayType: string,
	openPath: string,
	overlayProps: Record<string, unknown>,
	bodyText = "This is the overlay body. Anything can go in here."
): { spec: Spec; state: Record<string, unknown> } => ({
	spec: {
		root: "root",
		elements: {
			root: {
				type: "Stack",
				props: { direction: "vertical", gap: "md" },
				children: ["trigger", "overlay"]
			},
			trigger: {
				type: "Button",
				props: { label: `Open ${overlayType}`, variant: "primary" },
				on: { press: { action: "setState", params: { statePath: openPath, value: true } } },
				children: []
			},
			overlay: {
				type: overlayType,
				props: { ...overlayProps, openPath },
				children: ["overlayBody"]
			},
			overlayBody: { type: "Text", props: { text: bodyText }, children: [] }
		}
	} as unknown as Spec,
	state: { [openPath.replace(/^\//, "")]: false }
})

/** A single bound input: wires `bindProp` to `path` via $bindState and seeds the
 *  state, so the preview is actually interactive (clicks write to state and the
 *  live readout reflects it). `path` is "/key"; the seeded key is its tail. */
const bound = (
	type: string,
	bindProp: string,
	path: string,
	initial: unknown,
	props: Record<string, unknown> = {}
): { spec: Spec; state: Record<string, unknown> } => ({
	spec: {
		root: "el",
		elements: { el: { type, props: { ...props, [bindProp]: { $bindState: path } }, children: [] } }
	} as unknown as Spec,
	state: { [path.replace(/^\//, "")]: initial }
})

const DEMOS: Record<string, Demo> = {
	// ── Layout containers (need children) ────────────────────────────────
	Card: {
		spec: {
			root: "card",
			elements: {
				card: {
					type: "Card",
					props: { title: "Account", description: "Your plan and usage" },
					children: ["body"]
				},
				...text("body", "Pro plan · renews May 30 · 12,500 / 20,000 credits used")
			}
		} as unknown as Spec
	},
	Stack: {
		spec: {
			root: "stack",
			elements: {
				stack: { type: "Stack", props: { direction: "horizontal", gap: "sm" }, children: ["a", "b", "c"] },
				a: { type: "Badge", props: { text: "One" }, children: [] },
				b: { type: "Badge", props: { text: "Two", variant: "secondary" }, children: [] },
				c: { type: "Badge", props: { text: "Three", variant: "outline" }, children: [] }
			}
		} as unknown as Spec
	},
	Grid: {
		spec: {
			root: "grid",
			elements: {
				grid: { type: "Grid", props: { columns: 3, gap: "md" }, children: ["c1", "c2", "c3"] },
				c1: { type: "Card", props: { title: "Revenue", description: "$48.2k" }, children: [] },
				c2: { type: "Card", props: { title: "Orders", description: "1,204" }, children: [] },
				c3: { type: "Card", props: { title: "Refunds", description: "23" }, children: [] }
			}
		} as unknown as Spec
	},
	ScrollArea: {
		spec: {
			root: "sa",
			elements: {
				sa: { type: "ScrollArea", props: { maxHeight: 160 }, children: ["inner"] },
				inner: {
					type: "Stack",
					props: { direction: "vertical", gap: "sm" },
					children: ["l1", "l2", "l3", "l4", "l5", "l6", "l7", "l8"]
				},
				...text("l1", "Line 1 — scroll to see more"),
				...text("l2", "Line 2"),
				...text("l3", "Line 3"),
				...text("l4", "Line 4"),
				...text("l5", "Line 5"),
				...text("l6", "Line 6"),
				...text("l7", "Line 7"),
				...text("l8", "Line 8 — the end")
			}
		} as unknown as Spec
	},
	Resizable: {
		spec: {
			root: "rs",
			elements: {
				rs: { type: "Resizable", props: { direction: "horizontal" }, children: ["p1", "p2"] },
				...text("p1", "Left panel — drag the divider →"),
				...text("p2", "Right panel")
			}
		} as unknown as Spec
	},
	AspectRatio: {
		spec: {
			root: "ar",
			elements: {
				ar: { type: "AspectRatio", props: { ratio: 1.777 }, children: ["img"] },
				img: {
					type: "Image",
					props: { src: "https://images.unsplash.com/photo-1503264116251-35a269479413?w=600", alt: "Landscape" },
					children: []
				}
			}
		} as unknown as Spec
	},

	// ── Disclosure / open-state containers ───────────────────────────────
	Collapsible: {
		spec: {
			root: "col",
			elements: {
				col: { type: "Collapsible", props: { title: "Show details", defaultOpen: false }, children: ["b"] },
				...text("b", "Hidden content revealed when expanded.")
			}
		} as unknown as Spec
	},
	Dialog: overlayDemo("Dialog", "/demoDialog", { title: "Edit profile", description: "Update your details below." }),
	Drawer: overlayDemo("Drawer", "/demoDrawer", { title: "Cart", description: "2 items in your cart" }),
	Sheet: overlayDemo("Sheet", "/demoSheet", { title: "Filters", side: "right" }),
	AlertDialog: overlayDemo("AlertDialog", "/demoAlert", {
		title: "Delete this order?",
		description: "This action cannot be undone.",
		confirmLabel: "Delete",
		cancelLabel: "Cancel"
	}),
	Command: {
		spec: {
			root: "root",
			elements: {
				root: { type: "Stack", props: { direction: "vertical", gap: "md" }, children: ["t", "cmd"] },
				t: {
					type: "Button",
					props: { label: "Open command palette", variant: "primary" },
					on: { press: { action: "setState", params: { statePath: "/demoCmd", value: true } } },
					children: []
				},
				cmd: {
					type: "Command",
					props: {
						openPath: "/demoCmd",
						placeholder: "Search actions…",
						items: [
							{ label: "New order", value: "new-order", group: "Actions" },
							{ label: "View customers", value: "customers", group: "Navigate" }
						]
					},
					children: []
				}
			}
		} as unknown as Spec,
		state: { demoCmd: false }
	},
	// Stat's catalog `example` binds `value` to a `$computed: "sum"` over
	// `/Order` — great LLM documentation, but it needs seed data or the preview
	// sums an empty list to $0.00. Re-use the same binding with a small Order
	// list so the demo shows a real revenue figure (and exercises $computed).
	Stat: {
		spec: {
			root: "stat",
			elements: {
				stat: {
					type: "Stat",
					props: {
						label: "Total revenue",
						value: { $computed: "sum", args: { list: { $state: "/Order" }, field: "TotalAmount" } },
						format: "currency",
						delta: "+12.5%",
						trend: "up",
						hint: "vs last week",
						className: "rounded-lg border p-4"
					},
					children: []
				}
			}
		} as unknown as Spec,
		state: {
			Order: [
				{ TotalAmount: 1248.5 },
				{ TotalAmount: 980 },
				{ TotalAmount: 2150.25 },
				{ TotalAmount: 4317.33 }
			]
		}
	},
	ContextMenu: {
		spec: {
			root: "ctx",
			elements: {
				ctx: {
					type: "ContextMenu",
					props: {
						items: [
							{ label: "Edit", value: "edit" },
							{ label: "Duplicate", value: "duplicate" },
							{ label: "Delete", value: "delete", separatorBefore: true }
						]
					},
					children: ["target"]
				},
				target: {
					type: "Card",
					props: { title: "Right-click me", description: "A context menu is anchored here." },
					children: []
				}
			}
		} as unknown as Spec
	},

	// ── Schema-driven form (the only form path). `schema` is normally fetched
	//    from the backend; here it's inlined so the catalog preview is
	//    self-contained (no runtime app/role). ─────────────────────────────
	Form: {
		spec: {
			root: "form",
			elements: {
				form: {
					type: "Form",
					props: {
						bdo: "Product",
						schema: {
							ProductName: { type: "String", required: true, label: "Product name" },
							Price: { type: "Number", required: true, integerPart: 9, fractionPart: 2 },
							Category: { type: "Enum", label: "Category", enum: ["Electronics", "Apparel", "Home"] },
							IsActive: { type: "Boolean", default: true, label: "Active" }
						}
					},
					children: ["fName", "fPrice", "fCategory", "fActive", "submit"]
				},
				fName: { type: "Field", props: { fieldId: "ProductName" }, children: [] },
				fPrice: { type: "Field", props: { fieldId: "Price" }, children: [] },
				fCategory: { type: "Field", props: { fieldId: "Category" }, children: [] },
				fActive: { type: "Field", props: { fieldId: "IsActive" }, children: [] },
				submit: { type: "FormAction", props: { operation: "create", label: "Create product" }, children: [] }
			}
		} as unknown as Spec
	},
	// Field only renders inside a Form (it reads the form's schema from
	// context), so its demo wraps one field in a minimal Form.
	Field: {
		spec: {
			root: "form",
			elements: {
				form: {
					type: "Form",
					props: {
						bdo: "Product",
						schema: { ProductName: { type: "String", required: true, label: "Product name" } }
					},
					children: ["f"]
				},
				f: { type: "Field", props: { fieldId: "ProductName" }, children: [] }
			}
		} as unknown as Spec
	},

	// ── Tabs (tab list + a content child) ────────────────────────────────
	Tabs: {
		spec: {
			root: "tabs",
			elements: {
				tabs: {
					type: "Tabs",
					props: {
						tabs: [
							{ label: "Overview", value: "overview" },
							{ label: "Activity", value: "activity" }
						],
						value: { $bindState: "/tab" }
					},
					children: ["panel"]
				},
				...text("panel", "Tab panel content renders below the tab list.")
			}
		} as unknown as Spec,
		state: { tab: "overview" }
	},

	// ── Feedback: toast trigger ──────────────────────────────────────────
	Toaster: {
		spec: {
			root: "root",
			elements: {
				root: { type: "Stack", props: { direction: "vertical", gap: "md" }, children: ["btn", "toaster"] },
				btn: {
					type: "Button",
					props: { label: "Show toast", variant: "primary" },
					on: {
						press: {
							action: "setState",
							params: {
								statePath: "/_toast",
								value: { title: "Saved!", description: "Your changes were saved.", variant: "success" }
							}
						}
					},
					children: []
				},
				toaster: { type: "Toaster", props: { watchPath: "/_toast", position: "bottom-right" }, children: [] }
			}
		} as unknown as Spec,
		state: { _toast: null }
	},

	// ── Leaf components without a catalog `example` (give demo props) ─────
	Separator: { props: {} },
	Skeleton: { props: { width: "240px", height: "1.25rem" } },
	Spinner: { props: { label: "Loading…" } },
	Image: {
		props: {
			src: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=320",
			alt: "Laptop",
			width: 240,
			height: 150
		}
	},
	Link: { props: { label: "Open documentation", href: "#" } },
	Tooltip: { props: { text: "Hover me", content: "Helpful hint shown on hover." } },
	Popover: { props: { trigger: "Open popover", content: "Popover content appears here." } },
	// ── Interactive inputs — bound to seeded state so clicks actually work ──
	Input: bound("Input", "value", "/email", "", {
		label: "Email",
		name: "email",
		type: "email",
		placeholder: "you@example.com"
	}),
	Textarea: bound("Textarea", "value", "/notes", "", {
		label: "Notes",
		name: "notes",
		placeholder: "Type a message…",
		rows: 3
	}),
	Select: bound("Select", "value", "/role", "Editor", {
		label: "Role",
		name: "role",
		options: ["Admin", "Editor", "Viewer"],
		placeholder: "Select a role"
	}),
	Radio: bound("Radio", "value", "/plan", "Pro", {
		label: "Plan",
		name: "plan",
		options: ["Free", "Pro", "Enterprise"]
	}),
	Checkbox: bound("Checkbox", "checked", "/subscribe", false, {
		label: "Subscribe to the newsletter",
		name: "subscribe"
	}),
	Switch: bound("Switch", "checked", "/notify", true, { label: "Enable notifications", name: "notify" }),
	Toggle: bound("Toggle", "pressed", "/bold", true, { label: "Bold", variant: "outline" }),
	Slider: bound("Slider", "value", "/volume", 60, { label: "Volume", min: 0, max: 100, step: 1 }),
	Rating: bound("Rating", "value", "/rating", 3, { max: 5 }),
	Combobox: bound("Combobox", "value", "/currency", "EUR", {
		options: ["USD", "EUR", "GBP", "JPY"],
		placeholder: "Select currency"
	}),
	MultiSelect: bound("MultiSelect", "value", "/teams", ["Design", "Sales"], {
		options: ["Design", "Engineering", "Sales", "Support"],
		placeholder: "Add teams"
	}),
	DatePicker: bound("DatePicker", "value", "/date", "2026-06-12", { placeholder: "Pick a date" }),
	Calendar: bound("Calendar", "value", "/calDate", "2026-06-12"),
	InputOTP: bound("InputOTP", "value", "/otp", "", { length: 6 }),
	InputMask: bound("InputMask", "value", "/card", "", {
		label: "Card number",
		mask: "#### #### #### ####",
		placeholder: "1234 5678 9012 3456"
	}),
	Counter: bound("Counter", "value", "/qty", 1, { label: "Quantity", min: 1, max: 99, className: "max-w-40" }),
	CheckboxGroup: bound("CheckboxGroup", "value", "/cats", ["Audio"], {
		label: "Category",
		options: ["Audio", "Wearables", "Accessories", "Home"],
	}),
	TagInput: bound("TagInput", "value", "/tags", ["urgent", "billing"], {
		label: "Tags",
		placeholder: "Add tag…"
	}),
	TimePicker: bound("TimePicker", "value", "/meetingTime", "09:30", { label: "Start time", className: "max-w-48" }),
	DateRangePicker: bound(
		"DateRangePicker",
		"value",
		"/period",
		{ from: "2026-06-01", to: "2026-06-12" },
		{ placeholder: "Pick a date range" }
	),
	RangeSlider: bound("RangeSlider", "value", "/priceRange", [20, 80], {
		label: "Price",
		min: 0,
		max: 100,
		step: 5
	}),
	ColorPicker: bound("ColorPicker", "value", "/accent", "#6d28d9", {
		label: "Accent color",
		presets: ["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#6d28d9"]
	}),
	Tree: bound("Tree", "value", "/selectedNode", "reports", {
		nodes: [
			{
				id: "docs",
				label: "Documents",
				icon: "folder",
				children: [
					{ id: "reports", label: "Reports", children: [{ id: "q1", label: "Q1 summary.pdf", icon: "file-text" }] },
					{ id: "invoices", label: "Invoices" }
				]
			},
			{ id: "media", label: "Media", icon: "image" }
		],
		defaultExpanded: ["docs"]
	}),
	Icon: { props: { name: "circle-check", size: 24, color: "#16a34a" } },
	StatusDot: { props: { variant: "success", label: "Operational", pulse: true } },
	ProgressCircle: { props: { value: 72, size: 56 } },
	CopyButton: { props: { text: "npm install json-render", label: "Copy command" } },
	DropdownMenu: {
		props: {
			label: "Options",
			items: [
				{ label: "Edit", value: "edit" },
				{ label: "Share", value: "share" },
				{ label: "Delete", value: "delete" }
			]
		}
	},
	ToggleGroup: bound("ToggleGroup", "value", "/align", "center", {
		type: "single",
		items: [
			{ label: "Left", value: "left" },
			{ label: "Center", value: "center" },
			{ label: "Right", value: "right" }
		]
	}),
	ButtonGroup: bound("ButtonGroup", "selected", "/range", "week", {
		buttons: [
			{ label: "Day", value: "day" },
			{ label: "Week", value: "week" },
			{ label: "Month", value: "month" }
		]
	}),
	Pagination: { props: { totalPages: 5, page: 2 } },
	Accordion: {
		props: {
			items: [
				{ title: "What is your refund policy?", content: "30-day money back, no questions asked." },
				{ title: "Do you offer support?", content: "Yes — 24/7 email support on all plans." }
			],
			type: "single"
		}
	},
	Carousel: {
		props: {
			items: [
				{ title: "Slide one", description: "First card" },
				{ title: "Slide two", description: "Second card" },
				{ title: "Slide three", description: "Third card" }
			]
		}
	},

	// ── No meaningful standalone preview ─────────────────────────────────
	PageOutlet: {
		note: "Mounts the active page spec from the navigation context. Only renders inside a generated app's shell, not standalone."
	},
	ModalOutlet: {
		note: "Mounts a modal's body when state.openModal matches its id. Requires the app shell's modal chrome and navigation context."
	}
}

/** Build the full list of showcase entries from the live catalog. */
export function buildShowcaseEntries(): ShowcaseEntry[] {
	return Object.entries(definitions).map(([name, def]) => {
		const demo: Demo = DEMOS[name] ?? { props: def.example }
		return {
			name,
			source: SHADCN.has(name) ? "shadcn" : "ours",
			category: CATEGORY[name] ?? "Primitives",
			description: def.description ?? "",
			events: def.events ?? [],
			example: def.example,
			propsSchema: def.props,
			demo
		}
	})
}
