/**
 * Breadcrumb — json-render catalog component. The trail of pages leading to
 * the current view. Registered via src/components/custom/extras.ts.
 */
import type { BaseComponentProps } from "@json-render/react"
import { ChevronRight } from "lucide-react"
import { z } from "zod"
import { cn } from "@/lib/utils"

interface BreadcrumbProps {
	items: Array<{ label: string }>
	className?: string | null
}

function Breadcrumb({ props }: BaseComponentProps<BreadcrumbProps>) {
	const items = props.items ?? []
	return (
		<nav aria-label="breadcrumb" className={cn("text-sm", props.className)}>
			<ol className="flex flex-wrap items-center gap-1.5">
				{items.map((item, i) => {
					const last = i === items.length - 1
					return (
						<li key={`${item.label}-${i}`} className="flex items-center gap-1.5">
							<span className={last ? "font-medium text-foreground" : "text-muted-foreground"}>{item.label}</span>
							{!last && <ChevronRight aria-hidden className="size-3.5 text-muted-foreground" />}
						</li>
					)
				})}
			</ol>
		</nav>
	)
}

export const definition = {
	props: z.object({
		items: z.array(z.object({ label: z.string() })),
		className: z.string().nullable()
	}),
	events: [],
	description:
		"Breadcrumb trail showing the path to the current page. `items` is an " +
		"array of { label }; the last item is shown as the current page.",
	example: { items: [{ label: "Home" }, { label: "Orders" }] }
}

export const component = Breadcrumb
