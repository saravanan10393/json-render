/**
 * CopyButton — json-render catalog component. Copies `text` to the clipboard
 * on click and confirms with a brief Copy→Check icon swap. Icon-only ghost
 * button when `label` is omitted; emits "copy" after a successful write.
 * Reuses the app Button primitive. Registered via ./index.ts.
 */
import { type BaseComponentProps } from "@json-render/react"
import { Check, Copy } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface CopyButtonProps {
	text: string
	label?: string | null
	variant?: "ghost" | "outline" | "secondary" | null
	className?: string | null
}

function CopyButton({ props, emit }: BaseComponentProps<CopyButtonProps>) {
	const [copied, setCopied] = useState(false)
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

	useEffect(
		() => () => {
			if (timer.current) clearTimeout(timer.current)
		},
		[]
	)

	const onClick = async () => {
		try {
			await navigator.clipboard.writeText(props.text ?? "")
		} catch {
			return // clipboard unavailable (permissions / insecure context) — leave the button untouched
		}
		setCopied(true)
		if (timer.current) clearTimeout(timer.current)
		timer.current = setTimeout(() => setCopied(false), 1500)
		emit("copy")
	}

	const icon = copied ? <Check className="size-4 text-emerald-500" /> : <Copy className="size-4" />

	return (
		<Button
			type="button"
			variant={props.variant ?? "ghost"}
			size={props.label ? "sm" : "icon"}
			aria-label={props.label ?? "Copy"}
			onClick={onClick}
			className={cn(props.className)}
		>
			{icon}
			{props.label && <span>{copied ? "Copied" : props.label}</span>}
		</Button>
	)
}

export const definition = {
	props: z.object({
		text: z.string().describe("The exact text written to the clipboard on click."),
		label: z.string().nullable().describe("Button caption; icon-only ghost button when omitted."),
		variant: z.enum(["ghost", "outline", "secondary"]).nullable().describe("Button style (default 'ghost')."),
		className: z.string().nullable()
	}),
	events: ["copy"],
	description:
		"Copy-to-clipboard button with built-in success feedback (Copy→Check for ~1.5s). " +
		"Use next to IDs, API keys, commands, links. Emits 'copy' after a successful write.",
	example: { text: "npm install json-render", label: "Copy command" }
}

export const component = CopyButton
