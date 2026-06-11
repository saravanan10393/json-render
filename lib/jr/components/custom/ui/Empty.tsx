/**
 * Empty — json-render catalog component. Empty-state placeholder for a list or
 * table with no rows. Accepts a single call-to-action Button as its child.
 * Registered via src/components/custom/extras.ts.
 */
import type { BaseComponentProps } from "@json-render/react"
import { z } from "zod"

interface EmptyProps {
	title: string
	description?: string | null
}

function Empty({ props, children }: BaseComponentProps<EmptyProps>) {
	return (
		<div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
			<h3 className="text-base font-medium text-foreground">{props.title}</h3>
			{props.description ? <p className="max-w-sm text-sm text-muted-foreground">{props.description}</p> : null}
			{children ? <div className="mt-2">{children}</div> : null}
		</div>
	)
}

export const definition = {
	props: z.object({
		title: z.string(),
		description: z.string().nullable()
	}),
	slots: ["default"],
	description:
		"Empty-state placeholder for a list or table with no rows. Shows a title " +
		"+ optional description; place a single call-to-action Button as its child.",
	example: {
		title: "No orders yet",
		description: "Your orders will show up here once you place one."
	}
}

export const component = Empty
