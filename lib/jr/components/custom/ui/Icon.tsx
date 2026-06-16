/**
 * Icon — json-render catalog component. A standalone lucide icon addressed by
 * kebab-case name ("circle-check", "trash-2"). Uses lucide-react/dynamic so
 * each icon is code-split and lazy-loaded — never `import * as` from
 * lucide-react (that pulls all ~1500 icons into the bundle). Unknown names
 * degrade to a size-matched empty placeholder instead of crashing, so LLM
 * typos in generated specs can't break a page. Registered via ./index.ts.
 */
import { type BaseComponentProps } from "@json-render/react"
import { DynamicIcon, iconNames, type IconName } from "lucide-react/dynamic"
import { z } from "zod"
import { cn } from "@/lib/utils"

interface IconProps {
	name: string
	size?: number | null
	color?: string | null
	strokeWidth?: number | null
	className?: string | null
}

const VALID_NAMES = new Set<string>(iconNames)

function Icon({ props }: BaseComponentProps<IconProps>) {
	const size = props.size ?? 16
	// Same-footprint placeholder — used both while the icon chunk loads and
	// when the name is unknown, so layout never shifts.
	const placeholder = (
		<span aria-hidden className={cn("inline-block shrink-0", props.className)} style={{ width: size, height: size }} />
	)

	if (!VALID_NAMES.has(props.name)) return placeholder

	return (
		<DynamicIcon
			name={props.name as IconName}
			size={size}
			color={props.color ?? "currentColor"}
			strokeWidth={props.strokeWidth ?? 2}
			className={cn("shrink-0", props.className)}
			fallback={() => placeholder}
		/>
	)
}

export const definition = {
	props: z.object({
		name: z
			.string()
			.describe("Lucide icon name in kebab-case, e.g. 'circle-check', 'arrow-right', 'trash-2'. See lucide.dev/icons."),
		size: z.number().nullable().describe("Square size in px (default 16)."),
		color: z.string().nullable().describe("CSS color, e.g. '#16a34a' or 'var(--primary)'. Default currentColor."),
		strokeWidth: z.number().nullable().describe("Stroke width (default 2)."),
		className: z.string().nullable()
	}),
	description:
		"Standalone lucide icon by kebab-case name. Use for decorative or semantic icons " +
		"next to text, in custom layouts, or anywhere a component doesn't already embed " +
		"one. Unknown names render an empty placeholder (never crash).",
	example: { name: "circle-check", size: 24, color: "#16a34a" }
}

export const component = Icon
