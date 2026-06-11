/**
 * MultiSelect — json-render catalog component. A generic tokenized multi-select:
 * a searchable dropdown (cmdk + Popover) whose chosen values render as removable
 * chips. The bound state value is an Array<string>. Fills the gap Combobox
 * leaves (Combobox is single-select). Domain-agnostic — use for tags, multi-
 * reference fields, any "pick several" input. Registered via ../ui/index.ts.
 */
import { type BaseComponentProps, useBoundProp } from "@json-render/react"
import * as PopoverPrimitive from "@radix-ui/react-popover"
import { Command } from "cmdk"
import { Check, ChevronsUpDown, X } from "lucide-react"
import { useMemo, useState } from "react"
import { z } from "zod"
import { cn } from "@/lib/utils"

type Option = string | { label: string; value: string }

interface MultiSelectProps {
	value?: string[] | null
	options: Option[]
	placeholder?: string | null
	name?: string | null
}

/** Coerce any incoming option to a `{label, value}` pair (mirrors Combobox). */
function normalize(opt: unknown): { label: string; value: string } | null {
	if (typeof opt === "string") return { label: opt, value: opt }
	if (opt == null || typeof opt !== "object") return null
	const rec = opt as Record<string, unknown>
	if (typeof rec.label === "string" && typeof rec.value === "string") {
		return { label: rec.label, value: rec.value }
	}
	const id = typeof rec._id === "string" ? rec._id : typeof rec.id === "string" ? rec.id : null
	return id == null ? null : { label: id, value: id }
}

function MultiSelect({ props, bindings, emit }: BaseComponentProps<MultiSelectProps>) {
	const [value, setValue] = useBoundProp<string[]>(props.value ?? [], bindings?.value)
	const [open, setOpen] = useState(false)
	const selected = value ?? []

	const options = useMemo(
		() =>
			(props.options ?? [])
				.map((o) => normalize(o as Option))
				.filter((o): o is { label: string; value: string } => o !== null),
		[props.options]
	)
	const labelFor = (v: string) => options.find((o) => o.value === v)?.label ?? v

	const toggle = (v: string) => {
		const next = selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]
		setValue(next)
		emit("change")
	}

	return (
		<PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
			<PopoverPrimitive.Trigger asChild>
				<button
					type="button"
					className="flex min-h-9 w-full flex-wrap items-center gap-1 rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
				>
					{selected.length === 0 ? (
						<span className="px-1 text-muted-foreground">{props.placeholder ?? "Select…"}</span>
					) : (
						selected.map((v) => (
							<span
								key={v}
								className="inline-flex items-center gap-1 rounded bg-secondary px-1.5 py-0.5 text-xs text-secondary-foreground"
							>
								{labelFor(v)}
								<X
									className="size-3 cursor-pointer opacity-60 hover:opacity-100"
									onClick={(e) => {
										e.stopPropagation()
										toggle(v)
									}}
								/>
							</span>
						))
					)}
					<ChevronsUpDown className="ml-auto size-4 shrink-0 opacity-50" />
				</button>
			</PopoverPrimitive.Trigger>
			<PopoverPrimitive.Portal>
				<PopoverPrimitive.Content
					align="start"
					sideOffset={4}
					className="z-50 w-[var(--radix-popover-trigger-width)] rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
				>
					<Command>
						<Command.Input
							placeholder="Search…"
							className="w-full rounded-sm bg-transparent px-2 py-1.5 text-sm outline-none"
						/>
						<Command.List className="max-h-60 overflow-auto">
							<Command.Empty className="px-2 py-3 text-center text-sm text-muted-foreground">No results.</Command.Empty>
							{options.map((o) => {
								const on = selected.includes(o.value)
								return (
									<Command.Item
										key={o.value}
										value={o.label}
										onSelect={() => toggle(o.value)}
										className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm aria-selected:bg-accent aria-selected:text-accent-foreground"
									>
										<Check className={cn("size-4", on ? "opacity-100" : "opacity-0")} />
										{o.label}
									</Command.Item>
								)
							})}
						</Command.List>
					</Command>
				</PopoverPrimitive.Content>
			</PopoverPrimitive.Portal>
		</PopoverPrimitive.Root>
	)
}

export const definition = {
	props: z.object({
		value: z.array(z.string()).nullable().describe("Selected values. Bind with $bindState — commits as Array<string>."),
		options: z
			.array(z.union([z.string(), z.object({ label: z.string(), value: z.string() })]))
			.describe("Array<string> for fixed lists, or Array<{label,value}> for keyed options."),
		placeholder: z.string().nullable(),
		name: z.string().nullable()
	}),
	events: ["change"],
	description:
		"Tokenized multi-select — a searchable dropdown whose chosen values show as " +
		"removable chips. Bind `value` with $bindState; it holds an Array<string>. " +
		"Use for tags, multi-reference fields, or any 'pick several' input. For a " +
		"single choice use Combobox instead.",
	example: {
		options: ["Design", "Engineering", "Sales", "Support"],
		value: ["Design", "Sales"],
		placeholder: "Add teams"
	}
}

export const component = MultiSelect
