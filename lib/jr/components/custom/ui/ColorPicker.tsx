/**
 * ColorPicker — json-render catalog component. A color value input: swatch
 * button with an invisible native input[type=color] overlaid (OS picker, free
 * a11y), a hex text field, and optional one-click preset swatches. Bound state
 * value is a normalized "#RRGGBB" hex string; the native input commits on
 * `change` (picker close), not on every drag, to avoid spamming state.
 * Registered via ./index.ts.
 */
import { type BaseComponentProps, useBoundProp } from "@json-render/react"
import { useEffect, useState } from "react"
import { z } from "zod"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

interface ColorPickerProps {
	value?: string | null
	label?: string | null
	presets?: string[] | null
	name?: string | null
	className?: string | null
}

const HEX_RE = /^#?([0-9a-fA-F]{6})$/

/** Normalize user hex input to "#rrggbb"; null when invalid. */
function normalizeHex(raw: string): string | null {
	const m = HEX_RE.exec(raw.trim())
	return m ? `#${m[1].toLowerCase()}` : null
}

function ColorPicker({ props, bindings, emit }: BaseComponentProps<ColorPickerProps>) {
	const [value, setValue] = useBoundProp<string>(props.value ?? "#000000", bindings?.value)
	const current = normalizeHex(value ?? "") ?? "#000000"
	const [draft, setDraft] = useState(current)

	// Keep the hex field in sync when the value changes from outside (native
	// picker, presets, bound state).
	useEffect(() => setDraft(current), [current])

	const commit = (raw: string) => {
		const hex = normalizeHex(raw)
		if (!hex) {
			setDraft(current) // revert invalid input
			return
		}
		setDraft(hex)
		if (hex !== current) {
			setValue(hex)
			emit("change")
		}
	}

	return (
		<div className={cn("space-y-1.5", props.className)}>
			{props.label && <Label>{props.label}</Label>}
			<div className="flex items-center gap-2">
				<span className="relative inline-flex size-9 shrink-0 overflow-hidden rounded-md border border-input shadow-xs">
					<span className="h-full w-full" style={{ backgroundColor: current }} />
					<input
						type="color"
						value={current}
						aria-label={props.label ?? props.name ?? "Color"}
						onChange={(e) => commit(e.target.value)}
						className="absolute inset-0 cursor-pointer opacity-0"
					/>
				</span>
				<input
					type="text"
					value={draft}
					aria-label="Hex color"
					spellCheck={false}
					onChange={(e) => setDraft(e.target.value)}
					onBlur={() => commit(draft)}
					onKeyDown={(e) => {
						if (e.key === "Enter") commit(draft)
					}}
					className="h-9 w-28 rounded-md border border-input bg-transparent px-3 font-mono text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
				/>
			</div>
			{props.presets && props.presets.length > 0 && (
				<div className="flex flex-wrap items-center gap-1.5">
					{props.presets.map((preset) => {
						const hex = normalizeHex(preset)
						if (!hex) return null
						return (
							<button
								key={preset}
								type="button"
								aria-label={`Use ${hex}`}
								onClick={() => commit(hex)}
								className={cn(
									"size-6 rounded-md border border-input transition-shadow hover:scale-105",
									hex === current && "ring-2 ring-ring ring-offset-1 ring-offset-background"
								)}
								style={{ backgroundColor: hex }}
							/>
						)
					})}
				</div>
			)}
		</div>
	)
}

export const definition = {
	props: z.object({
		value: z.string().nullable().describe("Hex color '#RRGGBB'. Bind with $bindState."),
		label: z.string().nullable(),
		presets: z.array(z.string()).nullable().describe("Preset hex swatches rendered as one-click buttons below."),
		name: z.string().nullable(),
		className: z.string().nullable()
	}),
	events: ["change"],
	description:
		"Color value input — native OS color picker behind a swatch, plus a hex text " +
		"field and optional preset swatches. Bind `value` with $bindState — a normalized " +
		"'#rrggbb' string.",
	example: {
		label: "Accent color",
		value: "#6d28d9",
		presets: ["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#6d28d9"]
	}
}

export const component = ColorPicker
