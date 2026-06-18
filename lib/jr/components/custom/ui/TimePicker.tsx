/**
 * TimePicker — json-render catalog component. Time-of-day input built on the
 * native input[type=time] (free keyboard/locale/mobile/a11y behavior — better
 * than hand-rolled hour/minute dropdowns), styled like the shadcn Input with a
 * Clock adornment. Bound state value is a 24-hour "HH:MM" string ("HH:MM:SS"
 * when `step` < 60). Complements DatePicker. Registered via ./index.ts.
 */
import { type BaseComponentProps, useBoundProp } from "@json-render/react"
import { Clock } from "lucide-react"
import { z } from "zod"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

interface TimePickerProps {
	value?: string | null
	label?: string | null
	min?: string | null
	max?: string | null
	step?: number | null
	name?: string | null
	className?: string | null
}

function TimePicker({ props, bindings, emit }: BaseComponentProps<TimePickerProps>) {
	const [value, setValue] = useBoundProp<string>(props.value ?? "", bindings?.value)

	return (
		<div className={cn("space-y-1.5", props.className)}>
			{props.label && <Label>{props.label}</Label>}
			<div className="relative">
				<Clock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
				<input
					type="time"
					value={value ?? ""}
					min={props.min ?? undefined}
					max={props.max ?? undefined}
					step={props.step ?? 60}
					aria-label={props.label ?? props.name ?? "Time"}
					onChange={(e) => {
						setValue(e.target.value)
						emit("change")
					}}
					onFocus={() => emit("focus")}
					onBlur={() => emit("blur")}
					className="h-9 w-full rounded-md border border-input bg-transparent pl-9 pr-3 text-sm shadow-xs outline-none tabular-nums focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 [&::-webkit-calendar-picker-indicator]:opacity-60"
				/>
			</div>
		</div>
	)
}

export const definition = {
	props: z.object({
		value: z.string().nullable().describe("Time as 'HH:MM' (24-hour). Bind with $bindState."),
		label: z.string().nullable(),
		min: z.string().nullable().describe("Earliest selectable time, 'HH:MM'."),
		max: z.string().nullable().describe("Latest selectable time, 'HH:MM'."),
		step: z.number().nullable().describe("Granularity in seconds — 60 = minutes (default), 900 = 15-min increments."),
		name: z.string().nullable(),
		className: z.string().nullable()
	}),
	events: ["change", "focus", "blur"],
	description:
		"Time-of-day picker (native time input, locale-aware). Bind `value` with " +
		"$bindState — a 24-hour 'HH:MM' string. Pairs with DatePicker for date+time; " +
		"for ranges of dates use DateRangePicker.",
	example: { label: "Start time", value: "09:30" }
}

export const component = TimePicker
