"use client"

/**
 * The catalog body — a living index of every component the renderer knows
 * about, laid out Storybook-style: a left sidebar that drills down from
 * category to component, and a main panel that renders the selected component
 * live with its metadata and a foldable JSON viewer/editor.
 *
 * The page chrome (title, Components/Blocks tabs, counts, Back to apps) lives
 * in the route layout; this component owns only the sidebar + detail panel. The
 * whole thing is driven off the live catalog, so it stays in sync automatically.
 */
import { ChevronRight } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { buildShowcaseEntries, CATEGORY_ORDER, type Category, type ShowcaseEntry, type Source } from "./catalogMeta"
import { ComponentPreview, PreviewStage, toRenderable } from "./ComponentPreview"
import { JsonTree } from "../shared/JsonTree"
import { SchemaView } from "./SchemaView"

type SourceFilter = "all" | Source

function SourceBadge({ source }: { source: Source }) {
	if (source === "shadcn") {
		return (
			<span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
				shadcn
			</span>
		)
	}
	return (
		<span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
			ours
		</span>
	)
}

function demoJsonFor(entry: ShowcaseEntry): Record<string, unknown> | null {
	if ("spec" in entry.demo) {
		return { spec: entry.demo.spec, ...(entry.demo.state ? { state: entry.demo.state } : {}) }
	}
	if ("props" in entry.demo) {
		return { type: entry.name, props: entry.demo.props ?? entry.example ?? {} }
	}
	return null
}

/** Main panel — the selected component rendered live, with its metadata and a
 *  foldable JSON viewer/editor. Edits are in-memory only (temp playground): they
 *  drive the preview but reset when you switch components or reload. */
function ComponentDetail({ entry }: { entry: ShowcaseEntry }) {
	const isNote = "note" in entry.demo
	const defaultJson = demoJsonFor(entry)
	const defaultText = defaultJson ? JSON.stringify(defaultJson, null, 2) : ""

	const [tab, setTab] = useState<"demo" | "schema">("demo")
	const [mode, setMode] = useState<"view" | "edit">("view")
	const [draft, setDraft] = useState(defaultText)
	const [committed, setCommitted] = useState<unknown>(defaultJson)

	const parseError = useMemo(() => {
		try {
			JSON.parse(draft)
			return null
		} catch (e) {
			return (e as Error).message
		}
	}, [draft])

	// Live-apply valid edits to the preview; keep the last valid render while the
	// draft is mid-edit / invalid.
	useEffect(() => {
		try {
			setCommitted(JSON.parse(draft))
		} catch {
			/* keep last valid committed JSON */
		}
	}, [draft])

	const edited = draft !== defaultText
	const renderable = !isNote && committed != null ? toRenderable(committed) : null

	// Mirror the preview's live store state into the Demo JSON viewer. `seed` is
	// the committed state; `liveState` tracks interactions and re-syncs to `seed`
	// whenever the JSON is edited (component switches remount — keyed by name).
	const seed = renderable?.state ?? null
	const seedKey = JSON.stringify(seed)
	const [liveState, setLiveState] = useState<Record<string, unknown> | null>(seed)
	useEffect(() => {
		setLiveState(seed ? { ...seed } : null)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [seedKey])

	// What the Demo JSON "View" shows: the committed JSON with its `state` block
	// swapped for the live state, so interactions are reflected in the JSON.
	const viewJson = useMemo(() => {
		if (committed && typeof committed === "object" && "state" in (committed as Record<string, unknown>) && liveState) {
			return { ...(committed as Record<string, unknown>), state: liveState }
		}
		return committed ?? defaultJson
	}, [committed, liveState, defaultJson])

	const reset = () => {
		setDraft(defaultText)
		setCommitted(defaultJson)
	}

	return (
		<div className="mx-auto max-w-4xl px-8 py-8">
			<div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{entry.category}</div>
			<div className="flex items-center gap-3">
				<h1 className="font-mono text-2xl font-bold">{entry.name}</h1>
				<SourceBadge source={entry.source} />
				{entry.events.length > 0 && (
					<span className="text-xs text-muted-foreground">
						events: <span className="font-mono">{entry.events.join(", ")}</span>
					</span>
				)}
			</div>
			{entry.description && (
				<p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">{entry.description}</p>
			)}

			<div className="mt-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
				Preview
				{edited && (
					<span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium normal-case text-amber-600 dark:text-amber-400">
						edited
					</span>
				)}
			</div>
			<div className="canvas-grid mt-2 flex min-h-40 items-center justify-center rounded-lg border border-dashed border-border p-8">
				<div className="w-full max-w-xl rounded-lg bg-background p-4">
					{isNote ? (
						<ComponentPreview entry={entry} />
					) : renderable ? (
						<PreviewStage spec={renderable.spec} state={renderable.state} onStateChange={setLiveState} />
					) : null}
				</div>
			</div>

			<div className="mt-6">
				{/* Tab strip — Demo JSON | Schema */}
				<div className="flex items-center justify-between gap-2 border-b border-border">
					<div className="flex gap-4">
						{(["demo", "schema"] as const).map((t) => (
							<button
								key={t}
								type="button"
								onClick={() => setTab(t)}
								className={`-mb-px border-b-2 px-1 py-2 text-xs font-semibold uppercase tracking-wide transition-colors ${
									tab === t
										? "border-primary text-foreground"
										: "border-transparent text-muted-foreground hover:text-foreground"
								}`}
							>
								{t === "demo" ? "Demo JSON" : "Schema"}
							</button>
						))}
					</div>
					{tab === "demo" && defaultJson && (
						<div className="flex items-center gap-2">
							{edited && (
								<button
									type="button"
									onClick={reset}
									className="rounded px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
								>
									Reset
								</button>
							)}
							<div className="flex gap-0.5 rounded-md border border-border p-0.5">
								{(["view", "edit"] as const).map((m) => (
									<button
										key={m}
										type="button"
										onClick={() => setMode(m)}
										className={`rounded px-2 py-0.5 text-[11px] font-medium capitalize transition-colors ${
											mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
										}`}
									>
										{m}
									</button>
								))}
							</div>
						</div>
					)}
				</div>

				<div className="mt-3">
					{tab === "schema" ? (
						<SchemaView schema={entry.propsSchema} />
					) : !defaultJson ? (
						<p className="text-xs text-muted-foreground">
							{isNote && "note" in entry.demo ? entry.demo.note : "No demo for this component."}
						</p>
					) : mode === "edit" ? (
						<>
							<textarea
								value={draft}
								onChange={(e) => setDraft(e.target.value)}
								spellCheck={false}
								className="max-h-96 min-h-48 w-full resize-y overflow-auto rounded-lg border border-zinc-800 bg-zinc-950 p-3 font-mono text-[12px] leading-relaxed text-zinc-200 outline-none focus:ring-2 focus:ring-ring"
							/>
							{parseError ? (
								<p className="mt-1 text-xs text-destructive">Invalid JSON: {parseError}</p>
							) : (
								<p className="mt-1 text-xs text-muted-foreground">
									Live preview updates as you type. Edits are temporary — Reset or switch components to discard.
								</p>
							)}
						</>
					) : (
						<JsonTree data={viewJson} />
					)}
				</div>
			</div>
		</div>
	)
}

export function ComponentCatalog() {
	const entries = useMemo(() => buildShowcaseEntries(), [])
	const [query, setQuery] = useState("")
	const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all")
	const [collapsed, setCollapsed] = useState<Set<Category>>(() => new Set())
	// Start empty so SSR and the first client render agree; the deep-link hash
	// is restored after mount (below). Reading window.location during render
	// would mismatch SSR.
	const [selected, setSelected] = useState<string>("")

	const filtered = useMemo(() => {
		const q = query.trim().toLowerCase()
		return entries.filter((e) => {
			if (sourceFilter !== "all" && e.source !== sourceFilter) return false
			if (!q) return true
			return (
				e.name.toLowerCase().includes(q) ||
				e.description.toLowerCase().includes(q) ||
				e.category.toLowerCase().includes(q)
			)
		})
	}, [entries, query, sourceFilter])

	const byCategory = useMemo(() => {
		const map = new Map<Category, ShowcaseEntry[]>()
		for (const cat of CATEGORY_ORDER) map.set(cat, [])
		for (const e of filtered) map.get(e.category)?.push(e)
		for (const list of map.values()) list.sort((a, b) => a.name.localeCompare(b.name))
		return map
	}, [filtered])

	// Restore the deep-link hash after mount; fall back to the first component so
	// the default is highlighted. Runs once — before this, selected === "" and
	// selectedEntry falls back to filtered[0], keeping SSR and hydration aligned.
	useEffect(() => {
		const hash = window.location.hash.replace(/^#/, "")
		setSelected(hash || entries[0]?.name || "")
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	// If the active selection gets filtered out, snap to the first visible one.
	// Guard on a non-empty selection so this never clobbers the hash restore.
	useEffect(() => {
		if (filtered.length === 0 || selected === "") return
		if (!filtered.some((e) => e.name === selected)) {
			setSelected(filtered[0].name)
		}
	}, [filtered, selected])

	// Reflect selection in the URL hash for deep-linking / refresh.
	useEffect(() => {
		if (selected) window.history.replaceState(null, "", `#${selected}`)
	}, [selected])

	const selectedEntry = entries.find((e) => e.name === selected) ?? filtered[0] ?? null

	const toggleCategory = (cat: Category) =>
		setCollapsed((prev) => {
			const next = new Set(prev)
			if (next.has(cat)) next.delete(cat)
			else next.add(cat)
			return next
		})

	const sourceButtons: { key: SourceFilter; label: string }[] = [
		{ key: "all", label: "All" },
		{ key: "shadcn", label: "shadcn" },
		{ key: "ours", label: "Ours" }
	]

	return (
		<>
			{/* ── Sidebar ─────────────────────────────────────────────────────── */}
			<aside className="flex w-72 shrink-0 flex-col border-r border-border">
				<div className="shrink-0 space-y-2 border-b border-border p-3">
					<input
						type="text"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder="Search components…"
						className="h-8 w-full rounded-md border border-border bg-background px-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
					/>
					<div className="flex gap-1 rounded-md border border-border p-0.5">
						{sourceButtons.map((b) => (
							<button
								key={b.key}
								type="button"
								onClick={() => setSourceFilter(b.key)}
								className={`flex-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
									sourceFilter === b.key
										? "bg-primary text-primary-foreground"
										: "text-muted-foreground hover:bg-muted"
								}`}
							>
								{b.label}
							</button>
						))}
					</div>
				</div>

				<nav className="min-h-0 flex-1 overflow-y-auto p-2">
					{CATEGORY_ORDER.map((cat) => {
						const list = byCategory.get(cat) ?? []
						if (list.length === 0) return null
						const isOpen = query.trim() !== "" || !collapsed.has(cat)
						return (
							<div key={cat} className="mb-1">
								<button
									type="button"
									onClick={() => toggleCategory(cat)}
									className="flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:bg-muted"
								>
									<ChevronRight
										className={`h-3.5 w-3.5 shrink-0 transition-transform ${isOpen ? "rotate-90" : ""}`}
									/>
									<span className="flex-1">{cat}</span>
									<span className="text-[10px] font-normal">{list.length}</span>
								</button>
								{isOpen && (
									<ul className="ml-2 border-l border-border pl-2">
										{list.map((entry) => {
											const active = entry.name === selected
											return (
												<li key={entry.name}>
													<button
														type="button"
														onClick={() => setSelected(entry.name)}
														className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-1 text-left text-sm transition-colors ${
															active ? "bg-primary/10 font-medium text-primary" : "text-foreground/80 hover:bg-muted"
														}`}
													>
														<span className="font-mono text-[13px]">{entry.name}</span>
														{entry.source === "shadcn" && (
															<span className="text-[9px] uppercase text-muted-foreground">shadcn</span>
														)}
													</button>
												</li>
											)
										})}
									</ul>
								)}
							</div>
						)
					})}
					{filtered.length === 0 && (
						<p className="px-2 py-4 text-center text-xs text-muted-foreground">No matches for “{query}”.</p>
					)}
				</nav>
			</aside>

			{/* ── Main panel ──────────────────────────────────────────────────── */}
			<main className="min-w-0 flex-1 overflow-y-auto">
				{selectedEntry ? (
					<ComponentDetail key={selectedEntry.name} entry={selectedEntry} />
				) : (
					<div className="flex h-full items-center justify-center text-sm text-muted-foreground">
						Select a component from the sidebar.
					</div>
				)}
			</main>
		</>
	)
}
