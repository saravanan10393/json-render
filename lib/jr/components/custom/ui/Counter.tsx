/**
 * Counter — json-render catalog component. A numeric value flanked by
 * decrement/increment steppers (quantity selectors, counters, settings). The
 * value is clamped to `min`/`max` and stepped by `step`; the − button disables
 * at `min`, the + button at `max`. Bind `value` with $bindState. For record
 * forms use Form/Field instead. Registered via ./index.ts.
 */
import { type BaseComponentProps, useBoundProp } from "@json-render/react"
import { Minus, Plus } from "lucide-react"
import type { ChangeEvent } from "react"
import { z } from "zod"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

interface CounterProps {
	label?: string | null
	value?: number | null
	min?: number | null
	max?: number | null
	step?: number | null
	className?: string | null
	name?: string | null
}

function Counter({ props, bindings, emit }: BaseComponentProps<CounterProps>) {
	const [value, setValue] = useBoundProp<number>(props.value ?? 0, bindings?.value)
	const current = value ?? 0
	const step = props.step ?? 1
	const min = props.min ?? null
	const max = props.max ?? null

	const clamp = (n: number) => Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min ?? Number.NEGATIVE_INFINITY, n))
	const commit = (n: number) => {
		setValue(clamp(n))
		emit("change")
	}

	const onInput = (e: ChangeEvent<HTMLInputElement>) => {
		const n = Number.parseInt(e.target.value.replace(/[^\d-]/g, ""), 10)
		commit(Number.isNaN(n) ? (min ?? 0) : n)
	}

	const atMin = min !== null && current <= min
	const atMax = max !== null && current >= max
	const stepBtn =
		"flex aspect-square h-5 items-center justify-center rounded-sm bg-primary/10 text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-50"

	return (
		<div className={cn("space-y-1.5", props.className)}>
			{props.label && <Label>{props.label}</Label>}
			<div className="relative inline-flex h-8 w-full min-w-0 items-center overflow-hidden rounded-md border bg-transparent text-sm shadow-xs">
				<button
					type="button"
					tabIndex={-1}
					disabled={atMin}
					aria-label="Decrease"
					onClick={() => commit(current - step)}
					className={cn("ms-2", stepBtn)}
				>
					<Minus className="size-3" />
				</button>
				<input
					type="text"
					inputMode="numeric"
					aria-label={props.label ?? "Number"}
					value={String(current)}
					onChange={onInput}
					onFocus={() => emit("focus")}
					onBlur={() => emit("blur")}
					className="w-full grow bg-transparent px-3 py-2 text-center tabular-nums outline-none"
				/>
				<button
					type="button"
					tabIndex={-1}
					disabled={atMax}
					aria-label="Increase"
					onClick={() => commit(current + step)}
					className={cn("me-2", stepBtn)}
				>
					<Plus className="size-3" />
				</button>
			</div>
		</div>
	)
}

export const definition = {
	props: z.object({
		label: z.string().nullable(),
		value: z.number().nullable().describe("Current number. Bind with $bindState."),
		min: z.number().nullable().describe("Lower bound — the − button disables here."),
		max: z.number().nullable().describe("Upper bound — the + button disables here."),
		step: z.number().nullable().describe("Increment per stepper click (default 1)."),
		className: z.string().nullable().describe("Extra classes on the wrapper (e.g. 'max-w-32' to cap width)."),
		name: z.string().nullable()
	}),
	events: ["change", "focus", "blur"],
	description:
		"A Counter — a numeric value with −/+ stepper buttons (quantity selectors, counters). Value " +
		"clamps to `min`/`max` and steps by `step`; the − disables at min, + at max. Bind " +
		"`value` with $bindState. For ad-hoc state; for record forms use Form/Field.",
	example: { label: "Quantity", value: 1, min: 1, max: 99 }
}

export const component = Counter
