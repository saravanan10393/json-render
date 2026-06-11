/**
 * ContextMenu — json-render catalog component. A right-click (or long-press)
 * menu anchored to its slot child. Registered via src/components/custom/extras.ts.
 */
import { type BaseComponentProps, useBoundProp } from "@json-render/react"
import * as ContextMenuPrimitive from "@radix-ui/react-context-menu"
import { z } from "zod"

interface ContextMenuEntry {
	label: string
	value: string
	disabled?: boolean | null
	separatorBefore?: boolean | null
}

interface ContextMenuProps {
	value?: string | null
	items: ContextMenuEntry[]
}

function ContextMenu({ props, children, bindings, emit }: BaseComponentProps<ContextMenuProps>) {
	const [, setValue] = useBoundProp<string>(undefined, bindings?.value)
	const items = props.items ?? []
	return (
		<ContextMenuPrimitive.Root>
			<ContextMenuPrimitive.Trigger className="block">{children}</ContextMenuPrimitive.Trigger>
			<ContextMenuPrimitive.Portal>
				<ContextMenuPrimitive.Content className="z-50 min-w-44 overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
					{items.map((it, i) => (
						<div key={it.value}>
							{it.separatorBefore && i > 0 ? <ContextMenuPrimitive.Separator className="my-1 h-px bg-border" /> : null}
							<ContextMenuPrimitive.Item
								disabled={!!it.disabled}
								onSelect={() => {
									setValue(it.value)
									emit("select")
								}}
								className="flex cursor-pointer items-center rounded-sm px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
							>
								{it.label}
							</ContextMenuPrimitive.Item>
						</div>
					))}
				</ContextMenuPrimitive.Content>
			</ContextMenuPrimitive.Portal>
		</ContextMenuPrimitive.Root>
	)
}

export const definition = {
	props: z.object({
		value: z.string().nullable(),
		items: z.array(
			z.object({
				label: z.string(),
				value: z.string(),
				disabled: z.boolean().nullable(),
				separatorBefore: z.boolean().nullable()
			})
		)
	}),
	slots: ["default"],
	events: ["select"],
	description:
		"Right-click menu anchored to its slot child (place the target element — " +
		"a Card, row, Image — inside). On pick, the chosen item's `value` is " +
		"written to the $bindState `value` path and `select` fires. Set " +
		"`separatorBefore` to divide groups. For a click-triggered menu use " +
		"DropdownMenu instead.",
	example: {
		items: [
			{ label: "Edit", value: "edit" },
			{ label: "Duplicate", value: "duplicate" },
			{ label: "Delete", value: "delete", separatorBefore: true }
		]
	}
}

export const component = ContextMenu
