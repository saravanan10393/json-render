import type { CSSProperties, ReactNode } from "react"

/**
 * `Stack` — locally-owned layout primitive.
 *
 * Replaces the @json-render/shadcn Stack outright (no delegation). The shadcn
 * Stack defaults `align` to "start" (`items-start`), which collapses every
 * vertical layout to content width — the Vendor-dashboard bug where metric
 * cards rendered as ~66px slivers. This is a self-contained flex container with
 * the flexbox-correct default, `align: stretch`, and zero dependency on
 * @json-render/shadcn's Stack.
 *
 * Matches the catalog's Stack schema: { direction, gap, align, justify,
 * className }. Box and Grid are intentionally NOT owned yet — Stack alone for
 * now. Wired in registry.ts after `...shadcnComponents` so it shadows the
 * built-in one.
 */

type StackProps = {
	direction?: "horizontal" | "vertical" | null
	gap?: "none" | "sm" | "md" | "lg" | "xl" | null
	align?: "start" | "center" | "end" | "stretch" | null
	justify?: "start" | "center" | "end" | "between" | "around" | null
	className?: string | null
	/** Inline style escape hatch for exact one-off values (e.g. `{ width: "500px" }`)
	 *  that the named class scale doesn't cover. */
	style?: Record<string, string | number> | null
}

// Every class below is also emitted by the shadcn components, so Tailwind's
// content scan already compiles them — no safelist entry needed.
const GAP = {
	none: "gap-0",
	sm: "gap-2",
	md: "gap-3",
	lg: "gap-4",
	xl: "gap-6"
} as const
const ALIGN = {
	start: "items-start",
	center: "items-center",
	end: "items-end",
	stretch: "items-stretch"
} as const
const JUSTIFY = {
	start: "",
	center: "justify-center",
	end: "justify-end",
	between: "justify-between",
	around: "justify-around"
} as const

export function Stack({ props, children }: { props?: StackProps | null; children?: ReactNode }): ReactNode {
	const p = props ?? {}
	const horizontal = p.direction === "horizontal"
	const className = [
		"flex",
		horizontal ? "flex-row flex-wrap" : "flex-col",
		GAP[p.gap ?? "md"],
		ALIGN[p.align ?? "stretch"], // flexbox-correct default; shadcn's is "start"
		JUSTIFY[p.justify ?? "start"],
		p.className ?? ""
	]
		.filter(Boolean)
		.join(" ")
	return (
		<div className={className} style={(p.style as CSSProperties | undefined) ?? undefined}>
			{children}
		</div>
	)
}
