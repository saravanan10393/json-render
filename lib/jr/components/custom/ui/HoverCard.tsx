/**
 * HoverCard — json-render catalog component. Reveals content in a floating
 * card on hover. Registered via src/components/custom/extras.ts.
 */
import type { BaseComponentProps } from "@json-render/react"
import * as HoverCardPrimitive from "@radix-ui/react-hover-card"
import { z } from "zod"

interface HoverCardProps {
	trigger: string
	content: string
}

function HoverCard({ props }: BaseComponentProps<HoverCardProps>) {
	return (
		<HoverCardPrimitive.Root openDelay={150} closeDelay={100}>
			<HoverCardPrimitive.Trigger className="cursor-default underline decoration-dotted underline-offset-2">
				{props.trigger}
			</HoverCardPrimitive.Trigger>
			<HoverCardPrimitive.Portal>
				<HoverCardPrimitive.Content
					sideOffset={6}
					className="z-50 w-64 rounded-md border bg-popover p-3 text-sm text-popover-foreground shadow-md"
				>
					{props.content}
				</HoverCardPrimitive.Content>
			</HoverCardPrimitive.Portal>
		</HoverCardPrimitive.Root>
	)
}

export const definition = {
	props: z.object({ trigger: z.string(), content: z.string() }),
	events: [],
	description:
		"Reveals `content` in a floating card when the user hovers `trigger` " +
		"(both plain text). For click use Popover; for short hints use Tooltip.",
	example: { trigger: "Acme Inc.", content: "Customer since 2021 — 14 orders." }
}

export const component = HoverCard
