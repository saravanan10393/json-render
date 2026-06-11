/**
 * Rating — json-render catalog component. A generic rating widget. The glyph is
 * NOT hardcoded: by default it fills a repeated `symbol` (★), but the spec author
 * can override the symbol (❤️, 👍, 🔥) or pass a set of distinct `icons` for a
 * mood/scale picker (😡 → 🤩). Two modes from one rule:
 *
 *   - `icons` given   → single-pick: each position is its own glyph, only the
 *                       chosen one is emphasised (a mood / CSAT scale).
 *   - otherwise       → cumulative fill of `symbol`: positions 1..value lit, the
 *                       rest dimmed (the classic "N of 5 stars" shape).
 *
 * `value` binds via $bindState (a number, 1..max; 0 = unrated). `readOnly` makes
 * it display-only (e.g. showing an average). Registered via ../ui/index.ts.
 */
import { type BaseComponentProps, useBoundProp } from "@json-render/react"
import { z } from "zod"
import { cn } from "@/lib/utils"

interface RatingProps {
	value?: number | null
	max?: number | null
	symbol?: string | null
	icons?: string[] | null
	readOnly?: boolean | null
	name?: string | null
}

function Rating({ props, bindings, emit }: BaseComponentProps<RatingProps>) {
	const [value, setValue] = useBoundProp<number>(props.value ?? 0, bindings?.value)
	const current = value ?? 0

	// Distinct icons → single-pick mood scale; else repeat `symbol` cumulatively.
	const distinct = Array.isArray(props.icons) && props.icons.length > 0
	const glyphs = distinct
		? (props.icons as string[])
		: Array.from({ length: props.max ?? 5 }, () => props.symbol ?? "★")
	const readOnly = props.readOnly ?? false

	const pick = (i: number) => {
		if (readOnly) return
		const next = i + 1
		setValue(next === current ? 0 : next) // click the active one again to clear
		emit("change")
	}

	return (
		<div role="radiogroup" aria-label={props.name ?? "Rating"} className="inline-flex items-center gap-1">
			{glyphs.map((glyph, i) => {
				// Cumulative fill highlights 1..value; mood scale highlights only the pick.
				const active = distinct ? i + 1 === current : i + 1 <= current
				return (
					<button
						key={i}
						type="button"
						role="radio"
						aria-checked={i + 1 === current}
						disabled={readOnly}
						onClick={() => pick(i)}
						className={cn(
							"text-xl leading-none transition-transform",
							!readOnly && "cursor-pointer hover:scale-110",
							readOnly && "cursor-default",
							active ? "opacity-100 grayscale-0" : "opacity-40 grayscale"
						)}
					>
						{glyph}
					</button>
				)
			})}
		</div>
	)
}

export const definition = {
	props: z.object({
		value: z.number().nullable().describe("Current rating 1..max (0 = unrated). Bind with $bindState."),
		max: z.number().nullable().describe("Number of positions (default 5). Ignored when `icons` is given."),
		symbol: z
			.string()
			.nullable()
			.describe("Uniform glyph to repeat — default '★'. Use any emoji (❤️, 👍, 🔥) for a fill-style rating."),
		icons: z
			.array(z.string())
			.nullable()
			.describe(
				"Distinct glyph per position, e.g. ['😡','😐','🤩'] — turns it into a single-pick mood/scale picker; overrides symbol+max."
			),
		readOnly: z.boolean().nullable().describe("Display-only (no clicking) — e.g. showing an average score."),
		name: z.string().nullable()
	}),
	events: ["change"],
	description:
		"A rating widget. The glyph is configurable, not hardcoded: it fills a repeated " +
		"`symbol` (default ★ — override with any emoji) cumulatively, OR pass distinct " +
		"`icons` for a single-pick mood/scale (😡→🤩). Bind `value` with $bindState (a " +
		"number); set `readOnly` for display-only.",
	example: { value: 4, max: 5, symbol: "★" }
}

export const component = Rating
