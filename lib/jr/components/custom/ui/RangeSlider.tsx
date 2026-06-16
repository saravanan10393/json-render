/**
 * RangeSlider — json-render catalog component. A dual-thumb slider committing
 * a [low, high] pair — price filters, numeric ranges, bounds. The shadcn
 * slider primitive already renders one thumb per array element, so this is a
 * thin custom-layer wrapper; the single-value Slider in the shadcn catalog
 * stays untouched. Incoming tuples are defensively sorted/clamped (LLM specs
 * may seed reversed pairs). Bind `value` with $bindState. Registered via
 * ./index.ts.
 */
import { type BaseComponentProps, useBoundProp } from "@json-render/react"
import { z } from "zod"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { Slider } from "../../shadcn/ui/slider"

interface RangeSliderProps {
	value?: [number, number] | null
	label?: string | null
	min?: number | null
	max?: number | null
	step?: number | null
	minGap?: number | null
	name?: string | null
	className?: string | null
}

function RangeSlider({ props, bindings, emit }: BaseComponentProps<RangeSliderProps>) {
	const min = props.min ?? 0
	const max = props.max ?? 100
	const [value, setValue] = useBoundProp<[number, number]>(props.value ?? [min, max], bindings?.value)

	// Defensive: sort and clamp whatever the spec/state handed us.
	const clamp = (n: number) => Math.min(max, Math.max(min, n))
	const raw = Array.isArray(value) && value.length === 2 ? value : [min, max]
	const [low, high] = [clamp(Math.min(raw[0], raw[1])), clamp(Math.max(raw[0], raw[1]))]

	return (
		<div className={cn("space-y-2", props.className)}>
			{props.label && (
				<div className="flex justify-between">
					<Label className="text-sm">{props.label}</Label>
					<span className="text-sm tabular-nums text-muted-foreground">
						{low} – {high}
					</span>
				</div>
			)}
			<Slider
				value={[low, high]}
				min={min}
				max={max}
				step={props.step ?? 1}
				minStepsBetweenThumbs={props.minGap ?? 0}
				aria-label={props.label ?? props.name ?? "Range"}
				onValueChange={(v) => {
					setValue([v[0] ?? min, v[1] ?? max])
					emit("change")
				}}
			/>
		</div>
	)
}

export const definition = {
	props: z.object({
		value: z
			.tuple([z.number(), z.number()])
			.nullable()
			.describe("Current [low, high] pair. Bind with $bindState — commits as a two-number array."),
		label: z.string().nullable().describe("Shown above with a live 'low – high' readout."),
		min: z.number().nullable().describe("Track minimum (default 0)."),
		max: z.number().nullable().describe("Track maximum (default 100)."),
		step: z.number().nullable().describe("Thumb step (default 1)."),
		minGap: z.number().nullable().describe("Minimum steps kept between the two thumbs."),
		name: z.string().nullable(),
		className: z.string().nullable()
	}),
	events: ["change"],
	description:
		"Dual-thumb range slider committing a [low, high] number pair — price filters, " +
		"numeric bounds. Bind `value` with $bindState. For a single value use Slider.",
	example: { label: "Price", value: [20, 80], min: 0, max: 100 }
}

export const component = RangeSlider
