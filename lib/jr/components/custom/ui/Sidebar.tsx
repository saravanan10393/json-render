/**
 * Sidebar — json-render catalog component. A vertical navigation rail: an
 * optional header, a list of nav items, and a slot for footer content.
 * Self-contained for its item list. Registered via src/components/custom/extras.ts.
 */
import { type BaseComponentProps, useBoundProp } from "@json-render/react"
import { z } from "zod"
import { cn } from "@/lib/utils"

interface SidebarItem {
	label: string
	value: string
	badge?: string | null
}

interface SidebarProps {
	value?: string | null
	header?: string | null
	items: SidebarItem[]
}

function Sidebar({ props, children, bindings, emit }: BaseComponentProps<SidebarProps>) {
	const [active, setActive] = useBoundProp<string>(props.value ?? undefined, bindings?.value)
	const items = props.items ?? []
	return (
		<aside className="flex h-full w-60 shrink-0 flex-col border-r border-border bg-muted/30">
			{props.header ? (
				<div className="border-b border-border px-4 py-3 text-sm font-semibold text-foreground">{props.header}</div>
			) : null}
			<nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2">
				{items.map((item) => {
					const selected = active === item.value
					return (
						<button
							key={item.value}
							type="button"
							onClick={() => {
								setActive(item.value)
								emit("navigate")
							}}
							className={cn(
								"flex items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
								selected
									? "bg-accent font-medium text-accent-foreground"
									: "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
							)}
						>
							<span className="truncate">{item.label}</span>
							{item.badge ? (
								<span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
									{item.badge}
								</span>
							) : null}
						</button>
					)
				})}
			</nav>
			{children ? <div className="border-t border-border p-2">{children}</div> : null}
		</aside>
	)
}

export const definition = {
	props: z.object({
		value: z.string().nullable(),
		header: z.string().nullable(),
		items: z.array(
			z.object({
				label: z.string(),
				value: z.string(),
				badge: z.string().nullable()
			})
		)
	}),
	slots: ["default"],
	events: ["navigate"],
	description:
		"Vertical navigation rail — an optional `header`, a list of nav `items`, " +
		"and a slot for footer content (a user card, sign-out Button). On click, " +
		"the item's `value` is written to the $bindState `value` path and " +
		"`navigate` fires; bind `value` to the current route to highlight the " +
		"active item. `badge` shows an optional count pill.",
	example: {
		header: "Acme",
		items: [
			{ label: "Dashboard", value: "dashboard" },
			{ label: "Orders", value: "orders", badge: "12" },
			{ label: "Settings", value: "settings" }
		]
	}
}

export const component = Sidebar
