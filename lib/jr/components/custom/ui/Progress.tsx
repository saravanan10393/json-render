/**
 * Progress — custom override of the shadcn catalog Progress: respects `max`
 * (fill = value/max), which the out-of-box renderer ignores (it clamps the
 * raw value to 0-100). Registered after shadcn so this one wins.
 */
import { type BaseComponentProps } from "@json-render/react"
import { z } from "zod"

interface ProgressProps {
	value?: number | null
	max?: number | null
	label?: string | null
}

function Progress({ props }: BaseComponentProps<ProgressProps>) {
	const max = props.max && props.max > 0 ? props.max : 100
	const raw = Number(props.value ?? 0)
	const pct = Math.min(100, Math.max(0, (raw / max) * 100))
	return (
		<div className="flex flex-col gap-1">
			{props.label ? <span className="text-sm text-muted-foreground">{props.label}</span> : null}
			<div className="h-2 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={raw} aria-valuemax={max}>
				<div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
			</div>
		</div>
	)
}

export const definition = {
	props: z.object({
		value: z.number().nullable().describe("Current value (in max units, not necessarily a percent)."),
		max: z.number().nullable().describe("Scale ceiling — fill is value/max. Default 100."),
		label: z.string().nullable()
	}),
	description: "Progress bar: fill = value/max (default max 100). Use for value-vs-target displays.",
	example: { value: 15, max: 20, label: "Done tasks" }
}

export const component = Progress
