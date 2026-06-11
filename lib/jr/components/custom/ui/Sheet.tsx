/**
 * Sheet — json-render catalog component. A panel that slides in from the side.
 * Visibility is driven by `openPath` (a boolean state path). Registered via
 * src/components/custom/extras.ts.
 */
import { type BaseComponentProps, useStateBinding } from "@json-render/react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import { z } from "zod"

interface SheetProps {
	title: string
	description?: string | null
	side?: "left" | "right" | null
	openPath: string
}

const SIDE_CLASS: Record<"left" | "right", string> = {
	left: "inset-y-0 left-0 border-r",
	right: "inset-y-0 right-0 border-l"
}

function Sheet({ props, children }: BaseComponentProps<SheetProps>) {
	const [open, setOpen] = useStateBinding<boolean>(props.openPath ?? "")
	const side = props.side ?? "right"
	return (
		<DialogPrimitive.Root open={!!open} onOpenChange={(o) => setOpen(o)}>
			<DialogPrimitive.Portal>
				<DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40" />
				<DialogPrimitive.Content
					aria-describedby={undefined}
					className={`fixed z-50 flex h-full w-3/4 max-w-sm flex-col bg-background shadow-lg ${SIDE_CLASS[side]}`}
				>
					<div className="flex shrink-0 items-start justify-between gap-4 border-b px-6 py-4">
						<div className="flex flex-col gap-1">
							<DialogPrimitive.Title className="text-lg font-semibold text-foreground">
								{props.title}
							</DialogPrimitive.Title>
							{props.description ? <p className="text-sm text-muted-foreground">{props.description}</p> : null}
						</div>
						<DialogPrimitive.Close
							aria-label="Close"
							className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						>
							<X className="size-4" aria-hidden />
						</DialogPrimitive.Close>
					</div>
					<div className="flex-1 overflow-y-auto p-6">{children}</div>
				</DialogPrimitive.Content>
			</DialogPrimitive.Portal>
		</DialogPrimitive.Root>
	)
}

export const definition = {
	props: z.object({
		title: z.string(),
		description: z.string().nullable(),
		side: z.enum(["left", "right"]).nullable(),
		openPath: z.string()
	}),
	slots: ["default"],
	description:
		"A panel that slides in from the side (`side`: left or right, default " +
		"right). Visibility is driven by `openPath` — a boolean state path; set " +
		"it true to open. Place the panel's content as its children.",
	example: { title: "Filters", side: "right", openPath: "/showFilters" }
}

export const component = Sheet
