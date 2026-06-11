/**
 * AspectRatio — json-render catalog component. Constrains its child (typically
 * an Image) to a fixed width:height ratio. Registered via
 * src/components/custom/extras.ts.
 */
import type { BaseComponentProps } from "@json-render/react"
import { z } from "zod"

interface AspectRatioProps {
	ratio?: number | null
}

function AspectRatio({ props, children }: BaseComponentProps<AspectRatioProps>) {
	return (
		<div className="overflow-hidden" style={{ aspectRatio: props.ratio ?? 16 / 9 }}>
			{children}
		</div>
	)
}

export const definition = {
	props: z.object({ ratio: z.number().nullable() }),
	slots: ["default"],
	description:
		"Constrains its child (typically an Image) to a fixed width:height " +
		"ratio. `ratio` is width/height, e.g. 1.777 for 16:9, 1 for square.",
	example: { ratio: 1.777 }
}

export const component = AspectRatio
