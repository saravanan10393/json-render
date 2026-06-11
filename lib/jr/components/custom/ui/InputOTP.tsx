/**
 * InputOTP — json-render catalog component. A one-time-code input: a row of
 * single-character boxes. Registered via src/components/custom/extras.ts.
 */
import { type BaseComponentProps, useBoundProp } from "@json-render/react"
import { OTPInput } from "input-otp"
import { z } from "zod"
import { cn } from "@/lib/utils"

interface InputOTPProps {
	value?: string | null
	length?: number | null
	name?: string | null
}

function InputOTP({ props, bindings, emit }: BaseComponentProps<InputOTPProps>) {
	const [value, setValue] = useBoundProp<string>(props.value ?? undefined, bindings?.value)
	return (
		<OTPInput
			maxLength={props.length ?? 6}
			value={value ?? ""}
			onChange={(next) => {
				setValue(next)
				emit("change")
			}}
			containerClassName="flex items-center gap-1.5"
			render={({ slots }) => (
				<>
					{slots.map((slot, i) => (
						<div
							key={i}
							className={cn(
								"flex h-10 w-9 items-center justify-center rounded-md border text-sm font-medium shadow-sm",
								slot.isActive && "ring-2 ring-ring"
							)}
						>
							{slot.char}
						</div>
					))}
				</>
			)}
		/>
	)
}

export const definition = {
	props: z.object({
		value: z.string().nullable(),
		length: z.number().nullable(),
		name: z.string().nullable()
	}),
	events: ["change"],
	description:
		"One-time-code input — a row of single-character boxes. Bind `value` " +
		"with $bindState; `length` sets the number of boxes (default 6).",
	example: { name: "otp", length: 6 }
}

export const component = InputOTP
