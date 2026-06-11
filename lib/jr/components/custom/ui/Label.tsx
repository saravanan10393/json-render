/**
 * Label — json-render catalog component. A caption for a form control.
 * Registered via src/components/custom/extras.ts.
 */
import type { BaseComponentProps } from "@json-render/react"
import * as LabelPrimitive from "@radix-ui/react-label"
import { z } from "zod"

interface LabelProps {
	text: string
	htmlFor?: string | null
}

function Label({ props }: BaseComponentProps<LabelProps>) {
	return (
		<LabelPrimitive.Root
			htmlFor={props.htmlFor ?? undefined}
			className="text-sm font-medium leading-none text-foreground peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
		>
			{props.text}
		</LabelPrimitive.Root>
	)
}

export const definition = {
	props: z.object({
		text: z.string(),
		htmlFor: z.string().nullable()
	}),
	events: [],
	description:
		"Caption for a form control. `htmlFor` may point at the control's id so " +
		"clicking the label focuses it. For a full label + control + help-text " +
		"row, prefer Field, which wraps the control in its slot.",
	example: { text: "Email address" }
}

export const component = Label
