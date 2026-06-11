/**
 * Kbd — json-render catalog component. Displays a keyboard shortcut.
 * Registered via src/components/custom/extras.ts.
 */
import type { BaseComponentProps } from "@json-render/react"
import { z } from "zod"

interface KbdProps {
	keys: string[]
}

function Kbd({ props }: BaseComponentProps<KbdProps>) {
	return (
		<span className="inline-flex items-center gap-1">
			{(props.keys ?? []).map((key, i) => (
				<kbd
					key={`${key}-${i}`}
					className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground"
				>
					{key}
				</kbd>
			))}
		</span>
	)
}

export const definition = {
	props: z.object({ keys: z.array(z.string()) }),
	events: [],
	description: "Keyboard shortcut display. `keys` is an array of key labels, e.g. " + "['Ctrl', 'K'].",
	example: { keys: ["Ctrl", "K"] }
}

export const component = Kbd
