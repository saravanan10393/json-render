"use client"

import { type BaseComponentProps, useBoundProp, useStateBinding } from "@json-render/react"
import { useState } from "react"
import type { ShadcnProps } from "./catalog"
import { cn } from "@/lib/utils"
import { AccordionContent, AccordionItem, Accordion as AccordionPrimitive, AccordionTrigger } from "./ui/accordion"
import { Alert, AlertDescription, AlertTitle } from "./ui/alert"
import { AvatarFallback, AvatarImage, Avatar as AvatarPrimitive } from "./ui/avatar"
import { Badge } from "./ui/badge"
import { Button } from "./ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card"
import {
	CarouselContent,
	CarouselItem,
	CarouselNext,
	CarouselPrevious,
	Carousel as CarouselPrimitive
} from "./ui/carousel"
import { Checkbox } from "./ui/checkbox"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible"
import { DialogContent, DialogDescription, DialogHeader, Dialog as DialogPrimitive, DialogTitle } from "./ui/dialog"
import { DrawerContent, DrawerDescription, DrawerHeader, Drawer as DrawerPrimitive, DrawerTitle } from "./ui/drawer"
import {
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenu as DropdownMenuPrimitive,
	DropdownMenuTrigger
} from "./ui/dropdown-menu"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import {
	PaginationContent,
	PaginationEllipsis,
	PaginationItem,
	PaginationLink,
	PaginationNext,
	PaginationPrevious,
	Pagination as PaginationPrimitive
} from "./ui/pagination"
import { PopoverContent, Popover as PopoverPrimitive, PopoverTrigger } from "./ui/popover"
import { Progress } from "./ui/progress"
import { RadioGroup, RadioGroupItem } from "./ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select"
import { Separator } from "./ui/separator"
import { Skeleton } from "./ui/skeleton"
import { Slider } from "./ui/slider"
import { Switch } from "./ui/switch"
import {
	TableBody,
	TableCaption,
	TableCell,
	TableHead,
	TableHeader,
	Table as TablePrimitive,
	TableRow
} from "./ui/table"
import { TabsList, Tabs as TabsPrimitive, TabsTrigger } from "./ui/tabs"
import { Textarea } from "./ui/textarea"
import { Toggle } from "./ui/toggle"
import { ToggleGroup, ToggleGroupItem } from "./ui/toggle-group"
import { TooltipContent, Tooltip as TooltipPrimitive, TooltipProvider, TooltipTrigger } from "./ui/tooltip"

// =============================================================================
// Helpers
// =============================================================================

function getPaginationRange(current: number, total: number): Array<number | "ellipsis"> {
	if (total <= 7) {
		return Array.from({ length: total }, (_, i) => i + 1)
	}
	const pages: Array<number | "ellipsis"> = []
	pages.push(1)
	if (current > 3) {
		pages.push("ellipsis")
	}
	const start = Math.max(2, current - 1)
	const end = Math.min(total - 1, current + 1)
	for (let i = start; i <= end; i++) {
		pages.push(i)
	}
	if (current < total - 2) {
		pages.push("ellipsis")
	}
	pages.push(total)
	return pages
}

// =============================================================================
// Standard Component Implementations
// =============================================================================

/**
 * Standard shadcn/ui component implementations.
 *
 * Pass to `defineRegistry()` from `@json-render/react` to create a
 * component registry for rendering JSON specs with shadcn/ui components.
 *
 * @example
 * ```ts
 * import { defineRegistry } from "@json-render/react";
 * import { shadcnComponents } from "@/lib/jr/components/shadcn";
 *
 * const { registry } = defineRegistry(catalog, {
 *   components: {
 *     Card: shadcnComponents.Card,
 *     Button: shadcnComponents.Button,
 *   },
 * });
 * ```
 */
export const shadcnComponents = {
	// ── Layout ────────────────────────────────────────────────────────────

	Card: ({ props, children }: BaseComponentProps<ShadcnProps<"Card">>) => {
		const maxWidthClass =
			props.maxWidth === "sm"
				? "max-w-xs sm:min-w-[280px]"
				: props.maxWidth === "md"
					? "max-w-sm sm:min-w-[320px]"
					: props.maxWidth === "lg"
						? "max-w-md sm:min-w-[360px]"
						: "w-full"
		const centeredClass = props.centered ? "mx-auto" : ""

		return (
			<Card className={cn(maxWidthClass, centeredClass, props.className)}>
				{(props.title || props.description) && (
					<CardHeader>
						{props.title && <CardTitle>{props.title}</CardTitle>}
						{props.description && <CardDescription>{props.description}</CardDescription>}
					</CardHeader>
				)}
				<CardContent className="flex flex-col gap-3">{children}</CardContent>
			</Card>
		)
	},

	Separator: ({ props }: BaseComponentProps<ShadcnProps<"Separator">>) => {
		return (
			<Separator
				orientation={props.orientation ?? "horizontal"}
				className={props.orientation === "vertical" ? "h-full mx-2" : "my-3"}
			/>
		)
	},

	Tabs: ({ props, children, bindings, emit }: BaseComponentProps<ShadcnProps<"Tabs">>) => {
		const tabs = props.tabs ?? []
		const [boundValue, setBoundValue] = useBoundProp<string>(props.value as string | undefined, bindings?.value)
		const [localValue, setLocalValue] = useState(props.defaultValue ?? tabs[0]?.value ?? "")
		const isBound = !!bindings?.value
		const value = isBound ? (boundValue ?? tabs[0]?.value ?? "") : localValue
		const setValue = isBound ? setBoundValue : setLocalValue

		return (
			<TabsPrimitive
				value={value}
				onValueChange={(v) => {
					setValue(v)
					emit("change")
				}}
			>
				<TabsList>
					{tabs.map((tab) => (
						<TabsTrigger key={tab.value} value={tab.value}>
							{tab.label}
						</TabsTrigger>
					))}
				</TabsList>
				{children}
			</TabsPrimitive>
		)
	},

	Accordion: ({ props }: BaseComponentProps<ShadcnProps<"Accordion">>) => {
		const items = props.items ?? []
		const isMultiple = props.type === "multiple"

		const itemElements = items.map((item, i) => (
			<AccordionItem key={i} value={`item-${i}`}>
				<AccordionTrigger>{item.title}</AccordionTrigger>
				<AccordionContent>{item.content}</AccordionContent>
			</AccordionItem>
		))

		if (isMultiple) {
			return (
				<AccordionPrimitive type="multiple" className="w-full">
					{itemElements}
				</AccordionPrimitive>
			)
		}
		return (
			<AccordionPrimitive type="single" collapsible className="w-full">
				{itemElements}
			</AccordionPrimitive>
		)
	},

	Collapsible: ({ props, children }: BaseComponentProps<ShadcnProps<"Collapsible">>) => {
		const [open, setOpen] = useState(props.defaultOpen ?? false)
		return (
			<Collapsible open={open} onOpenChange={setOpen} className="w-full">
				<CollapsibleTrigger asChild>
					<button className="flex w-full items-center justify-between rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors">
						{props.title}
						<svg
							className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							strokeWidth={2}
						>
							<path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
						</svg>
					</button>
				</CollapsibleTrigger>
				<CollapsibleContent className="pt-2">{children}</CollapsibleContent>
			</Collapsible>
		)
	},

	Dialog: ({ props, children }: BaseComponentProps<ShadcnProps<"Dialog">>) => {
		const [open, setOpen] = useStateBinding<boolean>(props.openPath ?? "")
		return (
			<DialogPrimitive open={open ?? false} onOpenChange={(v) => setOpen(v)}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{props.title}</DialogTitle>
						{props.description && <DialogDescription>{props.description}</DialogDescription>}
					</DialogHeader>
					{children}
				</DialogContent>
			</DialogPrimitive>
		)
	},

	Drawer: ({ props, children }: BaseComponentProps<ShadcnProps<"Drawer">>) => {
		const [open, setOpen] = useStateBinding<boolean>(props.openPath ?? "")
		return (
			<DrawerPrimitive open={open ?? false} onOpenChange={(v) => setOpen(v)}>
				<DrawerContent>
					<DrawerHeader>
						<DrawerTitle>{props.title}</DrawerTitle>
						{props.description && <DrawerDescription>{props.description}</DrawerDescription>}
					</DrawerHeader>
					<div className="p-4">{children}</div>
				</DrawerContent>
			</DrawerPrimitive>
		)
	},

	Carousel: ({ props }: BaseComponentProps<ShadcnProps<"Carousel">>) => {
		const items = props.items ?? []
		const imageMode = items.some((it) => it.image)
		const ar = props.aspectRatio
		return (
			<CarouselPrimitive className="w-full">
				<CarouselContent>
					{items.map((item, i) => (
						<CarouselItem key={i} className={imageMode ? "basis-full" : "basis-3/4 md:basis-1/2 lg:basis-1/3"}>
							{item.image ? (
								<div
									className="overflow-hidden rounded-xl border border-border bg-muted"
									style={ar ? { aspectRatio: ar } : undefined}
								>
									{/* biome-ignore lint/a11y/useAltText: alt falls back to title */}
									<img src={item.image} alt={item.title ?? ""} className="h-full w-full object-cover" />
								</div>
							) : (
								<div className="border border-border rounded-lg p-4 bg-card h-full">
									{item.title && <h4 className="font-semibold text-sm mb-1">{item.title}</h4>}
									{item.description && <p className="text-sm text-muted-foreground">{item.description}</p>}
								</div>
							)}
						</CarouselItem>
					))}
				</CarouselContent>
				{/* Inset arrows over the image in image mode (default sits outside the content). */}
				<CarouselPrevious className={imageMode ? "left-2" : undefined} />
				<CarouselNext className={imageMode ? "right-2" : undefined} />
			</CarouselPrimitive>
		)
	},

	// ── Data Display ──────────────────────────────────────────────────────

	Table: ({ props }: BaseComponentProps<ShadcnProps<"Table">>) => {
		const columns = props.columns ?? []
		const rows = (props.rows ?? []).map((row) => row.map(String))

		return (
			<div className="rounded-md border border-border overflow-hidden">
				<TablePrimitive>
					{props.caption && <TableCaption>{props.caption}</TableCaption>}
					<TableHeader>
						<TableRow>
							{columns.map((col) => (
								<TableHead key={col}>{col}</TableHead>
							))}
						</TableRow>
					</TableHeader>
					<TableBody>
						{rows.map((row, i) => (
							<TableRow key={i}>
								{row.map((cell, j) => (
									<TableCell key={j}>{cell}</TableCell>
								))}
							</TableRow>
						))}
					</TableBody>
				</TablePrimitive>
			</div>
		)
	},

	Avatar: ({ props }: BaseComponentProps<ShadcnProps<"Avatar">>) => {
		const name = props.name || "?"
		const initials = name
			.split(" ")
			.map((n) => n[0])
			.join("")
			.slice(0, 2)
			.toUpperCase()
		const sizeClass = props.size === "lg" ? "h-12 w-12" : props.size === "sm" ? "h-8 w-8" : "h-10 w-10"

		return (
			<AvatarPrimitive className={sizeClass}>
				{props.src && <AvatarImage src={props.src} alt={name} />}
				<AvatarFallback>{initials}</AvatarFallback>
			</AvatarPrimitive>
		)
	},

	Badge: ({ props }: BaseComponentProps<ShadcnProps<"Badge">>) => {
		return <Badge variant={props.variant ?? "default"}>{props.text}</Badge>
	},

	Alert: ({ props }: BaseComponentProps<ShadcnProps<"Alert">>) => {
		const variant = props.type === "error" ? "destructive" : "default"
		const customClass =
			props.type === "success"
				? "border-green-200 bg-green-50 text-green-900 dark:border-green-800 dark:bg-green-950 dark:text-green-100"
				: props.type === "warning"
					? "border-yellow-200 bg-yellow-50 text-yellow-900 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-100"
					: props.type === "info"
						? "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-100"
						: ""

		return (
			<Alert variant={variant} className={customClass}>
				<AlertTitle>{props.title}</AlertTitle>
				{props.message && <AlertDescription>{props.message}</AlertDescription>}
			</Alert>
		)
	},

	Progress: ({ props }: BaseComponentProps<ShadcnProps<"Progress">>) => {
		const value = Math.min(100, Math.max(0, props.value || 0))
		return (
			<div className="space-y-2">
				{props.label && <Label className="text-sm text-muted-foreground">{props.label}</Label>}
				<Progress value={value} />
			</div>
		)
	},

	Skeleton: ({ props }: BaseComponentProps<ShadcnProps<"Skeleton">>) => {
		return (
			<Skeleton
				className={props.rounded ? "rounded-full" : "rounded-md"}
				style={{
					width: props.width ?? "100%",
					height: props.height ?? "1.25rem"
				}}
			/>
		)
	},

	Tooltip: ({ props }: BaseComponentProps<ShadcnProps<"Tooltip">>) => {
		return (
			<TooltipProvider>
				<TooltipPrimitive>
					<TooltipTrigger asChild>
						<span className="text-sm underline decoration-dotted cursor-help">{props.text}</span>
					</TooltipTrigger>
					<TooltipContent>
						<p>{props.content}</p>
					</TooltipContent>
				</TooltipPrimitive>
			</TooltipProvider>
		)
	},

	Popover: ({ props, children }: BaseComponentProps<ShadcnProps<"Popover">>) => {
		const hasBadge = props.badge != null && props.badge !== ""
		return (
			<PopoverPrimitive>
				<PopoverTrigger asChild>
					<Button variant="outline" className="text-sm">
						{props.trigger}
						{hasBadge && (
							<Badge variant="secondary" className="ml-1.5">
								{props.badge}
							</Badge>
						)}
					</Button>
				</PopoverTrigger>
				<PopoverContent className="w-72">
					{props.content != null ? <p className="text-sm">{props.content}</p> : children}
				</PopoverContent>
			</PopoverPrimitive>
		)
	},

	// ── Form Inputs ───────────────────────────────────────────────────────

	// PRIMITIVES — bare controls for ad-hoc state. Record forms use Field,
	// which owns labels/validation/options. (These dropped their form-only
	// behaviour — `checks`/`validateOn`/`name` — when demoted to primitives;
	// existing specs still render: value binding + optional label remain, only
	// the inline `checks` validation is gone, and the backend still validates.)
	Input: ({ props, bindings, emit }: BaseComponentProps<ShadcnProps<"Input">>) => {
		const [boundValue, setBoundValue] = useBoundProp<string>(props.value as string | undefined, bindings?.value)
		const [localValue, setLocalValue] = useState("")
		const isBound = !!bindings?.value
		const value = isBound ? (boundValue ?? "") : localValue
		const setValue = isBound ? setBoundValue : setLocalValue

		return (
			<div className="space-y-2">
				{props.label && <Label>{props.label}</Label>}
				<Input
					type={props.type ?? "text"}
					placeholder={props.placeholder ?? ""}
					value={value}
					onChange={(e) => setValue(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter") emit("submit")
					}}
					onFocus={() => emit("focus")}
					onBlur={() => emit("blur")}
				/>
			</div>
		)
	},

	Textarea: ({ props, bindings }: BaseComponentProps<ShadcnProps<"Textarea">>) => {
		const [boundValue, setBoundValue] = useBoundProp<string>(props.value as string | undefined, bindings?.value)
		const [localValue, setLocalValue] = useState("")
		const isBound = !!bindings?.value
		const value = isBound ? (boundValue ?? "") : localValue
		const setValue = isBound ? setBoundValue : setLocalValue

		return (
			<div className="space-y-2">
				{props.label && <Label>{props.label}</Label>}
				<Textarea
					placeholder={props.placeholder ?? ""}
					rows={props.rows ?? 3}
					value={value}
					onChange={(e) => setValue(e.target.value)}
				/>
			</div>
		)
	},

	Select: ({ props, bindings, emit }: BaseComponentProps<ShadcnProps<"Select">>) => {
		const [boundValue, setBoundValue] = useBoundProp<string>(props.value as string | undefined, bindings?.value)
		const [localValue, setLocalValue] = useState<string>("")
		const isBound = !!bindings?.value
		const value = isBound ? (boundValue ?? "") : localValue
		const setValue = isBound ? setBoundValue : setLocalValue
		const rawOptions = props.options ?? []
		const options = rawOptions.map((opt) => (typeof opt === "string" ? opt : String(opt ?? "")))

		return (
			<div className="space-y-2">
				{props.label && <Label>{props.label}</Label>}
				<Select
					value={value}
					onValueChange={(v) => {
						setValue(v)
						emit("change")
					}}
				>
					<SelectTrigger className="w-full">
						<SelectValue placeholder={props.placeholder ?? "Select..."} />
					</SelectTrigger>
					<SelectContent>
						{options.map((opt, idx) => (
							<SelectItem key={`${idx}-${opt}`} value={opt || `option-${idx}`}>
								{opt}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
		)
	},

	Checkbox: ({ props, bindings, emit }: BaseComponentProps<ShadcnProps<"Checkbox">>) => {
		const [boundChecked, setBoundChecked] = useBoundProp<boolean>(
			props.checked as boolean | undefined,
			bindings?.checked
		)
		const [localChecked, setLocalChecked] = useState(!!props.checked)
		const isBound = !!bindings?.checked
		const checked = isBound ? (boundChecked ?? false) : localChecked
		const setChecked = isBound ? setBoundChecked : setLocalChecked

		return (
			<div className="flex items-center space-x-2">
				<Checkbox
					checked={checked}
					onCheckedChange={(c) => {
						setChecked(c === true)
						emit("change")
					}}
				/>
				{props.label && <Label className="cursor-pointer">{props.label}</Label>}
			</div>
		)
	},

	Radio: ({ props, bindings, emit }: BaseComponentProps<ShadcnProps<"Radio">>) => {
		const rawOptions = props.options ?? []
		const options = rawOptions.map((opt) => (typeof opt === "string" ? opt : String(opt ?? "")))
		const [boundValue, setBoundValue] = useBoundProp<string>(props.value as string | undefined, bindings?.value)
		const [localValue, setLocalValue] = useState(options[0] ?? "")
		const isBound = !!bindings?.value
		const value = isBound ? (boundValue ?? "") : localValue
		const setValue = isBound ? setBoundValue : setLocalValue

		return (
			<div className="space-y-2">
				{props.label && <Label>{props.label}</Label>}
				<RadioGroup
					value={value}
					onValueChange={(v) => {
						setValue(v)
						emit("change")
					}}
				>
					{options.map((opt, idx) => (
						<div key={`${idx}-${opt}`} className="flex items-center space-x-2">
							<RadioGroupItem value={opt || `option-${idx}`} id={`radio-${idx}-${opt}`} />
							<Label htmlFor={`radio-${idx}-${opt}`} className="cursor-pointer">
								{opt}
							</Label>
						</div>
					))}
				</RadioGroup>
			</div>
		)
	},

	Switch: ({ props, bindings, emit }: BaseComponentProps<ShadcnProps<"Switch">>) => {
		const [boundChecked, setBoundChecked] = useBoundProp<boolean>(
			props.checked as boolean | undefined,
			bindings?.checked
		)
		const [localChecked, setLocalChecked] = useState(!!props.checked)
		const isBound = !!bindings?.checked
		const checked = isBound ? (boundChecked ?? false) : localChecked
		const setChecked = isBound ? setBoundChecked : setLocalChecked

		return (
			<div className="flex items-center justify-between space-x-2">
				{props.label && <Label className="cursor-pointer">{props.label}</Label>}
				<Switch
					checked={checked}
					onCheckedChange={(c) => {
						setChecked(c)
						emit("change")
					}}
				/>
			</div>
		)
	},

	Slider: ({ props, bindings, emit }: BaseComponentProps<ShadcnProps<"Slider">>) => {
		const [boundValue, setBoundValue] = useBoundProp<number>(props.value as number | undefined, bindings?.value)
		const [localValue, setLocalValue] = useState(props.min ?? 0)
		const isBound = !!bindings?.value
		const value = isBound ? (boundValue ?? props.min ?? 0) : localValue
		const setValue = isBound ? setBoundValue : setLocalValue

		return (
			<div className="space-y-2">
				{props.label && (
					<div className="flex justify-between">
						<Label className="text-sm">{props.label}</Label>
						<span className="text-sm text-muted-foreground">{value}</span>
					</div>
				)}
				<Slider
					value={[value]}
					min={props.min ?? 0}
					max={props.max ?? 100}
					step={props.step ?? 1}
					onValueChange={(v) => {
						setValue(v[0] ?? 0)
						emit("change")
					}}
				/>
			</div>
		)
	},

	// ── Actions ───────────────────────────────────────────────────────────

	Button: ({ props, emit }: BaseComponentProps<ShadcnProps<"Button">>) => {
		const variant = props.variant === "danger" ? "destructive" : props.variant === "secondary" ? "secondary" : "default"

		return (
			<Button variant={variant} disabled={props.disabled ?? false} onClick={() => emit("press")}>
				{props.label}
			</Button>
		)
	},

	DropdownMenu: ({ props, bindings, emit }: BaseComponentProps<ShadcnProps<"DropdownMenu">>) => {
		const items = props.items ?? []
		const [, setBoundValue] = useBoundProp<string>(props.value as string | undefined, bindings?.value)
		return (
			<DropdownMenuPrimitive>
				<DropdownMenuTrigger asChild>
					<Button variant="outline">{props.label}</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent>
					{items.map((item) => (
						<DropdownMenuItem
							key={item.value}
							onClick={() => {
								setBoundValue(item.value)
								emit("select")
							}}
						>
							{item.label}
						</DropdownMenuItem>
					))}
				</DropdownMenuContent>
			</DropdownMenuPrimitive>
		)
	},

	Toggle: ({ props, bindings, emit }: BaseComponentProps<ShadcnProps<"Toggle">>) => {
		const [boundPressed, setBoundPressed] = useBoundProp<boolean>(
			props.pressed as boolean | undefined,
			bindings?.pressed
		)
		const [localPressed, setLocalPressed] = useState(props.pressed ?? false)
		const isBound = !!bindings?.pressed
		const pressed = isBound ? (boundPressed ?? false) : localPressed
		const setPressed = isBound ? setBoundPressed : setLocalPressed

		return (
			<Toggle
				variant={props.variant ?? "default"}
				pressed={pressed}
				onPressedChange={(v) => {
					setPressed(v)
					emit("change")
				}}
			>
				{props.label}
			</Toggle>
		)
	},

	ToggleGroup: ({ props, bindings, emit }: BaseComponentProps<ShadcnProps<"ToggleGroup">>) => {
		const type = props.type ?? "single"
		const items = props.items ?? []
		const [boundValue, setBoundValue] = useBoundProp<string>(props.value as string | undefined, bindings?.value)
		const [localValue, setLocalValue] = useState(items[0]?.value ?? "")
		const isBound = !!bindings?.value
		const value = isBound ? (boundValue ?? "") : localValue
		const setValue = isBound ? setBoundValue : setLocalValue

		if (type === "multiple") {
			const selected = value ? value.split(",").filter(Boolean) : []
			return (
				<ToggleGroup
					type="multiple"
					value={selected}
					onValueChange={(v) => {
						setValue(v.join(","))
						emit("change")
					}}
				>
					{items.map((item) => (
						<ToggleGroupItem key={item.value} value={item.value}>
							{item.label}
						</ToggleGroupItem>
					))}
				</ToggleGroup>
			)
		}

		return (
			<ToggleGroup
				type="single"
				value={value}
				onValueChange={(v) => {
					if (v) {
						setValue(v)
						emit("change")
					}
				}}
			>
				{items.map((item) => (
					<ToggleGroupItem key={item.value} value={item.value}>
						{item.label}
					</ToggleGroupItem>
				))}
			</ToggleGroup>
		)
	},

	Pagination: ({ props, bindings, emit }: BaseComponentProps<ShadcnProps<"Pagination">>) => {
		const [boundPage, setBoundPage] = useBoundProp<number>(props.page as number | undefined, bindings?.page)
		const currentPage = boundPage ?? 1
		const totalPages = props.totalPages ?? 1
		const pages = getPaginationRange(currentPage, totalPages)

		return (
			<PaginationPrimitive>
				<PaginationContent>
					<PaginationItem>
						<PaginationPrevious
							href="#"
							onClick={(e) => {
								e.preventDefault()
								if (currentPage > 1) {
									setBoundPage(currentPage - 1)
									emit("change")
								}
							}}
						/>
					</PaginationItem>
					{pages.map((page, idx) =>
						page === "ellipsis" ? (
							<PaginationItem key={`ellipsis-${idx}`}>
								<PaginationEllipsis />
							</PaginationItem>
						) : (
							<PaginationItem key={page}>
								<PaginationLink
									href="#"
									isActive={page === currentPage}
									onClick={(e) => {
										e.preventDefault()
										setBoundPage(page)
										emit("change")
									}}
								>
									{page}
								</PaginationLink>
							</PaginationItem>
						)
					)}
					<PaginationItem>
						<PaginationNext
							href="#"
							onClick={(e) => {
								e.preventDefault()
								if (currentPage < totalPages) {
									setBoundPage(currentPage + 1)
									emit("change")
								}
							}}
						/>
					</PaginationItem>
				</PaginationContent>
			</PaginationPrimitive>
		)
	}
}
