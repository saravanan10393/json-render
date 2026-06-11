/**
 * Command — json-render catalog component. A command palette: a searchable
 * list of actions in a centered dialog. Visibility is driven by `openPath`
 * (a boolean state path). Registered via src/components/custom/extras.ts.
 */
import { type BaseComponentProps, useBoundProp, useStateBinding } from "@json-render/react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { Command as Cmdk } from "cmdk"
import { z } from "zod"

interface CommandItem {
	label: string
	value: string
	group?: string | null
	shortcut?: string | null
}

interface CommandProps {
	value?: string | null
	items: CommandItem[]
	placeholder?: string | null
	openPath: string
}

function Command({ props, bindings, emit }: BaseComponentProps<CommandProps>) {
	const [open, setOpen] = useStateBinding<boolean>(props.openPath ?? "")
	const [, setValue] = useBoundProp<string>(undefined, bindings?.value)
	const items = props.items ?? []
	// Preserve item order while collecting the distinct group headings.
	const groups = [...new Set(items.map((it) => it.group ?? ""))]
	return (
		<DialogPrimitive.Root open={!!open} onOpenChange={(o) => setOpen(o)}>
			<DialogPrimitive.Portal>
				<DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40" />
				<DialogPrimitive.Content
					aria-describedby={undefined}
					className="fixed left-1/2 top-[20%] z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-lg focus:outline-none"
				>
					<DialogPrimitive.Title className="sr-only">Command menu</DialogPrimitive.Title>
					<Cmdk>
						<Cmdk.Input
							placeholder={props.placeholder ?? "Type a command or search…"}
							className="w-full border-b border-border bg-transparent px-4 py-3 text-sm outline-none placeholder:text-muted-foreground"
						/>
						<Cmdk.List className="max-h-72 overflow-y-auto p-1">
							<Cmdk.Empty className="px-3 py-6 text-center text-sm text-muted-foreground">No results found.</Cmdk.Empty>
							{groups.map((group) => (
								<Cmdk.Group
									key={group || "_"}
									heading={group || undefined}
									className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
								>
									{items
										.filter((it) => (it.group ?? "") === group)
										.map((it) => (
											<Cmdk.Item
												key={it.value}
												value={`${it.label} ${it.value}`}
												onSelect={() => {
													setValue(it.value)
													emit("select")
													setOpen(false)
												}}
												className="flex cursor-pointer items-center justify-between gap-2 rounded-sm px-2 py-2 text-sm data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
											>
												<span>{it.label}</span>
												{it.shortcut ? (
													<kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
														{it.shortcut}
													</kbd>
												) : null}
											</Cmdk.Item>
										))}
								</Cmdk.Group>
							))}
						</Cmdk.List>
					</Cmdk>
				</DialogPrimitive.Content>
			</DialogPrimitive.Portal>
		</DialogPrimitive.Root>
	)
}

export const definition = {
	props: z.object({
		value: z.string().nullable(),
		items: z.array(
			z.object({
				label: z.string(),
				value: z.string(),
				group: z.string().nullable(),
				shortcut: z.string().nullable()
			})
		),
		placeholder: z.string().nullable(),
		openPath: z.string()
	}),
	events: ["select"],
	description:
		"Command palette — a searchable list of actions in a centered dialog. " +
		"Visibility is driven by `openPath`, a boolean state path; set it true " +
		"to open. Items with the same `group` are listed under one heading. On " +
		"pick, the chosen item's `value` is written to the $bindState `value` " +
		"path and `select` fires — bind `on.select` to act on it.",
	example: {
		openPath: "/commandOpen",
		placeholder: "Search actions…",
		items: [
			{ label: "New order", value: "new-order", group: "Actions" },
			{ label: "View customers", value: "customers", group: "Navigate" }
		]
	}
}

export const component = Command
