/**
 * InputGroup — json-render catalog component. A text input flanked by a
 * prefix and/or suffix addon (currency symbol, unit, domain, icon glyph).
 * Self-contained — owns its own <input>. Registered via
 * src/components/custom/extras.ts.
 */
import { type BaseComponentProps, useBoundProp } from "@json-render/react"
import { z } from "zod"

interface InputGroupProps {
	value?: string | null
	prefix?: string | null
	suffix?: string | null
	placeholder?: string | null
	type?: "text" | "number" | "email" | "tel" | "url" | null
	name?: string | null
}

const ADDON = "flex shrink-0 select-none items-center bg-muted px-3 text-sm text-muted-foreground"

function InputGroup({ props, bindings, emit }: BaseComponentProps<InputGroupProps>) {
	const [value, setValue] = useBoundProp<string>(props.value ?? undefined, bindings?.value)
	return (
		<div className="flex h-9 w-full items-stretch overflow-hidden rounded-md border border-input bg-background shadow-sm focus-within:ring-2 focus-within:ring-ring">
			{props.prefix ? <span className={`${ADDON} border-r border-input`}>{props.prefix}</span> : null}
			<input
				type={props.type ?? "text"}
				name={props.name ?? undefined}
				value={value ?? ""}
				placeholder={props.placeholder ?? undefined}
				onChange={(e) => {
					setValue(e.target.value)
					emit("change")
				}}
				className="min-w-0 flex-1 bg-transparent px-3 py-1 text-sm outline-none placeholder:text-muted-foreground"
			/>
			{props.suffix ? <span className={`${ADDON} border-l border-input`}>{props.suffix}</span> : null}
		</div>
	)
}

export const definition = {
	props: z.object({
		value: z.string().nullable(),
		prefix: z.string().nullable(),
		suffix: z.string().nullable(),
		placeholder: z.string().nullable(),
		type: z.enum(["text", "number", "email", "tel", "url"]).nullable(),
		name: z.string().nullable()
	}),
	events: ["change"],
	description:
		"Text input with a `prefix` and/or `suffix` addon — e.g. a '$' prefix " +
		"for amounts, a '.com' suffix, or a unit label. Bind `value` with " +
		"$bindState. Self-contained: do not nest an Input inside it.",
	example: { name: "price", prefix: "$", placeholder: "0.00", type: "number" }
}

export const component = InputGroup
