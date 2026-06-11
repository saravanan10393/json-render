/**
 * Calendar — json-render catalog component. An inline month calendar for
 * picking a single date. Registered via src/components/custom/extras.ts.
 */
import { type BaseComponentProps, useBoundProp } from "@json-render/react"
import { z } from "zod"
import { Calendar as CalendarPrimitive } from "@/components/ui/calendar"
import { parseLocalISODate, toLocalISODate } from "@/lib/utils"

interface CalendarProps {
	value?: string | null
	name?: string | null
}

function Calendar({ props, bindings, emit }: BaseComponentProps<CalendarProps>) {
	const [value, setValue] = useBoundProp<string>(props.value ?? undefined, bindings?.value)
	return (
		<CalendarPrimitive
			className="inline-block rounded-md border"
			mode="single"
			selected={parseLocalISODate(value)}
			defaultMonth={parseLocalISODate(value)}
			onSelect={(date) => {
				setValue(date ? toLocalISODate(date) : "")
				emit("change")
			}}
		/>
	)
}

export const definition = {
	props: z.object({
		value: z.string().nullable(),
		name: z.string().nullable()
	}),
	events: ["change"],
	description:
		"Inline month calendar for picking a single date. Bind `value` with " +
		"$bindState — it holds an ISO date string (YYYY-MM-DD).",
	example: { name: "date" }
}

export const component = Calendar
