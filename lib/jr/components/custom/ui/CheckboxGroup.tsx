/**
 * CheckboxGroup — json-render catalog component. A vertical (or multi-column)
 * list of checkboxes whose checked values commit as an Array<string>. The
 * multi-select facet control for filter sidebars and "pick several from a
 * visible list" forms — the flat-list counterpart of MultiSelect (which hides
 * options behind a dropdown). Options may carry a `count` (e.g. result counts
 * next to each facet value). Bind `value` with $bindState. Registered via
 * ../ui/index.ts.
 */
import { type BaseComponentProps, useBoundProp } from "@json-render/react"
import { z } from "zod"
import { cn } from "@/lib/utils"

type Option = string | { label: string; value: string; count?: number | null }

interface CheckboxGroupProps {
	value?: string[] | null
	options: Option[]
	label?: string | null
	columns?: number | null
	name?: string | null
	className?: string | null
}

function normalize(opt: Option): { label: string; value: string; count: number | null } {
	if (typeof opt === "string") return { label: opt, value: opt, count: null }
	return { label: opt.label, value: opt.value, count: opt.count ?? null }
}

function CheckboxGroup({ props, bindings, emit }: BaseComponentProps<CheckboxGroupProps>) {
	const [value, setValue] = useBoundProp<string[]>(props.value ?? [], bindings?.value)
	const selected = value ?? []
	const options = (props.options ?? []).map(normalize)
	const cols = Math.max(1, Math.min(4, props.columns ?? 1))

	const toggle = (v: string) => {
		setValue(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v])
		emit("change")
	}

	return (
		<div className={cn("flex flex-col gap-1.5", props.className)}>
			{props.label && <span className="text-sm font-medium">{props.label}</span>}
			<div className={cn("grid gap-1.5", cols === 1 ? "grid-cols-1" : cols === 2 ? "grid-cols-2" : cols === 3 ? "grid-cols-3" : "grid-cols-4")}>
				{options.map((o) => {
					const on = selected.includes(o.value)
					return (
						<label
							key={o.value}
							className="inline-flex cursor-pointer items-center gap-2 text-sm text-foreground"
						>
							<input
								type="checkbox"
								checked={on}
								onChange={() => toggle(o.value)}
								className="size-4 shrink-0 rounded border-border accent-primary"
							/>
							<span className="flex-1 truncate">{o.label}</span>
							{o.count != null && <span className="text-xs text-muted-foreground tabular-nums">{o.count}</span>}
						</label>
					)
				})}
			</div>
		</div>
	)
}

export const definition = {
	props: z.object({
		value: z.array(z.string()).nullable().describe("Checked values. Bind with $bindState — commits as Array<string>."),
		options: z
			.array(
				z.union([
					z.string(),
					z.object({ label: z.string(), value: z.string(), count: z.number().nullable() }),
				]),
			)
			.describe("Array<string>, or Array<{label,value,count}> to show a result count beside each option."),
		label: z.string().nullable(),
		columns: z.number().nullable().describe("Lay the checkboxes out in N columns (default 1)."),
		name: z.string().nullable(),
		className: z.string().nullable(),
	}),
	events: ["change"],
	description:
		"A vertical list of checkboxes committing an Array<string> — the multi-select facet " +
		"control for filter sidebars and visible 'pick several' lists. Each option can show a " +
		"`count`. Bind `value` with $bindState. For a dropdown use MultiSelect; for one choice use Radio.",
	example: {
		label: "Category",
		options: ["Audio", "Wearables", "Accessories"],
		value: ["Audio"],
	},
}

export const component = CheckboxGroup
