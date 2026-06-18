/**
 * SwatchGroup — a single-select option picker for product variants. Two shapes
 * from one `swatch` flag: color squares (swatch=true → each option is a CSS
 * color) or text chips (swatch=false → sizes, materials, etc.). Binds a single
 * string `value` (the chosen option). The flat sibling of a radio group, built
 * for PDP color/size selection. Registered via ./index.ts.
 */
import { type BaseComponentProps, useBoundProp } from "@json-render/react"
import { Check } from "lucide-react"
import { z } from "zod"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

interface SwatchGroupProps {
	value?: string | null
	options: string[]
	swatch?: boolean | null
	label?: string | null
	name?: string | null
	className?: string | null
}

function SwatchGroup({ props, bindings, emit }: BaseComponentProps<SwatchGroupProps>) {
	const [value, setValue] = useBoundProp<string>(props.value ?? "", bindings?.value)
	const options = Array.isArray(props.options) ? props.options : []
	const swatch = props.swatch ?? false

	const pick = (v: string) => {
		setValue(v)
		emit("change")
	}

	return (
		<div className={cn("space-y-1.5", props.className)}>
			{props.label && <Label>{props.label}</Label>}
			<div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label={props.label ?? props.name ?? "Options"}>
				{options.map((opt) => {
					const active = value === opt
					if (swatch) {
						return (
							<button
								key={opt}
								type="button"
								role="radio"
								aria-checked={active}
								aria-label={opt}
								title={opt}
								onClick={() => pick(opt)}
								className={cn(
									"relative inline-flex size-7 items-center justify-center rounded-full border border-border/60 transition-transform hover:scale-110",
									active && "ring-2 ring-ring ring-offset-2 ring-offset-background"
								)}
								style={{ backgroundColor: opt }}
							>
								{active && <Check className="size-3.5 text-white drop-shadow" />}
							</button>
						)
					}
					return (
						<button
							key={opt}
							type="button"
							role="radio"
							aria-checked={active}
							onClick={() => pick(opt)}
							className={cn(
								"min-w-9 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
								active
									? "border-primary bg-primary/10 text-foreground"
									: "border-input text-muted-foreground hover:border-foreground/30 hover:text-foreground"
							)}
						>
							{opt}
						</button>
					)
				})}
			</div>
		</div>
	)
}

export const definition = {
	props: z.object({
		value: z.string().nullable().describe("Selected option. Bind with $bindState (single-select)."),
		options: z
			.array(z.string())
			.describe("Option values. With swatch=true each must be a CSS color (e.g. '#1f2937'); otherwise free text (e.g. 'M')."),
		swatch: z.boolean().nullable().describe("true → render color squares (colors); false → text chips (sizes). Default false."),
		label: z.string().nullable(),
		name: z.string().nullable(),
		className: z.string().nullable()
	}),
	events: ["change"],
	description:
		"Single-select variant picker — color swatches (swatch=true, options are CSS colors) or text chips " +
		"(sizes/materials). Binds one string `value`. Use for PDP color/size selection.",
	example: { label: "Color", swatch: true, options: ["#1f2937", "#b91c1c", "#1d4ed8"], value: "#1f2937" }
}

export const component = SwatchGroup
