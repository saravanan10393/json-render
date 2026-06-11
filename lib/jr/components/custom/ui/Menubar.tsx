/**
 * Menubar — json-render catalog component. A desktop-style application menu
 * bar (File / Edit / View…), each menu opening a list of commands.
 * Registered via src/components/custom/extras.ts.
 */
import { type BaseComponentProps, useBoundProp } from "@json-render/react"
import * as MenubarPrimitive from "@radix-ui/react-menubar"
import { z } from "zod"

interface MenubarCommand {
	label: string
	value: string
	shortcut?: string | null
	disabled?: boolean | null
	separatorBefore?: boolean | null
}

interface MenubarMenu {
	label: string
	items: MenubarCommand[]
}

interface MenubarProps {
	value?: string | null
	menus: MenubarMenu[]
}

function Menubar({ props, bindings, emit }: BaseComponentProps<MenubarProps>) {
	const [, setValue] = useBoundProp<string>(undefined, bindings?.value)
	const menus = props.menus ?? []
	return (
		<MenubarPrimitive.Root className="flex items-center gap-0.5 rounded-md border bg-background p-1 shadow-sm">
			{menus.map((menu) => (
				<MenubarPrimitive.Menu key={menu.label}>
					<MenubarPrimitive.Trigger className="cursor-pointer rounded-sm px-3 py-1 text-sm font-medium outline-none data-[highlighted]:bg-accent data-[state=open]:bg-accent">
						{menu.label}
					</MenubarPrimitive.Trigger>
					<MenubarPrimitive.Portal>
						<MenubarPrimitive.Content
							align="start"
							sideOffset={6}
							className="z-50 min-w-48 overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
						>
							{(menu.items ?? []).map((it, i) => (
								<div key={it.value}>
									{it.separatorBefore && i > 0 ? <MenubarPrimitive.Separator className="my-1 h-px bg-border" /> : null}
									<MenubarPrimitive.Item
										disabled={!!it.disabled}
										onSelect={() => {
											setValue(it.value)
											emit("select")
										}}
										className="flex cursor-pointer items-center justify-between gap-4 rounded-sm px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
									>
										{it.label}
										{it.shortcut ? (
											<span className="font-mono text-xs text-muted-foreground">{it.shortcut}</span>
										) : null}
									</MenubarPrimitive.Item>
								</div>
							))}
						</MenubarPrimitive.Content>
					</MenubarPrimitive.Portal>
				</MenubarPrimitive.Menu>
			))}
		</MenubarPrimitive.Root>
	)
}

export const definition = {
	props: z.object({
		value: z.string().nullable(),
		menus: z.array(
			z.object({
				label: z.string(),
				items: z.array(
					z.object({
						label: z.string(),
						value: z.string(),
						shortcut: z.string().nullable(),
						disabled: z.boolean().nullable(),
						separatorBefore: z.boolean().nullable()
					})
				)
			})
		)
	}),
	events: ["select"],
	description:
		"Desktop-style application menu bar — a row of named menus (File, Edit, " +
		"View…), each opening a list of commands. On pick, the command's `value` " +
		"is written to the $bindState `value` path and `select` fires. Set " +
		"`separatorBefore` to group commands.",
	example: {
		menus: [
			{
				label: "File",
				items: [
					{ label: "New", value: "new", shortcut: "⌘N" },
					{ label: "Save", value: "save", shortcut: "⌘S" }
				]
			},
			{
				label: "Edit",
				items: [{ label: "Undo", value: "undo", shortcut: "⌘Z" }]
			}
		]
	}
}

export const component = Menubar
