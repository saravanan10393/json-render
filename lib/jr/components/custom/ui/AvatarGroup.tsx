/**
 * AvatarGroup — json-render catalog component. A row of overlapping avatars (an
 * attendee / member / collaborator stack). Overlapped by default; on hover the
 * whole group spreads apart so every face is revealed. Each avatar carries a
 * background-coloured ring, so the discs read as cleanly separated even when the
 * fallbacks are identical-looking initials. An optional `max` caps the visible
 * count and appends a "+N" overflow chip. This is the dedicated primitive for
 * the avatar-stack pattern — no -space-x hand-composition needed. Registered via
 * ../ui/index.ts.
 */
import type { BaseComponentProps } from "@json-render/react"
import { z } from "zod"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

type Size = "sm" | "md" | "lg"

interface Person {
	name: string
	src?: string | null
}

interface AvatarGroupProps {
	people: Person[]
	size?: Size | null
	max?: number | null
	className?: string | null
}

const SIZE: Record<Size, string> = {
	sm: "size-8 text-xs",
	md: "size-10 text-sm",
	lg: "size-12 text-base"
}

function initials(name: string): string {
	return name
		.split(" ")
		.map((n) => n[0] ?? "")
		.join("")
		.slice(0, 2)
		.toUpperCase()
}

function AvatarGroup({ props }: BaseComponentProps<AvatarGroupProps>) {
	const people = props.people ?? []
	const size = props.size ?? "sm"
	const sizeClass = SIZE[size]
	const max = props.max ?? people.length
	const shown = people.slice(0, max)
	const overflow = people.length - shown.length
	// Overlapped by default (-ml), spread to a small gap on group hover.
	const stackClass = "-ml-3 transition-[margin] duration-200 ease-out group-hover/ag:ml-0.5"

	return (
		<div className={cn("group/ag flex items-center", props.className)}>
			{shown.map((p, i) => (
				<Avatar
					key={`${p.name}-${i}`}
					title={p.name}
					className={cn(sizeClass, "ring-2 ring-background", i > 0 && stackClass)}
				>
					{p.src ? <AvatarImage src={p.src} alt={p.name} /> : null}
					<AvatarFallback className="text-inherit">{initials(p.name)}</AvatarFallback>
				</Avatar>
			))}
			{overflow > 0 ? (
				<span
					className={cn(
						sizeClass,
						"ring-2 ring-background",
						stackClass,
						"inline-flex items-center justify-center rounded-full bg-muted font-medium text-muted-foreground"
					)}
				>
					+{overflow}
				</span>
			) : null}
		</div>
	)
}

export const definition = {
	props: z.object({
		people: z
			.array(z.object({ name: z.string(), src: z.string().nullable() }))
			.describe("The people in the stack, front-to-back. Each is { name, src? } — src is an optional image URL."),
		size: z.enum(["sm", "md", "lg"]).nullable().describe("Avatar diameter. Defaults to sm."),
		max: z
			.number()
			.nullable()
			.describe("Cap the visible avatars; the remainder collapse into a trailing '+N' chip."),
		className: z.string().nullable()
	}),
	description:
		"A row of overlapping avatars (an attendee / member stack). Overlapped by " +
		"default; the group spreads apart on hover to reveal every face. Pass " +
		"`people` as { name, src? } objects; `max` caps the visible count and adds a " +
		"'+N' overflow chip. Use this instead of hand-stacking Avatars with -space-x.",
	example: {
		people: [
			{ name: "Jane Doe" },
			{ name: "John Smith" },
			{ name: "Bella White" },
			{ name: "Mark Jones" },
			{ name: "Sara Day" }
		],
		max: 4
	}
}

export const component = AvatarGroup
