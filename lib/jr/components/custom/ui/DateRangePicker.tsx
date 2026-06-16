/**
 * DateRangePicker — json-render catalog component. A from/to date range:
 * trigger button + popover with the app Calendar in range mode (or inline via
 * `inline`). The bound state value is a SINGLE object { from, to } of ISO
 * "YYYY-MM-DD" strings (one $bindState path binds one prop; `to` stays null
 * until the second click — the popover stays open until the range completes).
 * Date conversion goes through lib/utils' local-date helpers: `toISOString()`
 * would shift a day in UTC+ timezones. Registered via ./index.ts.
 */
import { type BaseComponentProps, useBoundProp } from "@json-render/react"
import * as PopoverPrimitive from "@radix-ui/react-popover"
import { Calendar as CalendarIcon } from "lucide-react"
import { useState } from "react"
import type { DateRange } from "react-day-picker"
import { z } from "zod"
import { Calendar } from "@/components/ui/calendar"
import { cn, parseLocalISODate, toLocalISODate } from "@/lib/utils"

interface RangeValue {
	from: string | null
	to: string | null
}

interface DateRangePickerProps {
	value?: RangeValue | null
	placeholder?: string | null
	numberOfMonths?: number | null
	minDate?: string | null
	maxDate?: string | null
	inline?: boolean | null
	name?: string | null
	className?: string | null
}

function formatDay(iso: string | null | undefined): string | null {
	const date = parseLocalISODate(iso)
	return date ? date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : null
}

function DateRangePicker({ props, bindings, emit }: BaseComponentProps<DateRangePickerProps>) {
	const [value, setValue] = useBoundProp<RangeValue | null>(props.value ?? null, bindings?.value)
	const [open, setOpen] = useState(false)

	const selected: DateRange | undefined = value?.from
		? { from: parseLocalISODate(value.from), to: parseLocalISODate(value.to) }
		: undefined

	const minDate = parseLocalISODate(props.minDate)
	const maxDate = parseLocalISODate(props.maxDate)

	const onSelect = (range: DateRange | undefined) => {
		const next: RangeValue | null = range?.from
			? { from: toLocalISODate(range.from), to: range.to ? toLocalISODate(range.to) : null }
			: null
		setValue(next)
		emit("change")
		// Close only once both ends are picked; mid-selection stays open.
		if (next?.from && next?.to) setOpen(false)
	}

	const calendar = (
		<Calendar
			mode="range"
			numberOfMonths={props.numberOfMonths ?? 2}
			selected={selected}
			onSelect={onSelect}
			defaultMonth={selected?.from}
			disabled={minDate || maxDate ? { before: minDate as Date, after: maxDate as Date } : undefined}
		/>
	)

	if (props.inline) {
		return <div className={cn("inline-block rounded-md border border-input", props.className)}>{calendar}</div>
	}

	const fromText = formatDay(value?.from)
	const toText = formatDay(value?.to)
	const triggerText = fromText ? (toText ? `${fromText} – ${toText}` : `${fromText} – …`) : null

	return (
		<PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
			<PopoverPrimitive.Trigger asChild>
				<button
					type="button"
					aria-label={props.name ?? "Date range"}
					className={cn(
						"flex h-9 w-full items-center gap-2 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
						props.className
					)}
				>
					<CalendarIcon className="size-4 shrink-0 opacity-50" />
					{triggerText ? (
						<span>{triggerText}</span>
					) : (
						<span className="text-muted-foreground">{props.placeholder ?? "Pick a date range"}</span>
					)}
				</button>
			</PopoverPrimitive.Trigger>
			<PopoverPrimitive.Portal>
				<PopoverPrimitive.Content
					align="start"
					sideOffset={4}
					className="z-50 rounded-md border border-border bg-popover text-popover-foreground shadow-md"
				>
					{calendar}
				</PopoverPrimitive.Content>
			</PopoverPrimitive.Portal>
		</PopoverPrimitive.Root>
	)
}

export const definition = {
	props: z.object({
		value: z
			.object({ from: z.string().nullable(), to: z.string().nullable() })
			.nullable()
			.describe(
				"Selected range as {from,to} ISO 'YYYY-MM-DD' strings. Bind with $bindState. `to` is null until the second click."
			),
		placeholder: z.string().nullable().describe("Trigger text when empty (default 'Pick a date range')."),
		numberOfMonths: z.number().nullable().describe("Months shown side by side (default 2)."),
		minDate: z.string().nullable().describe("Earliest selectable date, ISO 'YYYY-MM-DD'."),
		maxDate: z.string().nullable().describe("Latest selectable date, ISO 'YYYY-MM-DD'."),
		inline: z.boolean().nullable().describe("Render the calendar inline instead of in a popover."),
		name: z.string().nullable(),
		className: z.string().nullable()
	}),
	events: ["change"],
	description:
		"From/to date range picker (popover calendar, or inline). Bind `value` with " +
		"$bindState — a single {from,to} object of ISO 'YYYY-MM-DD' strings. Use for " +
		"report periods, filters, bookings. For a single date use DatePicker.",
	example: { placeholder: "Pick a date range" }
}

export const component = DateRangePicker
