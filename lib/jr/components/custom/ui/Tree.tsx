/**
 * Tree — json-render catalog component. A hierarchical expand/collapse list
 * (folders, categories, org structures). Nodes are { id, label, icon?,
 * children? } nested to any depth; the bound state value is the SELECTED NODE
 * ID (a string). Expansion is internal UI state seeded from `defaultExpanded`
 * (binding it would bloat page state for no spec-visible benefit). The
 * recursive node schema uses zod 4's getter pattern — NOT z.lazy — so the
 * showcase Schema tab's z.toJSONSchema serializes it as $defs/$ref instead of
 * throwing. Node icons reuse the kebab-case lucide convention from Icon.tsx
 * (guarded by iconNames; bad names just render nothing). Registered via
 * ./index.ts.
 */
import { type BaseComponentProps, useBoundProp } from "@json-render/react"
import { ChevronRight } from "lucide-react"
import { DynamicIcon, iconNames, type IconName } from "lucide-react/dynamic"
import { useState } from "react"
import { z } from "zod"
import { cn } from "@/lib/utils"

interface TreeNodeData {
	id: string
	label: string
	icon?: string | null
	children?: TreeNodeData[] | null
}

interface TreeProps {
	nodes: TreeNodeData[]
	value?: string | null
	defaultExpanded?: string[] | null
	name?: string | null
	className?: string | null
}

const VALID_ICONS = new Set<string>(iconNames)

function collectIds(nodes: TreeNodeData[], into: string[] = []): string[] {
	for (const node of nodes) {
		into.push(node.id)
		if (node.children?.length) collectIds(node.children, into)
	}
	return into
}

function Tree({ props, bindings, emit }: BaseComponentProps<TreeProps>) {
	const [value, setValue] = useBoundProp<string | null>(props.value ?? null, bindings?.value)
	const nodes = props.nodes ?? []
	const [expanded, setExpanded] = useState<Set<string>>(() => {
		const seed = props.defaultExpanded ?? []
		return new Set(seed.includes("*") ? collectIds(nodes) : seed)
	})

	const toggle = (id: string) => {
		setExpanded((prev) => {
			const next = new Set(prev)
			if (next.has(id)) next.delete(id)
			else next.add(id)
			return next
		})
	}

	const select = (node: TreeNodeData, isBranch: boolean) => {
		setValue(node.id)
		emit("change")
		if (isBranch) toggle(node.id) // friendlier default: row click also expands
	}

	const renderNode = (node: TreeNodeData, depth: number) => {
		const children = node.children ?? []
		const isBranch = children.length > 0
		const isOpen = expanded.has(node.id)
		const isSelected = value === node.id

		return (
			<li key={node.id} role="treeitem" aria-expanded={isBranch ? isOpen : undefined} aria-selected={isSelected}>
				<button
					type="button"
					onClick={() => select(node, isBranch)}
					style={{ paddingLeft: depth * 16 + 8 }}
					className={cn(
						"flex w-full items-center gap-1.5 rounded-sm py-1.5 pr-2 text-left text-sm outline-none transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50",
						isSelected && "bg-accent text-accent-foreground hover:bg-accent"
					)}
				>
					{isBranch ? (
						<ChevronRight
							className={cn("size-4 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-90")}
							onClick={(e) => {
								e.stopPropagation()
								toggle(node.id)
							}}
						/>
					) : (
						<span className="size-4 shrink-0" />
					)}
					{node.icon && VALID_ICONS.has(node.icon) && (
						<DynamicIcon name={node.icon as IconName} className="size-4 shrink-0 text-muted-foreground" />
					)}
					<span className="truncate">{node.label}</span>
				</button>
				{isBranch && isOpen && <ul role="group">{children.map((child) => renderNode(child, depth + 1))}</ul>}
			</li>
		)
	}

	return (
		<ul role="tree" aria-label={props.name ?? "Tree"} className={cn("w-full", props.className)}>
			{nodes.map((node) => renderNode(node, 0))}
		</ul>
	)
}

// zod 4 getter-based recursion — serializes via $defs/$ref in z.toJSONSchema
// (z.lazy would throw in the showcase Schema tab).
const TreeNode = z.object({
	id: z.string().describe("Stable unique id — becomes the bound value when selected."),
	label: z.string(),
	icon: z.string().nullable().describe("Optional lucide icon name (kebab-case) shown before the label."),
	get children() {
		return z.array(TreeNode).nullable().describe("Child nodes — nest to any depth.")
	}
})

export const definition = {
	props: z.object({
		nodes: z.array(TreeNode).describe("Root nodes; nest via `children` to any depth."),
		value: z.string().nullable().describe("Selected node id. Bind with $bindState."),
		defaultExpanded: z
			.array(z.string())
			.nullable()
			.describe("Node ids expanded on first render. Pass ['*'] to expand everything."),
		name: z.string().nullable(),
		className: z.string().nullable()
	}),
	events: ["change"],
	description:
		"Hierarchical expand/collapse tree — folders, categories, org structures. Nodes " +
		"are {id, label, icon?, children?} nested to any depth. Bind `value` with " +
		"$bindState — it holds the selected node id. Row click selects (and toggles " +
		"branches); the chevron toggles only.",
	example: {
		nodes: [
			{
				id: "docs",
				label: "Documents",
				icon: "folder",
				children: [
					{ id: "reports", label: "Reports", children: [{ id: "q1", label: "Q1 summary.pdf", icon: "file-text" }] },
					{ id: "invoices", label: "Invoices" }
				]
			},
			{ id: "media", label: "Media", icon: "image" }
		],
		defaultExpanded: ["docs"]
	}
}

export const component = Tree
