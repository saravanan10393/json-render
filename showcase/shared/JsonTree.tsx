"use client"

/**
 * JsonTree — a small, dependency-free JSON viewer styled after the json-render
 * devtools panel: a dark, monospace, scrollable surface where every object and
 * array node can be folded/unfolded independently. Used to inspect a
 * component's demo spec on the showcase page.
 */
import { type ReactNode, useState } from "react"

type Json = unknown

const isContainer = (v: Json): v is Record<string, Json> | Json[] => v !== null && typeof v === "object"

function Primitive({ value }: { value: Json }) {
	if (value === null) return <span className="text-zinc-500">null</span>
	switch (typeof value) {
		case "string":
			return <span className="text-emerald-300">"{value}"</span>
		case "number":
			return <span className="text-amber-300">{String(value)}</span>
		case "boolean":
			return <span className="text-purple-300">{String(value)}</span>
		default:
			return <span className="text-zinc-300">{String(value)}</span>
	}
}

function Node({
	label,
	quoteLabel,
	value,
	depth,
	openDepth,
	isLast
}: {
	/** Property key or array index to print before the value (omit for root). */
	label?: string
	/** Object keys render quoted; array indices render bare. */
	quoteLabel?: boolean
	value: Json
	depth: number
	openDepth: number
	isLast: boolean
}) {
	const [open, setOpen] = useState(depth < openDepth)
	const indent = { paddingLeft: `${depth * 14}px` }

	const Key = () =>
		label === undefined ? null : (
			<>
				<span className="text-sky-300">{quoteLabel ? `"${label}"` : label}</span>
				<span className="text-zinc-500">: </span>
			</>
		)

	if (!isContainer(value)) {
		return (
			<div style={indent} className="whitespace-pre">
				<span className="inline-block w-3.5" />
				<Key />
				<Primitive value={value} />
				{!isLast && <span className="text-zinc-500">,</span>}
			</div>
		)
	}

	const isArray = Array.isArray(value)
	const entries: [string, Json][] = isArray
		? (value as Json[]).map((v, i) => [String(i), v])
		: Object.entries(value as Record<string, Json>)
	const openBrace = isArray ? "[" : "{"
	const closeBrace = isArray ? "]" : "}"

	return (
		<div>
			<div
				style={indent}
				className="cursor-pointer whitespace-pre rounded hover:bg-zinc-800/60"
				onClick={() => setOpen((o) => !o)}
			>
				<span className="inline-block w-3.5 select-none text-zinc-500">{open ? "▾" : "▸"}</span>
				<Key />
				<span className="text-zinc-400">{openBrace}</span>
				{!open && (
					<span className="text-zinc-600">
						{entries.length}{" "}
						{isArray ? (entries.length === 1 ? "item" : "items") : entries.length === 1 ? "key" : "keys"}
						{closeBrace}
						{!isLast ? "," : ""}
					</span>
				)}
			</div>
			{open && (
				<>
					{entries.map(([k, v], i) => (
						<Node
							key={k}
							label={k}
							quoteLabel={!isArray}
							value={v}
							depth={depth + 1}
							openDepth={openDepth}
							isLast={i === entries.length - 1}
						/>
					))}
					<div style={indent} className="whitespace-pre">
						<span className="inline-block w-3.5" />
						<span className="text-zinc-400">{closeBrace}</span>
						{!isLast && <span className="text-zinc-500">,</span>}
					</div>
				</>
			)}
		</div>
	)
}

export function JsonTree({ data, toolbar }: { data: Json; toolbar?: ReactNode }) {
	// `remount` forces the recursive Node tree to re-initialise its per-node
	// open state when Expand all / Collapse all flips the default depth.
	const [openDepth, setOpenDepth] = useState(3)
	const [remount, setRemount] = useState(0)
	const [copied, setCopied] = useState(false)

	const expandAll = () => {
		setOpenDepth(Number.POSITIVE_INFINITY)
		setRemount((n) => n + 1)
	}
	const collapseAll = () => {
		setOpenDepth(1)
		setRemount((n) => n + 1)
	}
	const copy = () => {
		navigator.clipboard?.writeText(JSON.stringify(data, null, 2)).then(() => {
			setCopied(true)
			setTimeout(() => setCopied(false), 1200)
		})
	}

	return (
		<div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
			<div className="flex items-center justify-between gap-2 border-b border-zinc-800 bg-zinc-900/60 px-2 py-1">
				<div className="flex min-w-0 items-center gap-1">{toolbar}</div>
				<div className="flex shrink-0 items-center gap-1">
					<button
						type="button"
						onClick={expandAll}
						className="rounded px-2 py-0.5 text-[11px] text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
					>
						Expand all
					</button>
					<button
						type="button"
						onClick={collapseAll}
						className="rounded px-2 py-0.5 text-[11px] text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
					>
						Collapse all
					</button>
					<button
						type="button"
						onClick={copy}
						className="rounded px-2 py-0.5 text-[11px] text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
					>
						{copied ? "Copied" : "Copy"}
					</button>
				</div>
			</div>
			<div className="max-h-96 overflow-auto p-3 font-mono text-[12px] leading-relaxed text-zinc-200">
				<Node key={`${openDepth}-${remount}`} value={data} depth={0} openDepth={openDepth} isLast />
			</div>
		</div>
	)
}
