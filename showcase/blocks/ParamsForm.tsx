"use client";

/**
 * ParamsForm — renders an editable control per top-level param, derived from a
 * fragment's Zod schema (via z.toJSONSchema). Booleans → checkbox, enums →
 * select, numbers → number input, strings → text input, arrays/objects → a JSON
 * field (fallback). Editing calls onChange with the next params object; an
 * emptied optional field is dropped so it falls back to the schema default. The
 * preview re-expands live off this object — no raw-JSON editing needed.
 */
import { useMemo } from "react";
import { z } from "zod";
import { InfoHint } from "../shared/InfoHint";

type Node = {
  type?: string | string[];
  enum?: unknown[];
  anyOf?: Node[];
  items?: Node;
  default?: unknown;
  description?: string;
  minimum?: number;
  maximum?: number;
};

type Kind = "enum" | "boolean" | "number" | "string" | "array" | "object" | "json";

function baseKind(node: Node): Kind {
  if (node.enum) return "enum";
  if (node.anyOf) {
    const nn = node.anyOf.filter((o) => o.type !== "null");
    if (nn.some((o) => o.enum)) return "enum";
    if (nn.some((o) => o.type === "boolean")) return "boolean";
    if (nn.some((o) => o.type === "number" || o.type === "integer")) return "number";
    if (nn.some((o) => o.type === "string")) return "string";
    if (nn.some((o) => o.type === "array")) return "array";
    if (nn.some((o) => o.type === "object")) return "object";
    return "json";
  }
  const t = Array.isArray(node.type) ? node.type.find((x) => x !== "null") : node.type;
  if (t === "integer") return "number";
  if (t === "boolean" || t === "number" || t === "string" || t === "array" || t === "object") return t as Kind;
  return "json";
}

const isNullable = (node: Node): boolean =>
  (node.anyOf?.some((o) => o.type === "null") ?? false) || (Array.isArray(node.type) && node.type.includes("null"));

const enumOptions = (node: Node): string[] =>
  ((node.enum ?? node.anyOf?.find((o) => o.enum)?.enum ?? []) as unknown[]).filter((v) => v !== null).map(String);

const nodeDefault = (node: Node): unknown =>
  node.default ?? (node.anyOf?.find((o) => o.default !== undefined)?.default as unknown);

// Params the AGENT wires to the user's real entities/fields (entity name,
// field mappings, instance-id wiring, refresh lists). The gallery only has a
// fixed sample seed, so these aren't meaningfully editable here — we mute them.
// entity/field/refresh suffixes are case-insensitive; the instance-id suffix
// must be the camelCase "…Ns" form (e.g. targetNs) so it doesn't catch
// "columns" / "options".
const isWiring = (key: string) => /(bdo|entity|field|fields|refresh)$/i.test(key) || /Ns$/.test(key);

const INPUT =
  "h-8 w-full rounded-md border border-border bg-background px-2.5 text-sm outline-none focus:ring-2 focus:ring-ring";

export function ParamsForm({
  schema,
  value,
  onChange,
}: {
  schema: unknown;
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}) {
  const json = useMemo(() => {
    try {
      return z.toJSONSchema(schema as z.ZodType, { unrepresentable: "any" }) as {
        properties?: Record<string, Node>;
      };
    } catch {
      return null;
    }
  }, [schema]);

  const entries = Object.entries(json?.properties ?? {});
  if (entries.length === 0) {
    return <p className="text-xs text-muted-foreground">This block takes no params.</p>;
  }

  const set = (key: string, v: unknown) => {
    const next = { ...value };
    if (v === undefined) delete next[key];
    else next[key] = v;
    onChange(next);
  };

  return (
    <div className="space-y-2.5">
      {entries.map(([key, node]) => {
        const kind = baseKind(node);
        const wiring = isWiring(key);
        const cur = key in value ? value[key] : nodeDefault(node);

        let control: React.ReactNode;
        if (kind === "boolean") {
          control = (
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!cur}
                onChange={(e) => set(key, e.target.checked)}
                className="size-4 rounded border-border accent-primary"
              />
              <span className="text-sm text-muted-foreground">{cur ? "true" : "false"}</span>
            </label>
          );
        } else if (kind === "enum") {
          control = (
            <select
              value={cur == null ? "" : String(cur)}
              onChange={(e) => set(key, e.target.value === "" ? undefined : e.target.value)}
              className={INPUT}
            >
              {isNullable(node) && <option value="">— none —</option>}
              {enumOptions(node).map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          );
        } else if (kind === "number") {
          control = (
            <input
              type="number"
              value={cur == null ? "" : Number(cur)}
              min={node.minimum}
              max={node.maximum}
              onChange={(e) => set(key, e.target.value === "" ? undefined : Number(e.target.value))}
              className={INPUT}
            />
          );
        } else if (kind === "string") {
          control = (
            <input
              type="text"
              value={cur == null ? "" : String(cur)}
              onChange={(e) => set(key, e.target.value === "" ? undefined : e.target.value)}
              className={INPUT}
            />
          );
        } else {
          // array / object / unrepresentable → compact JSON field
          control = (
            <input
              type="text"
              defaultValue={JSON.stringify(cur ?? (kind === "array" ? [] : {}))}
              spellCheck={false}
              onChange={(e) => {
                try {
                  set(key, JSON.parse(e.target.value));
                } catch {
                  /* keep last valid until JSON parses */
                }
              }}
              className={`${INPUT} font-mono text-[12px]`}
            />
          );
        }

        return (
          <div
            key={key}
            className={`grid grid-cols-[minmax(140px,200px)_1fr] items-start gap-3 ${wiring ? "opacity-55" : ""}`}
          >
            <div className="flex items-center gap-1 pt-2">
              <label className="font-mono text-[13px] font-medium">{key}</label>
              {node.description && <InfoHint text={node.description} />}
            </div>
            <div className="pt-0.5">
              {control}
              {wiring && (
                <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">
                  agent-wired to your data
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
