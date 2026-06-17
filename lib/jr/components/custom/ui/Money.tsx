/**
 * Money — formats a numeric value via Intl.NumberFormat. Despite the name it
 * handles three styles: "currency" (default — symbol + grouping, the price use
 * case), "decimal" (grouped plain number, e.g. a rounded average), and
 * "percent" (appends %). `maximumFractionDigits` controls rounding (the fix for
 * raw floats like 4.16666… overflowing a stat card). Optional `compareAt`
 * (currency only) renders a struck-through original + discount badge for sales.
 *
 * Pure display leaf (no binding): drive `value` with { $state } / { $template }
 * or a literal.
 */
import { type BaseComponentProps } from "@json-render/react"
import { z } from "zod"
import { cn } from "@/lib/utils"

interface MoneyProps {
	value?: number | string | null
	style?: "currency" | "decimal" | "percent" | null
	currency?: string | null
	locale?: string | null
	maximumFractionDigits?: number | null
	suffix?: string | null
	compareAt?: number | string | null
	showDiscount?: boolean | null
	size?: "sm" | "md" | "lg" | "xl" | null
	className?: string | null
}

const SIZE: Record<string, string> = {
	sm: "text-sm",
	md: "text-base",
	lg: "text-lg",
	xl: "text-2xl"
}

function Money({ props }: BaseComponentProps<MoneyProps>) {
	const value = Number(props.value ?? 0)
	const compareAt = props.compareAt == null ? null : Number(props.compareAt)
	const style = props.style ?? "currency"
	const currency = props.currency || "USD"
	const locale = props.locale || undefined
	const mfd = props.maximumFractionDigits ?? (style === "currency" ? 2 : style === "decimal" ? 1 : 0)
	const suffix = props.suffix ?? (style === "percent" ? "%" : "")

	const opts: Intl.NumberFormatOptions =
		style === "currency" ? { style: "currency", currency } : { maximumFractionDigits: mfd }
	let fmt: Intl.NumberFormat
	try {
		fmt = new Intl.NumberFormat(locale, opts)
	} catch {
		// Bad locale/currency code — fall back rather than throw mid-render.
		fmt = new Intl.NumberFormat(undefined, style === "currency" ? { style: "currency", currency: "USD" } : { maximumFractionDigits: mfd })
	}
	const format = (n: number) => (Number.isFinite(n) ? fmt.format(n) + suffix : String(props.value ?? ""))

	// Sale comparison is a currency-only affordance.
	const onSale = style === "currency" && compareAt != null && Number.isFinite(compareAt) && compareAt > value
	const discount = onSale ? Math.round((1 - value / compareAt!) * 100) : 0

	return (
		<span className={cn("inline-flex items-baseline gap-2", SIZE[props.size ?? "md"], props.className)}>
			<span className={cn("font-semibold tabular-nums", onSale && "text-destructive")}>{format(value)}</span>
			{onSale && (
				<span className="text-[0.8em] font-normal tabular-nums text-muted-foreground line-through">
					{format(compareAt!)}
				</span>
			)}
			{onSale && (props.showDiscount ?? true) && (
				<span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[0.7em] font-medium text-emerald-600 dark:text-emerald-400">
					-{discount}%
				</span>
			)}
		</span>
	)
}

export const definition = {
	props: z.object({
		value: z
			.union([z.number(), z.string()])
			.nullable()
			.describe("The number to format. Bind with { $state } / { $template } or pass a literal."),
		style: z
			.enum(["currency", "decimal", "percent"])
			.nullable()
			.describe("'currency' (default, symbol+grouping), 'decimal' (grouped plain number), or 'percent' (appends %)."),
		currency: z.string().nullable().describe("ISO 4217 code for currency style (default 'USD'), e.g. 'EUR', 'GBP', 'INR'."),
		locale: z.string().nullable().describe("BCP-47 locale for grouping/symbol placement (default the runtime locale)."),
		maximumFractionDigits: z
			.number()
			.nullable()
			.describe("Decimal places to round to (default: currency 2, decimal 1, percent 0). Use to tame raw floats."),
		suffix: z.string().nullable().describe("Text appended after the number (percent adds % automatically)."),
		compareAt: z
			.union([z.number(), z.string()])
			.nullable()
			.describe("Currency only: original/list price. When greater than `value`, renders struck-through (sale price)."),
		showDiscount: z.boolean().nullable().describe("Show a '-N%' discount badge when on sale (default true)."),
		size: z.enum(["sm", "md", "lg", "xl"]).nullable().describe("Type scale (default 'md'). Use 'xl' on a PDP price or KPI."),
		className: z.string().nullable()
	}),
	description:
		"Number formatter via Intl.NumberFormat — currency (default), decimal, or percent style, with rounding via " +
		"maximumFractionDigits. Optional currency `compareAt` shows a struck original + discount badge. Use for prices, " +
		"KPI values, ratings, percentages.",
	example: { value: 1299.5, currency: "USD", compareAt: 1599, size: "lg" }
}

export const component = Money
