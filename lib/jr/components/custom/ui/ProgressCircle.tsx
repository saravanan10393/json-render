/**
 * ProgressCircle — json-render catalog component. A circular progress ring
 * (the radial sibling of Progress): pure SVG, fill = value/max, optional
 * centered percentage and caption. Display leaf like Progress — drive `value`
 * with { $state } for live updates; no binding, no events. Registered via
 * ./index.ts.
 */
import { type BaseComponentProps } from "@json-render/react"
import { z } from "zod"
import { cn } from "@/lib/utils"

interface ProgressCircleProps {
	value?: number | null
	max?: number | null
	size?: number | null
	strokeWidth?: number | null
	showValue?: boolean | null
	label?: string | null
	color?: string | null
	className?: string | null
}

function ProgressCircle({ props }: BaseComponentProps<ProgressCircleProps>) {
	const max = props.max && props.max > 0 ? props.max : 100
	const raw = Number(props.value ?? 0)
	const fraction = Math.min(1, Math.max(0, raw / max))
	const size = props.size ?? 48
	const strokeWidth = props.strokeWidth ?? 4
	const radius = (size - strokeWidth) / 2
	const circumference = 2 * Math.PI * radius

	return (
		<div className={cn("inline-flex flex-col items-center gap-1", props.className)}>
			<div
				className="relative inline-flex items-center justify-center"
				role="progressbar"
				aria-valuenow={raw}
				aria-valuemax={max}
			>
				<svg width={size} height={size} className="-rotate-90">
					<circle
						cx={size / 2}
						cy={size / 2}
						r={radius}
						fill="none"
						strokeWidth={strokeWidth}
						className="stroke-muted"
					/>
					<circle
						cx={size / 2}
						cy={size / 2}
						r={radius}
						fill="none"
						strokeWidth={strokeWidth}
						strokeLinecap="round"
						strokeDasharray={circumference}
						strokeDashoffset={circumference * (1 - fraction)}
						stroke={props.color ?? "var(--primary)"}
						className="transition-[stroke-dashoffset] duration-300"
					/>
				</svg>
				{(props.showValue ?? true) && (
					<span className="absolute text-xs font-medium tabular-nums">{Math.round(fraction * 100)}%</span>
				)}
			</div>
			{props.label && <span className="text-xs text-muted-foreground">{props.label}</span>}
		</div>
	)
}

export const definition = {
	props: z.object({
		value: z.number().nullable().describe("Current value 0..max. Use { $state } to drive it from state."),
		max: z.number().nullable().describe("Scale maximum (default 100)."),
		size: z.number().nullable().describe("Outer diameter in px (default 48)."),
		strokeWidth: z.number().nullable().describe("Ring thickness in px (default 4)."),
		showValue: z.boolean().nullable().describe("Render the percentage in the center (default true)."),
		label: z.string().nullable().describe("Small caption under the circle."),
		color: z.string().nullable().describe("Ring CSS color override — default the primary theme color."),
		className: z.string().nullable()
	}),
	description:
		"Circular progress ring — fill = value/max with an optional centered percentage. " +
		"Use for completion %, capacity, scores. For a linear bar use Progress.",
	example: { value: 72 }
}

export const component = ProgressCircle
