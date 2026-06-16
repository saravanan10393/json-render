/**
 * StatusDot — json-render catalog component. A tiny colored dot with an
 * optional label — the subtle sibling of Badge for status columns, legends,
 * presence indicators, and health readouts. `pulse` adds an animate-ping halo
 * for live/online states. Pure display leaf: no binding, no events. The shadcn
 * theme has no semantic success/warning tokens, so the variant→color map uses
 * explicit palette classes (the established escape hatch). Registered via
 * ./index.ts.
 */
import { type BaseComponentProps } from "@json-render/react"
import { z } from "zod"
import { cn } from "@/lib/utils"

interface StatusDotProps {
	variant?: "success" | "warning" | "error" | "info" | "neutral" | null
	label?: string | null
	pulse?: boolean | null
	size?: "sm" | "md" | "lg" | null
	className?: string | null
}

const COLOR: Record<string, string> = {
	success: "bg-emerald-500",
	warning: "bg-amber-500",
	error: "bg-red-500",
	info: "bg-sky-500",
	neutral: "bg-muted-foreground"
}

const SIZE: Record<string, string> = {
	sm: "size-1.5",
	md: "size-2",
	lg: "size-2.5"
}

function StatusDot({ props }: BaseComponentProps<StatusDotProps>) {
	const color = COLOR[props.variant ?? "neutral"] ?? COLOR.neutral
	const size = SIZE[props.size ?? "md"] ?? SIZE.md

	return (
		<span className={cn("inline-flex items-center gap-1.5", props.className)}>
			<span className={cn("relative inline-flex shrink-0", size)}>
				{props.pulse && (
					<span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-60", color)} />
				)}
				<span className={cn("relative inline-flex h-full w-full rounded-full", color)} />
			</span>
			{props.label && <span className="text-sm text-foreground">{props.label}</span>}
		</span>
	)
}

export const definition = {
	props: z.object({
		variant: z
			.enum(["success", "warning", "error", "info", "neutral"])
			.nullable()
			.describe("Semantic color (default 'neutral'). success=green, warning=amber, error=red, info=blue."),
		label: z.string().nullable().describe("Text rendered beside the dot."),
		pulse: z.boolean().nullable().describe("Animate a ping halo — for 'live'/'online' states."),
		size: z.enum(["sm", "md", "lg"]).nullable().describe("Dot diameter (default 'md')."),
		className: z.string().nullable()
	}),
	description:
		"Tiny colored status dot with optional label — subtler than Badge. Use in status " +
		"columns, legends, presence/health indicators. Set `pulse` for live states.",
	example: { variant: "success", label: "Operational", pulse: true }
}

export const component = StatusDot
