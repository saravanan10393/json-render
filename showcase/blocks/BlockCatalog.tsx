"use client";

/**
 * The Blocks gallery — the fragment registry browsed like the component
 * catalog. Sidebar groups blocks by tier (Generic / Domain); the main panel
 * expands the selected block's $fragment ref to primitives, renders it live
 * against the in-memory mock executor, and shows the "one ref → many
 * primitives" expansion side by side.
 */
import { ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Spec } from "@/lib/jr/schema";
import { fragmentRegistry } from "@/fragments";
import { expandFragments } from "@/lib/server/fragment-expander";
import { BlockPreview } from "./BlockPreview";
import {
  type BlockEntry,
  type BlockTier,
  buildBlockEntries,
  SECTION_LABEL,
  SECTION_ORDER,
  TIER_ORDER,
} from "./blockMeta";
import { JsonTree } from "../shared/JsonTree";
import { SchemaView } from "../components/SchemaView";
import { ParamsForm } from "./ParamsForm";

const TIER_LABEL: Record<BlockTier, string> = { generic: "Generic", domain: "Domain" };

function TierBadge({ tier }: { tier: BlockTier }) {
  const cls =
    tier === "generic"
      ? "border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400"
      : "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400";
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${cls}`}>
      {TIER_LABEL[tier]}
    </span>
  );
}

/** Instance (element) id for the demo — derived from the fragment id by
 *  dropping the "fragment-" prefix (e.g. fragment-product-grid → product-grid). */
const instanceIdFor = (id: string) => id.replace(/^fragment-/, "");

/** Drop internal tooling metadata (incl. the volatile ejectedAt timestamp in
 *  _boundaries) so the displayed JSON is deterministic and SSR-stable. */
function omitMeta(spec: Record<string, unknown>): Record<string, unknown> {
  const { _boundaries, __expandDepth, ...rest } = spec;
  void _boundaries;
  void __expandDepth;
  return rest;
}

function BlockDetail({ entry }: { entry: BlockEntry }) {
  const instanceId = instanceIdFor(entry.id);
  // Composite demos (multiple wired refs) stay read-only; single-ref demos get
  // an editable params playground.
  const isComposite = !!entry.demo?.source;
  const defaultParams = entry.demo && !isComposite ? (entry.demo.params ?? {}) : null;

  const [tab, setTab] = useState<"schema" | "params" | "expanded">("schema");
  // The params object drives the preview directly; the form edits it in place.
  const [params, setParams] = useState<Record<string, unknown>>(() => ({ ...(defaultParams ?? {}) }));

  const { sourceRef, expanded } = useMemo(() => {
    if (!entry.demo) return { sourceRef: null, expanded: null };
    if (entry.demo.source) {
      const result = expandFragments(entry.demo.source as Record<string, unknown>, fragmentRegistry);
      return { sourceRef: entry.demo.source.elements, expanded: result };
    }
    const ref = { $fragment: entry.id, params };
    const source = { root: instanceId, elements: { [instanceId]: ref } };
    const result = expandFragments(source as Record<string, unknown>, fragmentRegistry);
    return { sourceRef: { [instanceId]: ref }, expanded: result };
  }, [entry, instanceId, params]);

  const elementCount = expanded ? Object.keys((expanded.spec.elements as object) ?? {}).length : 0;
  const dsCount = expanded ? Object.keys((expanded.spec.datasources as object) ?? {}).length : 0;
  const expansionFailed = !!expanded && expanded.issues.length > 0;
  const edited = JSON.stringify(params) !== JSON.stringify(defaultParams ?? {});

  return (
    <div className="mx-auto max-w-4xl px-8 py-8">
      <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{entry.category}</div>
      <div className="flex items-center gap-3">
        <h1 className="font-mono text-2xl font-bold">{entry.name}</h1>
        <TierBadge tier={entry.tier} />
        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">{entry.id}</code>
      </div>
      {entry.description && (
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">{entry.description}</p>
      )}

      <div className="mt-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Preview
        {edited && (
          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium normal-case text-amber-600 dark:text-amber-400">
            edited params
          </span>
        )}
      </div>
      <div className="canvas-grid mt-2 flex min-h-48 items-center justify-center rounded-lg border border-dashed border-border p-8">
        <div className="w-full rounded-lg bg-background p-4">
          {!entry.demo ? (
            <p className="text-center text-sm text-muted-foreground">
              No preview data authored yet — this block needs its sample entity + records.
            </p>
          ) : expansionFailed ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              Expansion failed: {expanded?.issues.join("; ")}
            </div>
          ) : (
            <BlockPreview spec={expanded!.spec as unknown as Spec} seed={entry.demo.seed} />
          )}
        </div>
      </div>

      {entry.demo && (
        <div className="mt-8">
          {/* The agent fills these params per the user's app — including which
              entity (BDO) + field mappings. The gallery seeds sample data. */}
          <p className="mb-3 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">The agent writes these params</span> when it drops this block
            into a page — it picks the entity (<span className="font-mono">bdo</span>/<span className="font-mono">entity</span>),
            field mappings, and display options to match the user's app. See every option in <span className="font-medium">Schema</span>,
            then edit <span className="font-medium">Params</span> to preview variations (this gallery seeds sample Product/Order data).
          </p>

          <div className="flex items-center gap-4 border-b border-border">
            {(["schema", "params", "expanded"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`-mb-px border-b-2 px-1 py-2 text-xs font-semibold uppercase tracking-wide transition-colors ${
                  tab === t ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {t === "params" ? "Params" : t === "schema" ? "Schema" : "Expands to"}
              </button>
            ))}
            {tab === "params" && edited && !isComposite && (
              <button
                type="button"
                onClick={() => setParams({ ...(defaultParams ?? {}) })}
                className="ml-auto rounded px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                Reset
              </button>
            )}
          </div>

          <div className="mt-3">
            {tab === "schema" ? (
              <SchemaView schema={entry.paramsSchema} />
            ) : tab === "expanded" ? (
              <>
                <JsonTree data={expansionFailed ? { issues: expanded?.issues } : omitMeta(expanded!.spec)} />
                <p className="mt-2 text-xs text-muted-foreground">
                  {elementCount} elements · {dsCount} datasource{dsCount === 1 ? "" : "s"} · materialised at save time.
                </p>
              </>
            ) : isComposite ? (
              <>
                <JsonTree data={sourceRef} />
                <p className="mt-2 text-xs text-muted-foreground">
                  Composite demo (multiple wired refs) — not editable here.
                </p>
              </>
            ) : (
              <>
                <ParamsForm schema={entry.paramsSchema} value={params} onChange={setParams} />
                <p className="mt-3 text-xs text-muted-foreground">
                  Edit the params — the preview re-expands live. Cleared optional fields fall back to their schema defaults.
                </p>
                <details className="mt-3 text-xs">
                  <summary className="cursor-pointer select-none text-muted-foreground hover:text-foreground">
                    Params JSON
                  </summary>
                  <pre className="mt-2 max-h-[28rem] overflow-auto rounded-lg border border-zinc-800 bg-zinc-950 p-3 font-mono text-[12px] leading-relaxed text-zinc-200">
                    {JSON.stringify(params, null, 2)}
                  </pre>
                </details>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function BlockCatalog() {
  const entries = useMemo(() => buildBlockEntries(), []);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string>("");
  // Collapsible groups, mirroring the Components catalog. Keys are namespaced
  // ("tier:domain", "bundle:crm") so a tier and a bundle can't collide.
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const toggle = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  // A search forces everything open (so matches are never hidden in a collapsed group).
  const isOpen = (key: string) => query.trim() !== "" || !collapsed.has(key);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q),
    );
  }, [entries, query]);

  const byTier = useMemo(() => {
    const map = new Map<BlockTier, BlockEntry[]>();
    for (const tier of TIER_ORDER) map.set(tier, []);
    for (const e of filtered) map.get(e.tier)?.push(e);
    for (const list of map.values()) list.sort((a, b) => a.name.localeCompare(b.name));
    return map;
  }, [filtered]);

  useEffect(() => {
    if (filtered.length === 0) return;
    if (!filtered.some((e) => e.name === selected)) setSelected(filtered[0].name);
  }, [filtered, selected]);

  const selectedEntry = entries.find((e) => e.name === selected) ?? filtered[0] ?? null;

  return (
    <>
      <aside className="flex w-72 shrink-0 flex-col border-r border-border">
        <div className="shrink-0 border-b border-border p-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search blocks…"
            className="h-8 w-full rounded-md border border-border bg-background px-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <nav className="min-h-0 flex-1 overflow-y-auto p-2">
          {TIER_ORDER.map((tier) => {
            const list = byTier.get(tier) ?? [];
            if (list.length === 0) return null;
            // Sub-group a tier's blocks by bundle, preserving sorted order.
            const bundles = new Map<string, BlockEntry[]>();
            for (const entry of list) {
              const group = bundles.get(entry.bundle);
              if (group) group.push(entry);
              else bundles.set(entry.bundle, [entry]);
            }
            const tierKey = `tier:${tier}`;
            const tierOpen = isOpen(tierKey);
            const renderBlocks = (blocks: BlockEntry[]) => (
              <ul className="ml-2 border-l border-border pl-2">
                {blocks.map((entry) => {
                  const active = entry.name === selected;
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
                        {!entry.demo && <span className="text-[9px] uppercase text-muted-foreground">soon</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            );
            // Group a set of blocks by section (journey grouping) and render
            // each as its own collapsible sub-level — the 4th drilldown tier.
            const renderSections = (entries: BlockEntry[], scope: string) => {
              const bySection = new Map<string, BlockEntry[]>();
              for (const e of entries) {
                const g = bySection.get(e.section);
                if (g) g.push(e);
                else bySection.set(e.section, [e]);
              }
              const ordered = [...bySection.keys()].sort((a, b) => {
                const ia = SECTION_ORDER.indexOf(a);
                const ib = SECTION_ORDER.indexOf(b);
                if (ia !== -1 && ib !== -1) return ia - ib;
                if (ia !== -1) return -1;
                if (ib !== -1) return 1;
                return a.localeCompare(b);
              });
              return ordered.map((section) => {
                const secEntries = bySection.get(section)!;
                const sectionKey = `section:${scope}:${section}`;
                const sectionOpen = isOpen(sectionKey);
                return (
                  <div key={section}>
                    <button
                      type="button"
                      onClick={() => toggle(sectionKey)}
                      className="flex w-full items-center gap-1 rounded-md px-2 py-1 pl-6 text-left text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70 hover:bg-muted"
                    >
                      <ChevronRight
                        className={`h-3 w-3 shrink-0 transition-transform ${sectionOpen ? "rotate-90" : ""}`}
                      />
                      <span className="flex-1">{SECTION_LABEL[section] ?? section}</span>
                      <span className="font-normal">{secEntries.length}</span>
                    </button>
                    {sectionOpen && renderBlocks(secEntries)}
                  </div>
                );
              });
            };
            return (
              <div key={tier} className="mb-2">
                <button
                  type="button"
                  onClick={() => toggle(tierKey)}
                  className="flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:bg-muted"
                >
                  <ChevronRight
                    className={`h-3.5 w-3.5 shrink-0 transition-transform ${tierOpen ? "rotate-90" : ""}`}
                  />
                  <span className="flex-1">{TIER_LABEL[tier]}</span>
                  <span className="text-[10px] font-normal">{list.length}</span>
                </button>
                {tierOpen &&
                  [...bundles].map(([bundle, entries]) => {
                    // A tier whose single bundle shares its name (Generic) has no
                    // sub-header — the tier toggle already controls the list.
                    if (bundle === tier) return <div key={bundle}>{renderSections(entries, tier)}</div>;
                    const bundleKey = `bundle:${bundle}`;
                    const bundleOpen = isOpen(bundleKey);
                    return (
                      <div key={bundle}>
                        <button
                          type="button"
                          onClick={() => toggle(bundleKey)}
                          className="flex w-full items-center gap-1 rounded-md px-2 py-1 pl-4 text-left text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70 hover:bg-muted"
                        >
                          <ChevronRight
                            className={`h-3 w-3 shrink-0 transition-transform ${bundleOpen ? "rotate-90" : ""}`}
                          />
                          <span className="flex-1">{bundle}</span>
                          <span className="font-normal">{entries.length}</span>
                        </button>
                        {bundleOpen && renderSections(entries, bundle)}
                      </div>
                    );
                  })}
              </div>
            );
          })}
          {filtered.length === 0 && (
            <p className="px-2 py-4 text-center text-xs text-muted-foreground">No blocks match “{query}”.</p>
          )}
        </nav>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto">
        {selectedEntry ? (
          <BlockDetail key={selectedEntry.name} entry={selectedEntry} />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Select a block from the sidebar.
          </div>
        )}
      </main>
    </>
  );
}
