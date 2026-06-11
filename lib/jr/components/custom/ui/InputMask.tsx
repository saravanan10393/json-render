/**
 * InputMask — json-render catalog component. A text input that formats as you
 * type against a fixed `mask` pattern (dates, phone numbers, card numbers, …).
 * The mask is a template of placeholder tokens and literals:
 *
 *   #  → a digit   (0-9)
 *   A  → a letter  (a-z, A-Z)
 *   *  → digit OR letter
 *   anything else  → a literal that is auto-inserted (/, -, (, ), space, …)
 *
 * e.g. `##/##/####` → 12/31/2026, `(###) ###-####` → (415) 555-0142,
 * `#### #### #### ####` → a card number. The bound `value` holds the *formatted*
 * string (what the user sees). Bind it with $bindState. Registered via ./index.ts.
 */
import { type BaseComponentProps, useBoundProp } from "@json-render/react"
import type { ChangeEvent } from "react"
import { z } from "zod"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

interface InputMaskProps {
	label?: string | null
	mask: string
	placeholder?: string | null
	value?: string | null
	name?: string | null
}

const isDigit = (c: string) => c >= "0" && c <= "9"
const isLetter = (c: string) => /[a-z]/i.test(c)

/** Token → does the raw char belong here? null means the slot is a literal. */
function accepts(token: string, c: string): boolean | null {
	if (token === "#") return isDigit(c)
	if (token === "A") return isLetter(c)
	if (token === "*") return isDigit(c) || isLetter(c)
	return null
}

/**
 * Walk the mask, consuming raw (already-stripped of formatting) characters into
 * placeholder slots and auto-emitting literals. Stops once the mask is full or
 * the raw input runs out. Literals only emit when there's more real input to
 * place after them, so a half-typed value doesn't show trailing separators.
 */
function applyMask(mask: string, raw: string): string {
	let out = ""
	let ri = 0
	for (let mi = 0; mi < mask.length; mi++) {
		const token = mask[mi]
		const want = accepts(token, raw[ri] ?? "")
		if (want === null) {
			// Literal — only emit it if real input still follows.
			if (ri >= raw.length) break
			out += token
			continue
		}
		// Skip raw chars that don't fit this slot (e.g. a letter typed into a #).
		while (ri < raw.length && !accepts(token, raw[ri])) ri++
		if (ri >= raw.length) break
		out += raw[ri]
		ri++
	}
	return out
}

/** Strip every char that the mask would auto-insert, leaving only real input. */
function unmask(mask: string, formatted: string): string {
	const literals = new Set<string>()
	for (const t of mask) if (accepts(t, "x") === null) literals.add(t)
	let raw = ""
	for (const c of formatted) if (!literals.has(c)) raw += c
	return raw
}

/**
 * The still-empty tail of the mask, with placeholder tokens rendered as `_` and
 * literals kept verbatim — e.g. value "4111" against "#### #### …" → " ____ …".
 * Shown ghosted behind the typed text so the field always reads as a mask.
 */
function guideRemainder(mask: string, value: string): string {
	let out = ""
	for (let i = value.length; i < mask.length; i++) {
		const t = mask[i]
		out += accepts(t, "x") === null ? t : "_"
	}
	return out
}

function InputMask({ props, bindings, emit }: BaseComponentProps<InputMaskProps>) {
	const [value, setValue] = useBoundProp<string>(props.value ?? "", bindings?.value)
	const mask = props.mask ?? ""

	const onChange = (e: ChangeEvent<HTMLInputElement>) => {
		const next = applyMask(mask, unmask(mask, e.target.value))
		setValue(next)
		emit("change")
	}

	const shown = value ?? ""
	const remainder = guideRemainder(mask, shown)

	return (
		<div className={cn("grid gap-1.5", props.label && "w-full")}>
			{props.label && <Label>{props.label}</Label>}
			<div className="relative">
				{/* Ghost guide: typed chars reserve width (transparent), the rest of the
				    mask shows muted — so the field always reads as a `____` template.
				    Mirrors the shadcn Input box model so it lines up exactly. */}
				<div
					aria-hidden
					className="pointer-events-none absolute inset-0 flex items-center whitespace-pre border border-transparent px-3 py-1 font-mono text-base text-muted-foreground/50 md:text-sm"
				>
					<span className="invisible">{shown}</span>
					{remainder}
				</div>
				<Input
					type="text"
					inputMode={/^[#\s()/-]+$/.test(mask) ? "numeric" : "text"}
					value={shown}
					onChange={onChange}
					onFocus={() => emit("focus")}
					onBlur={() => emit("blur")}
					className="relative bg-transparent font-mono"
				/>
			</div>
		</div>
	)
}

export const definition = {
	props: z.object({
		label: z.string().nullable(),
		mask: z
			.string()
			.describe(
				"Mask template. Tokens: '#' = digit, 'A' = letter, '*' = digit or letter; " +
					"every other char is a literal auto-inserted as you type (e.g. '##/##/####', " +
					"'(###) ###-####', '#### #### #### ####')."
			),
		placeholder: z.string().nullable().describe("Placeholder — defaults to the mask itself if omitted."),
		value: z.string().nullable().describe("The formatted value. Bind with $bindState."),
		name: z.string().nullable()
	}),
	events: ["change", "focus", "blur"],
	description:
		"A text input that formats as you type against a fixed `mask` (dates, phone " +
		"numbers, card numbers). Tokens: '#' digit, 'A' letter, '*' alphanumeric; any " +
		"other char is a literal that's auto-inserted. The bound `value` holds the " +
		"formatted string — bind it with $bindState. For ad-hoc state; for record forms use Form/Field.",
	example: { label: "Expiry", mask: "##/##" }
}

export const component = InputMask
