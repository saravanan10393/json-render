/**
 * Item — json-render catalog component. A single list row: an optional leading
 * media glyph, a title + description, and a slot for trailing actions.
 * Registered via src/components/custom/extras.ts.
 */
import type { BaseComponentProps } from "@json-render/react"
import { z } from "zod"
import { cn } from "@/lib/utils"

interface ItemProps {
	title: string
	description?: string | null
	media?: string | null
	clickable?: boolean | null
}

function Item({ props, children, emit }: BaseComponentProps<ItemProps>) {
	const clickable = !!props.clickable
	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: the row opts into button semantics (role + tabIndex + key handler) only when clickable; a real <button> can't wrap the interactive trailing slot
		<div
			onClick={clickable ? () => emit("press") : undefined}
			onKeyDown={
				clickable
					? (e) => {
							if (e.key === "Enter" || e.key === " ") {
								e.preventDefault()
								emit("press")
							}
						}
					: undefined
			}
			role={clickable ? "button" : undefined}
			tabIndex={clickable ? 0 : undefined}
			className={cn(
				"flex items-center gap-3 rounded-md border border-border px-3 py-2.5",
				clickable &&
					"cursor-pointer transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
			)}
		>
			{props.media ? (
				<span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-base">
					{props.media}
				</span>
			) : null}
			<div className="flex min-w-0 flex-1 flex-col">
				<span className="truncate text-sm font-medium text-foreground">{props.title}</span>
				{props.description ? <span className="truncate text-xs text-muted-foreground">{props.description}</span> : null}
			</div>
			{children ? <div className="flex shrink-0 items-center gap-2">{children}</div> : null}
		</div>
	)
}

export const definition = {
	props: z.object({
		title: z.string(),
		description: z.string().nullable(),
		media: z.string().nullable(),
		clickable: z.boolean().nullable()
	}),
	slots: ["default"],
	events: ["press"],
	description:
		"A single list row: optional leading `media` glyph (an emoji or short " +
		"initials), a `title` + `description`, and trailing controls in its slot " +
		"(a Button, Badge, Switch…). Set `clickable` true and bind `on.press` to " +
		"make the whole row actionable. Use inside a Stack with a `repeat` " +
		"directive to render a list.",
	example: {
		title: "Acme Inc.",
		description: "14 open orders",
		media: "A"
	}
}

export const component = Item
