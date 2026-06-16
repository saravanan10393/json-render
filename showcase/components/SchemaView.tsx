"use client"

/**
 * SchemaView — renders a component's Zod props schema as a readable contract:
 * a table of prop name · type · required · description, derived by converting
 * the Zod schema to JSON Schema (zod 4's `z.toJSONSchema`). A raw JSON-Schema
 * tree is available below for the full detail.
 */
import { z } from "zod"
import { InfoHint } from "../shared/InfoHint"

type JsonSchema = {
	type?: string | string[]
	enum?: unknown[]
	anyOf?: JsonSchema[]
	items?: JsonSchema
	properties?: Record<string, JsonSchema>
	required?: string[]
	description?: string
	additionalProperties?: boolean | JsonSchema
}

const isNullable = (node: JsonSchema): boolean =>
	(node.anyOf?.some((o) => o.type === "null") ?? false) || (Array.isArray(node.type) && node.type.includes("null"))

/** A compact, prompt-style type string for a JSON Schema node. */
function typeLabel(node: JsonSchema | undefined): string {
	if (!node) return "unknown"
	if (node.anyOf) {
		const parts = node.anyOf.filter((o) => o.type !== "null").map(typeLabel)
		return parts.length > 0 ? parts.join(" | ") : "null"
	}
	if (node.enum) {
		return node.enum.map((v) => (typeof v === "string" ? `"${v}"` : String(v))).join(" | ")
	}
	if (node.type === "array") return `Array<${typeLabel(node.items)}>`
	if (node.type === "object") {
		const keys = Object.keys(node.properties ?? {})
		return keys.length > 0 ? `{ ${keys.join(", ")} }` : "object"
	}
	if (Array.isArray(node.type)) return node.type.filter((t) => t !== "null").join(" | ") || "null"
	return node.type ?? "unknown"
}

export function SchemaView({ schema }: { schema: unknown }) {
	let json: JsonSchema | null = null
	let error: string | null = null
	try {
		// `unrepresentable: "any"` keeps z.unknown()/z.custom() from throwing.
		json = z.toJSONSchema(schema as z.ZodType, { unrepresentable: "any" }) as JsonSchema
	} catch (e) {
		error = (e as Error).message
	}

	if (error || !json) {
		return <p className="text-xs text-muted-foreground">Schema preview unavailable{error ? `: ${error}` : ""}.</p>
	}

	const props = json.properties ?? {}
	const required = new Set(json.required ?? [])
	const rows = Object.entries(props)

	if (rows.length === 0) {
		return <p className="text-xs text-muted-foreground">This component takes no props.</p>
	}

	return (
		<div className="space-y-3">
			<div className="overflow-hidden rounded-lg border border-border">
				<table className="w-full text-left text-sm">
					<thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
						<tr>
							<th className="px-3 py-2 font-medium">Prop</th>
							<th className="px-3 py-2 font-medium">Type</th>
							<th className="px-3 py-2 font-medium">Required</th>
						</tr>
					</thead>
					<tbody>
						{rows.map(([name, node]) => {
							const optional = !required.has(name) || isNullable(node)
							return (
								<tr key={name} className="border-t border-border align-top">
									<td className="px-3 py-2 font-mono text-[13px] font-medium">
										<span className="inline-flex items-center gap-1">
											{name}
											{node.description && <InfoHint text={node.description} />}
										</span>
									</td>
									<td className="px-3 py-2">
										<code className="font-mono text-[12px] text-sky-700 dark:text-sky-300">{typeLabel(node)}</code>
									</td>
									<td className="px-3 py-2">
										{optional ? (
											<span className="text-xs text-muted-foreground">optional</span>
										) : (
											<span className="text-xs font-medium text-foreground">required</span>
										)}
									</td>
								</tr>
							)
						})}
					</tbody>
				</table>
			</div>

			<details className="text-xs">
				<summary className="cursor-pointer select-none text-muted-foreground hover:text-foreground">
					Raw JSON Schema
				</summary>
				<pre className="mt-2 max-h-[28rem] overflow-auto rounded-lg border border-zinc-800 bg-zinc-950 p-3 font-mono text-[12px] leading-relaxed text-zinc-200">
					{JSON.stringify(json, null, 2)}
				</pre>
			</details>
		</div>
	)
}
