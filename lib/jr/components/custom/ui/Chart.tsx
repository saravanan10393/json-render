/**
 * Chart — json-render catalog component for bdo.metric GroupBy series.
 * Binds `data` to {$datasource: "<metricDs>/data/series"} — each point is
 * { <groupByField>: "label", value: <number> } (see entity-store metricKey).
 * kind "leaderboard" renders ranked rows (no SVG) — sorted/limited like charts.
 */
import { type BaseComponentProps } from "@json-render/react"
import { useMemo } from "react"
import {
	Area, AreaChart, Bar, BarChart, Cell, Line, LineChart,
	Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts"
import { z } from "zod"

const PALETTE = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4", "#a855f7", "#84cc16", "#f97316"]

interface ChartProps {
	kind: "bar" | "line" | "area" | "donut" | "pie" | "leaderboard"
	data?: Array<Record<string, unknown>> | null
	labelKey?: string | null
	valueKey?: string | null
	sort?: "asc" | "desc" | null
	limit?: number | null
	height?: number | null
	valueFormat?: "plain" | "currency" | "percent" | null
}

function fmt(n: number, format?: string | null): string {
	if (format === "currency") return `$${n.toLocaleString()}`
	if (format === "percent") return `${n}%`
	return n.toLocaleString()
}

function Chart({ props }: BaseComponentProps<ChartProps>) {
	const labelKey = props.labelKey ?? "label"
	const valueKey = props.valueKey ?? "value"
	const rows = useMemo(() => {
		let r = (Array.isArray(props.data) ? props.data : [])
			.filter((d) => d && typeof d === "object")
			.map((d) => ({
				label: String((d as Record<string, unknown>)[labelKey] ?? ""),
				value: Number((d as Record<string, unknown>)[valueKey] ?? 0),
			}))
		if (props.sort === "asc") r = [...r].sort((a, b) => a.value - b.value)
		if (props.sort === "desc") r = [...r].sort((a, b) => b.value - a.value)
		if (props.limit && props.limit > 0) r = r.slice(0, props.limit)
		return r
	}, [props.data, labelKey, valueKey, props.sort, props.limit])
	const height = props.height ?? 240

	if (rows.length === 0) {
		return <div className="flex items-center justify-center text-sm text-muted-foreground" style={props.kind === "leaderboard" ? undefined : { height }}>No data</div>
	}

	if (props.kind === "leaderboard") {
		const max = Math.max(...rows.map((r) => r.value), 1)
		return (
			<div className="flex flex-col gap-2">
				{rows.map((r, i) => (
					<div key={r.label + i} className="flex items-center gap-3">
						<span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">{i + 1}</span>
						<span className="w-32 truncate text-sm">{r.label}</span>
						<div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
							<div className="h-full rounded-full" style={{ width: `${(r.value / max) * 100}%`, background: PALETTE[i % PALETTE.length] }} />
						</div>
						<span className="w-20 shrink-0 text-right text-sm tabular-nums">{fmt(r.value, props.valueFormat)}</span>
					</div>
				))}
			</div>
		)
	}

	const pielike = props.kind === "donut" || props.kind === "pie"
	return (
		<ResponsiveContainer width="100%" height={height}>
			{pielike ? (
				<PieChart>
					<Tooltip formatter={(v) => fmt(Number(v), props.valueFormat)} />
					<Pie data={rows} dataKey="value" nameKey="label" innerRadius={props.kind === "donut" ? "55%" : 0} outerRadius="70%" label={(e) => (e as unknown as { label: string }).label}>
						{rows.map((r, i) => <Cell key={r.label + i} fill={PALETTE[i % PALETTE.length]} />)}
					</Pie>
				</PieChart>
			) : props.kind === "line" ? (
				<LineChart data={rows}>
					<XAxis dataKey="label" fontSize={12} /><YAxis fontSize={12} width={40} />
					<Tooltip formatter={(v) => fmt(Number(v), props.valueFormat)} />
					<Line type="monotone" dataKey="value" stroke={PALETTE[0]} strokeWidth={2} dot={false} />
				</LineChart>
			) : props.kind === "area" ? (
				<AreaChart data={rows}>
					<XAxis dataKey="label" fontSize={12} /><YAxis fontSize={12} width={40} />
					<Tooltip formatter={(v) => fmt(Number(v), props.valueFormat)} />
					<Area type="monotone" dataKey="value" stroke={PALETTE[0]} fill={PALETTE[0]} fillOpacity={0.25} />
				</AreaChart>
			) : (
				<BarChart data={rows}>
					<XAxis dataKey="label" fontSize={12} /><YAxis fontSize={12} width={40} />
					<Tooltip formatter={(v) => fmt(Number(v), props.valueFormat)} />
					<Bar dataKey="value" radius={[4, 4, 0, 0]}>
						{rows.map((r, i) => <Cell key={r.label + i} fill={PALETTE[i % PALETTE.length]} />)}
					</Bar>
				</BarChart>
			)}
		</ResponsiveContainer>
	)
}

export const definition = {
	props: z.object({
		kind: z.enum(["bar", "line", "area", "donut", "pie", "leaderboard"]),
		data: z
			.array(z.record(z.string(), z.unknown()))
			.nullable()
			.describe('Series points. Bind {$datasource: "<metricDs>/data/series"} — points look like {<groupField>: "label", value: n}.'),
		labelKey: z.string().nullable().describe("Point key holding the label — set to the GroupBy field id. Default 'label'."),
		valueKey: z.string().nullable().describe("Point key holding the number. bdo.metric with ONE Metric entry emits 'value' (the default)."),
		sort: z.enum(["asc", "desc"]).nullable().describe("Sort points by value before rendering."),
		limit: z.number().int().positive().nullable().describe("Keep only the first N points (after sort)."),
		height: z.number().nullable().describe("Pixel height (default 240). Ignored by 'leaderboard'."),
		valueFormat: z.enum(["plain", "currency", "percent"]).nullable(),
	}),
	description:
		"Chart over a bdo.metric GroupBy series: bar | line | area | donut | pie, plus 'leaderboard' " +
		"(ranked rows with bars — use for top-N). Bind data to {$datasource: \"<metricDs>/data/series\"} " +
		"and set labelKey to the GroupBy field id; valueKey defaults to 'value'.",
	example: { kind: "bar", labelKey: "Status", valueKey: "value", height: 240 },
}

export const component = Chart
