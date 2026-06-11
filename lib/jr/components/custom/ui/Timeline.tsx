/**
 * Timeline — json-render catalog component. A generic vertical sequence of
 * events: each item is a dot on a connecting line with a title, optional
 * timestamp, and optional description. Domain-agnostic — use for activity
 * feeds, audit logs, status history, comment threads. Registered via ../ui/index.ts.
 */
import type { BaseComponentProps } from "@json-render/react"
import { z } from "zod"
import { cn } from "@/lib/utils"

type Status = "default" | "success" | "warning" | "error"

interface TimelineItem {
	title: string
	description?: string | null
	timestamp?: string | null
	status?: Status | null
}

interface TimelineProps {
	items: TimelineItem[]
	className?: string | null
}

const DOT_CLASS: Record<Status, string> = {
	default: "bg-muted-foreground/40 border-muted-foreground/40",
	success: "bg-emerald-500 border-emerald-500",
	warning: "bg-amber-500 border-amber-500",
	error: "bg-destructive border-destructive"
}

function Timeline({ props }: BaseComponentProps<TimelineProps>) {
	const items = props.items ?? []
	return (
		<ol className={cn("relative flex flex-col", props.className)}>
			{items.map((item, i) => {
				const last = i === items.length - 1
				return (
					<li key={`${item.title}-${i}`} className="relative flex gap-3 pb-5 last:pb-0">
						{!last ? <span className="absolute left-[5px] top-3 h-full w-px bg-border" aria-hidden /> : null}
						<span className={cn("mt-1 size-2.5 shrink-0 rounded-full border", DOT_CLASS[item.status ?? "default"])} />
						<div className="flex flex-col gap-0.5">
							<div className="flex flex-wrap items-baseline gap-x-2">
								<span className="text-sm font-medium text-foreground">{item.title}</span>
								{item.timestamp ? <span className="text-xs text-muted-foreground">{item.timestamp}</span> : null}
							</div>
							{item.description ? <p className="text-sm text-muted-foreground">{item.description}</p> : null}
						</div>
					</li>
				)
			})}
		</ol>
	)
}

export const definition = {
	props: z.object({
		items: z
			.array(
				z.object({
					title: z.string(),
					description: z.string().nullable(),
					timestamp: z.string().nullable(),
					status: z.enum(["default", "success", "warning", "error"]).nullable()
				})
			)
			.describe("Events in display order (usually newest first or chronological)."),
		className: z.string().nullable()
	}),
	description:
		"A vertical timeline of events — each item is a status dot on a connecting " +
		"line with a title, optional timestamp, and optional description. Generic: " +
		"use for activity feeds, audit logs, status history. `status` colours the dot.",
	example: {
		items: [
			{ title: "Created", timestamp: "09:00", status: "success" },
			{ title: "In review", description: "Assigned to the QA team", timestamp: "11:30", status: "default" },
			{ title: "Blocked", description: "Waiting on approval", timestamp: "14:05", status: "warning" }
		]
	}
}

export const component = Timeline
