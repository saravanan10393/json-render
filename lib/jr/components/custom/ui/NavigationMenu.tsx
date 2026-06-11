/**
 * NavigationMenu — json-render catalog component. A horizontal site-navigation
 * bar; each entry is either a direct link or a trigger that opens a panel of
 * sub-links. Registered via src/components/custom/extras.ts.
 */
import { type BaseComponentProps, useBoundProp } from "@json-render/react"
import * as NavigationMenuPrimitive from "@radix-ui/react-navigation-menu"
import { ChevronDown } from "lucide-react"
import { z } from "zod"

interface NavLink {
	label: string
	value: string
	description?: string | null
}

interface NavEntry {
	label: string
	value?: string | null
	links?: NavLink[] | null
}

interface NavigationMenuProps {
	value?: string | null
	items: NavEntry[]
}

const TRIGGER =
	"flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

function NavigationMenu({ props, bindings, emit }: BaseComponentProps<NavigationMenuProps>) {
	const [, setValue] = useBoundProp<string>(undefined, bindings?.value)
	const items = props.items ?? []
	const navigate = (value: string) => {
		setValue(value)
		emit("navigate")
	}
	return (
		<NavigationMenuPrimitive.Root className="relative">
			<NavigationMenuPrimitive.List className="flex items-center gap-1">
				{items.map((entry) => {
					const links = entry.links ?? []
					if (links.length === 0) {
						return (
							<NavigationMenuPrimitive.Item key={entry.label}>
								<NavigationMenuPrimitive.Link
									onSelect={() => navigate(entry.value ?? entry.label)}
									className={`${TRIGGER} cursor-pointer`}
								>
									{entry.label}
								</NavigationMenuPrimitive.Link>
							</NavigationMenuPrimitive.Item>
						)
					}
					return (
						<NavigationMenuPrimitive.Item key={entry.label}>
							<NavigationMenuPrimitive.Trigger className={TRIGGER}>
								{entry.label}
								<ChevronDown
									aria-hidden
									className="size-3.5 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180"
								/>
							</NavigationMenuPrimitive.Trigger>
							<NavigationMenuPrimitive.Content className="absolute left-0 top-full mt-1.5 w-72 rounded-md border bg-popover p-2 text-popover-foreground shadow-md">
								<ul className="flex flex-col gap-0.5">
									{links.map((link) => (
										<li key={link.value}>
											<NavigationMenuPrimitive.Link
												onSelect={() => navigate(link.value)}
												className="block cursor-pointer rounded-sm px-3 py-2 transition-colors hover:bg-accent"
											>
												<span className="block text-sm font-medium text-foreground">{link.label}</span>
												{link.description ? (
													<span className="block text-xs text-muted-foreground">{link.description}</span>
												) : null}
											</NavigationMenuPrimitive.Link>
										</li>
									))}
								</ul>
							</NavigationMenuPrimitive.Content>
						</NavigationMenuPrimitive.Item>
					)
				})}
			</NavigationMenuPrimitive.List>
			<NavigationMenuPrimitive.Viewport />
		</NavigationMenuPrimitive.Root>
	)
}

export const definition = {
	props: z.object({
		value: z.string().nullable(),
		items: z.array(
			z.object({
				label: z.string(),
				value: z.string().nullable(),
				links: z
					.array(
						z.object({
							label: z.string(),
							value: z.string(),
							description: z.string().nullable()
						})
					)
					.nullable()
			})
		)
	}),
	events: ["navigate"],
	description:
		"Horizontal navigation bar. Each entry is a direct link (give it a " +
		"`value`, leave `links` empty) or a dropdown of sub-`links`. On click, " +
		"the target's `value` is written to the $bindState `value` path and " +
		"`navigate` fires — bind `on.navigate` to route. For the app's primary " +
		"page switch, prefer the shell's own nav chrome.",
	example: {
		items: [
			{ label: "Dashboard", value: "dashboard" },
			{
				label: "Products",
				links: [
					{ label: "All products", value: "products" },
					{ label: "Categories", value: "categories" }
				]
			}
		]
	}
}

export const component = NavigationMenu
