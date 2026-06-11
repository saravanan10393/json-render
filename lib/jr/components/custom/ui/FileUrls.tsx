/**
 * FileUrls — text-based editor for BDO `File`-typed fields.
 *
 * Looks and behaves like a Textarea, but the bound state value is
 * `Array<string>` (one URL per non-blank line). RAPP stores BDO File fields
 * as `Array<string>` of URLs (sample: see App10000009 Product.ProductImages
 * in sample_data.json) so this component matches that shape exactly — no
 * file upload infrastructure required.
 *
 * Why a separate component (vs. extending Textarea or Input):
 *   - The LLM needs a clear catalog signal for File-typed fields. A dedicated
 *     name (`FileUrls`) gives the catalog prompt a single thing to teach,
 *     and the Zod schema enforces `value: Array<string>` so the LLM can't
 *     accidentally bind a string state path.
 *   - The display ↔ state conversion (joined string ↔ array) lives in one
 *     place; downstream components don't need to know about it.
 *
 * Future: when RAPP exposes a BDO-level file upload endpoint (the BP one at
 * runtime/app/router/business_process.py:505 isn't reachable from BDOs yet),
 * we can keep this component for the URL-list case and add a real Upload
 * companion that posts files and fills in URLs automatically.
 */
import { type BaseComponentProps, useBoundProp } from "@json-render/react"
import { useId, useMemo } from "react"
import { z } from "zod"

interface FileUrlsProps {
	name: string
	label?: string | null
	placeholder?: string | null
	value?: string[] | null
	rows?: number | null
	/** When true, show a thumbnail preview row of all current URLs below
	 *  the textarea. On by default — set false for non-image File fields
	 *  (e.g. PDFs) where a thumbnail wouldn't be meaningful. */
	preview?: boolean | null
}

/** Split a multiline textarea blob into an array of trimmed, non-empty URL
 *  strings. Supports newline OR comma separators so the user can paste a
 *  CSV list and it still works. */
function parseUrls(raw: string): string[] {
	return raw
		.split(/[\n,]/)
		.map((line) => line.trim())
		.filter((line) => line.length > 0)
}

function FileUrls({ props, bindings }: BaseComponentProps<FileUrlsProps>) {
	const [value, setValue] = useBoundProp<string[] | null | undefined>(props.value, bindings?.value)
	const id = useId()
	const showPreview = props.preview ?? true
	// Render the array as a newline-joined string so the user sees one URL
	// per line. Memoize to avoid re-joining on every render when the value
	// reference is stable.
	const display = useMemo(() => (Array.isArray(value) ? value.join("\n") : ""), [value])
	const urls = Array.isArray(value) ? value : []
	return (
		<div className="flex flex-col gap-2">
			<textarea
				id={id}
				name={props.name}
				placeholder={props.placeholder ?? "Paste one URL per line\nhttps://images.unsplash.com/..."}
				rows={props.rows ?? 4}
				value={display}
				onChange={(e) => setValue(parseUrls(e.target.value))}
				className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
			/>
			{showPreview && urls.length > 0 ? (
				<div className="flex flex-wrap gap-2">
					{urls.map((url) => (
						// biome-ignore lint/performance/noImgElement: keep thumbnail cheap & dependency-free
						<img
							key={url}
							src={url}
							alt=""
							className="h-16 w-16 rounded-md border border-border object-cover"
							loading="lazy"
							// Silently hide broken URLs rather than rendering a
							// browser-default broken-image icon — keeps the preview
							// clean while the user is still pasting.
							onError={(e) => {
								;(e.currentTarget as HTMLImageElement).style.display = "none"
							}}
						/>
					))}
				</div>
			) : null}
		</div>
	)
}

export const definition = {
	props: z.object({
		name: z.string(),
		label: z.string().nullable(),
		placeholder: z.string().nullable(),
		value: z.array(z.string()).nullable(),
		rows: z.number().nullable(),
		preview: z.boolean().nullable()
	}),
	events: ["change"],
	description:
		"Multi-URL editor for BDO File-typed fields. Renders a textarea — " +
		"the user pastes one URL per line (or comma-separated) and the bound " +
		"state value commits as Array<string>. RAPP stores File fields as a " +
		"URL array, so this is the right component for any field whose BDO " +
		"type is `File`. Bind `value` with $bindState to the form path. Set " +
		"`preview: false` for non-image File fields.",
	example: {
		name: "ProductImages",
		label: "Product Images",
		placeholder: "Paste one image URL per line"
	}
}

export const component = FileUrls
