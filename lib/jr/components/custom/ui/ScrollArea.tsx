/**
 * ScrollArea — json-render catalog component. A scroll container with tidy
 * custom scrollbars. Registered via src/components/custom/extras.ts.
 */
import type { BaseComponentProps } from "@json-render/react"
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area"
import { z } from "zod"

interface ScrollAreaProps {
	maxHeight?: number | null
}

function ScrollArea({ props, children }: BaseComponentProps<ScrollAreaProps>) {
	return (
		<ScrollAreaPrimitive.Root
			className="relative overflow-hidden rounded-md"
			style={{ maxHeight: props.maxHeight ?? 320 }}
		>
			<ScrollAreaPrimitive.Viewport className="size-full max-h-[inherit]">{children}</ScrollAreaPrimitive.Viewport>
			<ScrollAreaPrimitive.Scrollbar orientation="vertical" className="flex w-2 touch-none select-none p-0.5">
				<ScrollAreaPrimitive.Thumb className="flex-1 rounded-full bg-border" />
			</ScrollAreaPrimitive.Scrollbar>
			<ScrollAreaPrimitive.Corner />
		</ScrollAreaPrimitive.Root>
	)
}

export const definition = {
	props: z.object({ maxHeight: z.number().nullable() }),
	slots: ["default"],
	description:
		"A scroll container with tidy custom scrollbars. `maxHeight` caps the " +
		"height in pixels (default 320); content beyond it scrolls.",
	example: { maxHeight: 320 }
}

export const component = ScrollArea
