/**
 * Primitives — layout / typography / action helpers with no shadcn/ui primitive
 * behind them (plain divs + Tailwind). Extracted from the upstream
 * @json-render/shadcn `components.tsx` and now owned here.
 *
 * Both the catalog definitions (`primitiveComponentDefinitions`) and the runtime
 * components (`primitiveComponents`) are co-located in this file — the same
 * one-file pattern the other ./ui/<Name>.tsx components follow. ./ui/index.ts
 * folds both into `uiComponentDefinitions` / `uiComponents`.
 *
 * `cn` is the shared className helper from @/lib/utils.
 */

import { type BaseComponentProps, useBoundProp } from "@json-render/react"
import { useState } from "react"
import { z } from "zod"

import { cn } from "@/lib/utils"

// ── Catalog definitions ─────────────────────────────────────────────────────
export const primitiveComponentDefinitions = {
	// Layout
	Stack: {
		props: z.object({
			direction: z.enum(["horizontal", "vertical"]).nullable(),
			gap: z.enum(["none", "sm", "md", "lg", "xl"]).nullable(),
			align: z.enum(["start", "center", "end", "stretch"]).nullable(),
			justify: z.enum(["start", "center", "end", "between", "around"]).nullable(),
			className: z.string().nullable().describe("Additional CSS classes"),
			style: z
				.record(z.string(), z.union([z.string(), z.number()]))
				.nullable()
				.describe('Inline style for an exact one-off dimension the named scale lacks, e.g. { "width": "500px" }'),
			clickable: z.boolean().nullable().describe("When true the stack emits a press event on click (wire on.press).")
		}),
		slots: ["default"],
		events: ["press"],
		description: "Flex container for layouts",
		example: { direction: "vertical", gap: "md" }
	},
	Grid: {
		props: z.object({
			columns: z.number().nullable(),
			gap: z.enum(["sm", "md", "lg", "xl"]).nullable(),
			className: z.string().nullable().describe("Additional CSS classes"),
			style: z
				.record(z.string(), z.union([z.string(), z.number()]))
				.nullable()
				.describe('Inline style for an exact one-off dimension the named scale lacks, e.g. { "width": "500px" }')
		}),
		slots: ["default"],
		description: "Grid layout (1-6 columns)",
		example: { columns: 3, gap: "md" }
	},
	// Typography
	Heading: {
		props: z.object({
			text: z.string(),
			level: z.enum(["h1", "h2", "h3", "h4"]).nullable()
		}),
		description:
			"Page or section title. THE primitive for titles. Use one h1 as the page title — place it with a Text subtitle directly at the top of the page (NOT inside a Card); use h2/h3 for section titles.",
		example: { text: "Welcome", level: "h1" }
	},
	Text: {
		props: z.object({
			text: z.string(),
			variant: z.enum(["body", "caption", "muted", "lead", "code"]).nullable()
		}),
		description: "Paragraph text",
		example: { text: "Hello, world!" }
	},
	Image: {
		props: z.object({
			src: z.string().nullable(),
			alt: z.string(),
			width: z.number().nullable(),
			height: z.number().nullable()
		}),
		description: "Image component. Renders an img tag when src is provided, otherwise a placeholder."
	},
	Spinner: {
		props: z.object({
			size: z.enum(["sm", "md", "lg"]).nullable(),
			label: z.string().nullable()
		}),
		description: "Loading spinner indicator"
	},
	// Actions
	Link: {
		props: z.object({
			label: z.string(),
			href: z.string()
		}),
		events: ["press"],
		description: "Anchor link. Bind on.press for click handler."
	},
	ButtonGroup: {
		props: z.object({
			buttons: z.array(
				z.object({
					label: z.string(),
					value: z.string()
				})
			),
			selected: z.string().nullable()
		}),
		events: ["change"],
		description: "Segmented button group. Use { $bindState } on selected for selected value."
	}
}

/** Infer the props type for a primitive by name (mirrors ShadcnProps in ../../shadcn/catalog). */
export type PrimitiveProps<K extends keyof typeof primitiveComponentDefinitions> = z.output<
	(typeof primitiveComponentDefinitions)[K]["props"]
>

// ── Runtime components ──────────────────────────────────────────────────────
export const primitiveComponents = {
	Stack: ({ props, children, emit }: BaseComponentProps<PrimitiveProps<"Stack">>) => {
		const isHorizontal = props.direction === "horizontal"
		const clickable = !!props.clickable
		const gapMap: Record<string, string> = {
			none: "gap-0",
			sm: "gap-2",
			md: "gap-3",
			lg: "gap-4",
			xl: "gap-6"
		}
		const alignMap: Record<string, string> = {
			start: "items-start",
			center: "items-center",
			end: "items-end",
			stretch: "items-stretch"
		}
		const justifyMap: Record<string, string> = {
			start: "",
			center: "justify-center",
			end: "justify-end",
			between: "justify-between",
			around: "justify-around"
		}

		const gapClass = gapMap[props.gap ?? "md"] ?? "gap-3"
		const alignClass = alignMap[props.align ?? "start"] ?? "items-start"
		const justifyClass = justifyMap[props.justify ?? ""] ?? ""

		return (
			// biome-ignore lint/a11y/noStaticElementInteractions: Stack opts into button semantics only when clickable
			<div
				className={cn(
					"flex",
					isHorizontal ? "flex-row flex-wrap" : "flex-col",
					gapClass,
					alignClass,
					justifyClass,
					clickable && "cursor-pointer hover:bg-muted/40",
					props.className
				)}
				onClick={clickable ? (e) => { e.stopPropagation(); emit("press") } : undefined}
				role={clickable ? "button" : undefined}
				tabIndex={clickable ? 0 : undefined}
				onKeyDown={
					clickable
						? (e) => {
								if (e.key === "Enter" || e.key === " ") {
									e.preventDefault()
									emit("press")
								}
							}
						: undefined
				}
			>
				{children}
			</div>
		)
	},

	Grid: ({ props, children }: BaseComponentProps<PrimitiveProps<"Grid">>) => {
		const colsMap: Record<number, string> = {
			1: "grid-cols-1",
			2: "grid-cols-2",
			3: "grid-cols-3",
			4: "grid-cols-4",
			5: "grid-cols-5",
			6: "grid-cols-6"
		}
		const gridGapMap: Record<string, string> = {
			sm: "gap-2",
			md: "gap-3",
			lg: "gap-4",
			xl: "gap-6"
		}

		const n = Math.max(1, Math.min(6, props.columns ?? 1))
		const cols = colsMap[n] ?? "grid-cols-1"
		const gridGap = gridGapMap[props.gap ?? "md"] ?? "gap-3"

		return (
			<div
				className={cn("grid", cols, gridGap, props.className)}
				style={(props.style as React.CSSProperties | undefined) ?? undefined}
			>
				{children}
			</div>
		)
	},

	Heading: ({ props }: BaseComponentProps<PrimitiveProps<"Heading">>) => {
		const level = props.level ?? "h2"
		const headingClass =
			level === "h1"
				? "text-2xl font-bold"
				: level === "h3"
					? "text-base font-semibold"
					: level === "h4"
						? "text-sm font-semibold"
						: "text-lg font-semibold"

		if (level === "h1") return <h1 className={`${headingClass} text-left`}>{props.text}</h1>
		if (level === "h3") return <h3 className={`${headingClass} text-left`}>{props.text}</h3>
		if (level === "h4") return <h4 className={`${headingClass} text-left`}>{props.text}</h4>
		return <h2 className={`${headingClass} text-left`}>{props.text}</h2>
	},

	Text: ({ props }: BaseComponentProps<PrimitiveProps<"Text">>) => {
		const textClass =
			props.variant === "caption"
				? "text-xs"
				: props.variant === "muted"
					? "text-sm text-muted-foreground"
					: props.variant === "lead"
						? "text-xl text-muted-foreground"
						: props.variant === "code"
							? "font-mono text-sm bg-muted px-1.5 py-0.5 rounded"
							: "text-sm"

		if (props.variant === "code") {
			return <code className={`${textClass} text-left`}>{props.text}</code>
		}
		return <p className={`${textClass} text-left`}>{props.text}</p>
	},

	Image: ({ props }: BaseComponentProps<PrimitiveProps<"Image">>) => {
		if (props.src) {
			return (
				<img
					src={props.src}
					alt={props.alt ?? ""}
					width={props.width ?? undefined}
					height={props.height ?? undefined}
					className="rounded max-w-full"
				/>
			)
		}
		return (
			<div
				className="bg-muted border border-border rounded flex items-center justify-center text-xs text-muted-foreground max-w-full"
				style={
					props.width && props.height
						? { width: props.width, aspectRatio: `${props.width} / ${props.height}` }
						: { width: props.width ?? 80, height: props.height ?? 60 }
				}
			>
				{props.alt || "img"}
			</div>
		)
	},

	Spinner: ({ props }: BaseComponentProps<PrimitiveProps<"Spinner">>) => {
		const sizeClass = props.size === "lg" ? "h-8 w-8" : props.size === "sm" ? "h-4 w-4" : "h-6 w-6"
		return (
			<div className="flex items-center gap-2">
				<svg className={`${sizeClass} animate-spin text-muted-foreground`} viewBox="0 0 24 24" fill="none">
					<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
					<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
				</svg>
				{props.label && <span className="text-sm text-muted-foreground">{props.label}</span>}
			</div>
		)
	},

	Link: ({ props, on }: BaseComponentProps<PrimitiveProps<"Link">>) => {
		return (
			<a
				href={props.href ?? "#"}
				className="text-primary underline-offset-4 hover:underline text-sm font-medium"
				onClick={(e) => {
					const press = on("press")
					if (press.shouldPreventDefault) e.preventDefault()
					press.emit()
				}}
			>
				{props.label}
			</a>
		)
	},

	ButtonGroup: ({ props, bindings, emit }: BaseComponentProps<PrimitiveProps<"ButtonGroup">>) => {
		const buttons = props.buttons ?? []
		const [boundSelected, setBoundSelected] = useBoundProp<string>(
			props.selected as string | undefined,
			bindings?.selected
		)
		const [localValue, setLocalValue] = useState(buttons[0]?.value ?? "")
		const isBound = !!bindings?.selected
		const value = isBound ? (boundSelected ?? "") : localValue
		const setValue = isBound ? setBoundSelected : setLocalValue

		return (
			<div className="inline-flex rounded-md border border-border">
				{buttons.map((btn, i) => (
					<button
						key={btn.value}
						className={`px-3 py-1.5 text-sm transition-colors ${
							value === btn.value ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"
						} ${i > 0 ? "border-l border-border" : ""} ${
							i === 0 ? "rounded-l-md" : ""
						} ${i === buttons.length - 1 ? "rounded-r-md" : ""}`}
						onClick={() => {
							setValue(btn.value)
							emit("change")
						}}
					>
						{btn.label}
					</button>
				))}
			</div>
		)
	}
}
