"use client"

/**
 * Renders catalog components live, the same way the real app does — through a
 * JSONUIProvider + Renderer against the shared registry. A class error boundary
 * keeps one broken demo (or an invalid hand-edit) from taking down the page.
 *
 * Exports:
 *   - ComponentPreview — render an entry's default demo (handles `note` demos).
 *   - PreviewStage      — render an explicit { spec, state } (used by the editor).
 *   - toRenderable      — turn a demo-JSON object into a renderable { spec, state }.
 */
import { JSONUIProvider, Renderer, type Spec, useStateStore } from "@json-render/react"
import { useEffect, useMemo } from "react"
import { registry } from "@/lib/jr/registry"
import { PreviewErrorBoundary } from "../shared/PreviewErrorBoundary"
import type { ShowcaseEntry } from "./catalogMeta"

/**
 * Bridges the preview's live store state up to the parent (no UI of its own), so
 * the Demo JSON viewer can reflect interactions in its `state` block in real
 * time — click a Rating star, toggle a Switch, and the JSON updates.
 */
function StateBridge({ onState }: { onState: (state: Record<string, unknown>) => void }) {
	const { state } = useStateStore()
	useEffect(() => {
		onState(state as Record<string, unknown>)
	}, [state, onState])
	return null
}

/** Build the spec + seed state to render for a given entry's demo. */
function resolveDemo(entry: ShowcaseEntry): { spec: Spec; state: Record<string, unknown> } | null {
	const { demo } = entry
	if ("note" in demo) return null
	if ("spec" in demo) return { spec: demo.spec, state: demo.state ?? {} }
	// Single-element demo built from props (or the catalog example).
	const props = demo.props ?? entry.example ?? {}
	return {
		spec: {
			root: "el",
			elements: { el: { type: entry.name, props, children: [] } }
		} as unknown as Spec,
		state: {}
	}
}

/**
 * Turn a demo-JSON object — either `{ spec, state? }` or a single element
 * `{ type, props, children? }` — into a renderable { spec, state }.
 */
export function toRenderable(json: unknown): { spec: Spec; state: Record<string, unknown> } {
	if (json && typeof json === "object" && "spec" in (json as Record<string, unknown>)) {
		const j = json as { spec: Spec; state?: Record<string, unknown> }
		return { spec: j.spec, state: j.state ?? {} }
	}
	const j = (json ?? {}) as { type?: string; props?: Record<string, unknown>; children?: unknown }
	return {
		spec: {
			root: "el",
			elements: { el: { type: j.type, props: j.props ?? {}, children: j.children ?? [] } }
		} as unknown as Spec,
		state: {}
	}
}

/** Render an explicit spec + state. Remounts (clearing stale errors) whenever
 *  the spec/state content changes — important for the live JSON editor. */
export function PreviewStage({
	spec,
	state,
	onStateChange
}: {
	spec: Spec
	state: Record<string, unknown>
	/** Called with the live store state on every change — used to mirror
	 *  interactions into the Demo JSON viewer. */
	onStateChange?: (state: Record<string, unknown>) => void
}) {
	const key = useMemo(() => JSON.stringify(spec) + JSON.stringify(state), [spec, state])
	return (
		<PreviewErrorBoundary key={key}>
			<JSONUIProvider registry={registry} initialState={state} handlers={{}}>
				<Renderer spec={spec} registry={registry} />
				{onStateChange ? <StateBridge onState={onStateChange} /> : null}
			</JSONUIProvider>
		</PreviewErrorBoundary>
	)
}

export function ComponentPreview({ entry }: { entry: ShowcaseEntry }) {
	if ("note" in entry.demo) {
		return (
			<div className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-3 text-xs text-muted-foreground">
				{entry.demo.note}
			</div>
		)
	}

	const resolved = resolveDemo(entry)
	if (!resolved) return null

	return <PreviewStage spec={resolved.spec} state={resolved.state} />
}
