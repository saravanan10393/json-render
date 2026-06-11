/**
 * Resizable — json-render catalog component. Splits its slot children into
 * panels divided by a draggable handle the user can drag to resize.
 * Registered via src/components/custom/extras.ts.
 */
import type { BaseComponentProps } from "@json-render/react"
import { GripVertical } from "lucide-react"
import { Children, type ReactNode } from "react"
import { Group, Panel, Separator } from "react-resizable-panels"
import { z } from "zod"

interface ResizableProps {
	direction?: "horizontal" | "vertical" | null
	minSize?: number | null
}

function Resizable({ props, children }: BaseComponentProps<ResizableProps>) {
	const orientation = props.direction ?? "horizontal"
	const minSize = `${props.minSize ?? 15}%`
	// Each top-level slot child becomes one panel; handles go between them.
	const panels = Children.toArray(children) as ReactNode[]
	const handleClass =
		orientation === "horizontal"
			? "flex w-1.5 items-center justify-center bg-border outline-none transition-colors hover:bg-ring"
			: "flex h-1.5 items-center justify-center bg-border outline-none transition-colors hover:bg-ring"
	return (
		<Group orientation={orientation} className="h-full min-h-48 overflow-hidden rounded-md border border-border">
			{panels.flatMap((panel, i) => {
				const node = (
					// biome-ignore lint/suspicious/noArrayIndexKey: slot order is stable
					<Panel key={`panel-${i}`} minSize={minSize} className="overflow-auto">
						{panel}
					</Panel>
				)
				if (i === 0) return [node]
				const handle = (
					// biome-ignore lint/suspicious/noArrayIndexKey: slot order is stable
					<Separator key={`handle-${i}`} className={handleClass}>
						<GripVertical
							aria-hidden
							className={
								orientation === "horizontal" ? "size-3 text-muted-foreground" : "size-3 rotate-90 text-muted-foreground"
							}
						/>
					</Separator>
				)
				return [handle, node]
			})}
		</Group>
	)
}

export const definition = {
	props: z.object({
		direction: z.enum(["horizontal", "vertical"]).nullable(),
		minSize: z.number().nullable()
	}),
	slots: ["default"],
	description:
		"Splits its slot children into draggable, resizable panels — each direct " +
		"child becomes one panel, with a drag handle between them. `direction` " +
		"is horizontal (side by side, default) or vertical (stacked). `minSize` " +
		"is each panel's minimum size as a percentage (default 15).",
	example: { direction: "horizontal" }
}

export const component = Resizable
