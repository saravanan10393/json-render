/**
 * TagInput — json-render catalog component. Free-form tag entry: the user
 * TYPES arbitrary values committed as chips (Enter/comma; Backspace on empty
 * pops the last; blur commits pending text). This is the open-vocabulary
 * counterpart of MultiSelect, which only picks from a fixed `options` list.
 * Bound state value is an Array<string>. Registered via ./index.ts.
 */
import { type BaseComponentProps, useBoundProp } from "@json-render/react"
import { X } from "lucide-react"
import { useState, type KeyboardEvent } from "react"
import { z } from "zod"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

interface TagInputProps {
	value?: string[] | null
	label?: string | null
	placeholder?: string | null
	max?: number | null
	allowDuplicates?: boolean | null
	name?: string | null
	className?: string | null
}

function TagInput({ props, bindings, emit }: BaseComponentProps<TagInputProps>) {
	const [value, setValue] = useBoundProp<string[]>(props.value ?? [], bindings?.value)
	const [draft, setDraft] = useState("")
	const tags = value ?? []
	const atMax = props.max != null && tags.length >= props.max

	const commit = (raw: string) => {
		const tag = raw.trim()
		if (!tag || atMax) return
		if (!(props.allowDuplicates ?? false) && tags.includes(tag)) {
			setDraft("")
			return
		}
		setValue([...tags, tag])
		setDraft("")
		emit("change")
	}

	const remove = (i: number) => {
		setValue(tags.filter((_, idx) => idx !== i))
		emit("change")
	}

	const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter" || e.key === ",") {
			e.preventDefault()
			commit(draft)
		} else if (e.key === "Backspace" && draft === "" && tags.length > 0) {
			remove(tags.length - 1)
		}
	}

	return (
		<div className={cn("space-y-1.5", props.className)}>
			{props.label && <Label>{props.label}</Label>}
			<div className="flex min-h-9 w-full flex-wrap items-center gap-1 rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-xs focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
				{tags.map((tag, i) => (
					<span
						key={`${tag}-${i}`}
						className="inline-flex items-center gap-1 rounded bg-secondary px-1.5 py-0.5 text-xs text-secondary-foreground"
					>
						{tag}
						<X
							className="size-3 cursor-pointer opacity-60 hover:opacity-100"
							onClick={() => remove(i)}
							aria-label={`Remove ${tag}`}
						/>
					</span>
				))}
				<input
					type="text"
					value={draft}
					disabled={atMax}
					aria-label={props.label ?? props.name ?? "Tags"}
					placeholder={tags.length === 0 ? (props.placeholder ?? "Add tag…") : ""}
					onChange={(e) => setDraft(e.target.value)}
					onKeyDown={onKeyDown}
					onFocus={() => emit("focus")}
					onBlur={() => {
						commit(draft)
						emit("blur")
					}}
					className="min-w-20 flex-1 bg-transparent px-1 py-0.5 outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
				/>
			</div>
		</div>
	)
}

export const definition = {
	props: z.object({
		value: z.array(z.string()).nullable().describe("Current tags. Bind with $bindState — commits as Array<string>."),
		label: z.string().nullable(),
		placeholder: z.string().nullable().describe("Hint shown when empty (default 'Add tag…')."),
		max: z.number().nullable().describe("Maximum number of tags; input disables when reached."),
		allowDuplicates: z.boolean().nullable().describe("Permit the same tag twice (default false)."),
		name: z.string().nullable(),
		className: z.string().nullable()
	}),
	events: ["change", "focus", "blur"],
	description:
		"Free-form tag entry — the user TYPES arbitrary values that commit as removable " +
		"chips (Enter/comma). Bind `value` with $bindState (Array<string>). Use for tags, " +
		"keywords, emails, any open vocabulary. To pick several from a FIXED option list " +
		"use MultiSelect instead.",
	example: { label: "Tags", value: ["urgent", "billing"], placeholder: "Add tag…" }
}

export const component = TagInput
