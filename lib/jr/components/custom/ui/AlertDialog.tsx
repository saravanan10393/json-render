/**
 * AlertDialog — json-render catalog component. A confirmation dialog for
 * destructive actions. Visibility is driven by `openPath` (a boolean state
 * path). Registered via src/components/custom/extras.ts.
 */
import { type BaseComponentProps, useStateBinding } from "@json-render/react"
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog"
import { z } from "zod"

interface AlertDialogProps {
	title: string
	description: string
	confirmLabel?: string | null
	cancelLabel?: string | null
	openPath: string
}

function AlertDialog({ props, emit }: BaseComponentProps<AlertDialogProps>) {
	const [open, setOpen] = useStateBinding<boolean>(props.openPath ?? "")
	return (
		<AlertDialogPrimitive.Root open={!!open} onOpenChange={(o) => setOpen(o)}>
			<AlertDialogPrimitive.Portal>
				<AlertDialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40" />
				<AlertDialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-background p-6 shadow-lg focus:outline-none">
					<AlertDialogPrimitive.Title className="text-lg font-semibold text-foreground">
						{props.title}
					</AlertDialogPrimitive.Title>
					<AlertDialogPrimitive.Description className="mt-2 text-sm text-muted-foreground">
						{props.description}
					</AlertDialogPrimitive.Description>
					<div className="mt-6 flex justify-end gap-2">
						<AlertDialogPrimitive.Cancel className="rounded-md border bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
							{props.cancelLabel ?? "Cancel"}
						</AlertDialogPrimitive.Cancel>
						<AlertDialogPrimitive.Action
							onClick={() => emit("confirm")}
							className="rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-destructive/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						>
							{props.confirmLabel ?? "Confirm"}
						</AlertDialogPrimitive.Action>
					</div>
				</AlertDialogPrimitive.Content>
			</AlertDialogPrimitive.Portal>
		</AlertDialogPrimitive.Root>
	)
}

export const definition = {
	props: z.object({
		title: z.string(),
		description: z.string(),
		confirmLabel: z.string().nullable(),
		cancelLabel: z.string().nullable(),
		openPath: z.string()
	}),
	events: ["confirm"],
	description:
		"Confirmation dialog for destructive actions. Visibility is driven by " +
		"`openPath` — a boolean state path; set it true (via setState) to open. " +
		"Fires `confirm` when confirmed; bind a backend action via `on.confirm`.",
	example: {
		title: "Delete this order?",
		description: "This action cannot be undone.",
		confirmLabel: "Delete",
		cancelLabel: "Cancel",
		openPath: "/confirmDelete"
	}
}

export const component = AlertDialog
