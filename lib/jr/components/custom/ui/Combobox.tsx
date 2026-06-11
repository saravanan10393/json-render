/**
 * Combobox — json-render catalog component. A searchable single-select
 * dropdown (cmdk + Popover). Registered via src/components/custom/extras.ts.
 *
 * Accepts EITHER `Array<string>` (the legacy shape, used for fixed option
 * lists like currencies) OR `Array<{label, value}>` (for reference-field
 * dropdowns — the host derives this from BDO records via
 * `state.<BDO>__options`). The component normalises both shapes before
 * rendering so the LLM can pick whichever is easier per use case.
 */
import { type BaseComponentProps, useBoundProp } from "@json-render/react"
import * as PopoverPrimitive from "@radix-ui/react-popover"
import { Command } from "cmdk"
import { Check, ChevronsUpDown } from "lucide-react"
import { useMemo, useState } from "react"
import { z } from "zod"

/** Option shape accepted by the Combobox. Either a bare string (label === value)
 *  or an explicit `{label, value}` pair — the host's BDO option derivation in
 *  `actions.ts:toComboboxOptions` emits the latter. */
type ComboboxOption = string | { label: string; value: string }

interface ComboboxProps {
	value?: string | null
	options: ComboboxOption[]
	placeholder?: string | null
	name?: string | null
	labelKey?: string | null
}

/** Coerce any incoming option to a `{label, value}` pair we can render.
 *
 *  Accepts three shapes — the LLM is free to bind options to any of these
 *  and the Combobox just works:
 *   1. `string` — used for fixed lists like ["USD","EUR"].
 *   2. `{label, value}` — the canonical shape.
 *   3. **Raw BDO record** — `state.<BDO>` records straight from
 *      `bdo.<BDO>.list()`. Salvages `_id` as both the option value and label. */
function normalize(opt: unknown, labelKey?: string | null): { label: string; value: string } | null {
	if (typeof opt === "string") return { label: opt, value: opt }
	if (opt == null || typeof opt !== "object") return null
	const rec = opt as Record<string, unknown>
	// Canonical {label, value} pair — pass through.
	if (typeof rec.label === "string" && typeof rec.value === "string") {
		return { label: rec.label, value: rec.value }
	}
	// Raw BDO record — salvage `_id` (or `id`) as both the value and the label.
	// Returning null for records with neither means the dropdown silently skips
	// garbage rows instead of rendering "undefined".
	const id = typeof rec._id === "string" ? rec._id : typeof rec.id === "string" ? rec.id : null
	if (id == null) return null
	const label = labelKey && typeof rec[labelKey] === "string" ? (rec[labelKey] as string) : id
	return { label, value: id }
}

function Combobox({ props, bindings, emit }: BaseComponentProps<ComboboxProps>) {
	const [value, setValue] = useBoundProp<string>(props.value ?? undefined, bindings?.value)
	const [open, setOpen] = useState(false)
	// Normalise once per options change; lookup by value below stays cheap.
	// Filter out nulls (records with no salvageable label/value) so the dropdown
	// never renders the literal string "undefined".
	const options = useMemo(
		() =>
			(props.options ?? [])
				.map((o) => normalize(o as ComboboxOption, props.labelKey))
				.filter((o): o is { label: string; value: string } => o !== null),
		[props.options, props.labelKey]
	)
	// Find the label for the currently-selected value — needed because we now
	// store the underlying id (e.g. _id) while displaying the human label.
	const selectedLabel = useMemo(
		() => (value ? (options.find((o) => o.value === value)?.label ?? value) : ""),
		[value, options]
	)
	return (
		<PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
			<PopoverPrimitive.Trigger className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
				<span className={value ? "text-foreground" : "text-muted-foreground"}>
					{selectedLabel || props.placeholder || "Select…"}
				</span>
				<ChevronsUpDown aria-hidden className="size-4 shrink-0 text-muted-foreground" />
			</PopoverPrimitive.Trigger>
			<PopoverPrimitive.Portal>
				<PopoverPrimitive.Content
					align="start"
					sideOffset={4}
					className="z-50 w-[var(--radix-popover-trigger-width)] overflow-hidden rounded-md border bg-popover p-0 text-popover-foreground shadow-md"
				>
					<Command>
						<Command.Input
							placeholder="Search…"
							className="w-full border-b border-border bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground"
						/>
						<Command.List className="max-h-56 overflow-y-auto p-1">
							<Command.Empty className="px-3 py-4 text-center text-sm text-muted-foreground">No results.</Command.Empty>
							{options.map((opt) => (
								<Command.Item
									key={opt.value}
									// cmdk filters / matches on `value`; we want to match against
									// the visible label so users can type the human name (e.g.
									// "Electronics") rather than the underlying id. Internally
									// we still store `value` on selection.
									value={opt.label}
									onSelect={() => {
										setValue(opt.value)
										emit("change")
										setOpen(false)
									}}
									className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
								>
									<Check aria-hidden className={`size-4 ${value === opt.value ? "opacity-100" : "opacity-0"}`} />
									{opt.label}
								</Command.Item>
							))}
						</Command.List>
					</Command>
				</PopoverPrimitive.Content>
			</PopoverPrimitive.Portal>
		</PopoverPrimitive.Root>
	)
}

export const definition = {
	props: z.object({
		value: z.string().nullable(),
		// Accept either string options (for fixed lists like ["USD","EUR"]) or
		// {label, value} pairs (for reference-field dropdowns populated from
		// `state.<BDO>__options` by the host).
		options: z.array(z.union([z.string(), z.object({ label: z.string(), value: z.string() })])),
		placeholder: z.string().nullable(),
		name: z.string().nullable(),
		labelKey: z.string().nullable().describe("When options are raw BDO records (bound from a bdo.list datasource), the field id to show as the label; the stored value is the record _id.")
	}),
	events: ["change"],
	description:
		"Searchable single-select dropdown. Bind `value` with $bindState; " +
		"`options` accepts either Array<string> (fixed lists) or " +
		"Array<{label,value}> — bind to `state.<BDO>__options` for a reference-" +
		"field dropdown populated by the host. The `value` written back to state " +
		"is the option's `value` field (e.g. `_id`); the label is what the user " +
		"sees and searches. Use for Reference fields or long option lists; for " +
		"2-7 fixed options use Select." +
		" Bind options straight to {$datasource: \"<listDs>/data\"} and set labelKey for an entity-reference picker.",
	example: {
		name: "country",
		options: ["United States", "Canada", "Mexico"],
		placeholder: "Select a country"
	}
}

export const component = Combobox
