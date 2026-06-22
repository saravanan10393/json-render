"use client";

import { Database, Loader2 } from "lucide-react";

export interface EntityModel {
  name: string;
  label: string;
  fields: { id: string; name: string; type: string; options?: string[] }[];
  sampleRecords: Record<string, unknown>[];
  count: number;
}

function fmt(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function EntityCard({ entity }: { entity: EntityModel }) {
  const cols = entity.fields.map((f) => f.id);
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-sm font-semibold">{entity.name}</span>
          <span className="text-xs text-muted-foreground">{entity.label}</span>
        </div>
        <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
          {entity.count} {entity.count === 1 ? "row" : "rows"}
        </span>
      </div>

      <div className="px-4 py-3">
        <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Fields
        </div>
        <div className="flex flex-wrap gap-1.5">
          {entity.fields.map((f) => (
            <span
              key={f.id}
              className="rounded-md border border-border bg-muted/40 px-2 py-1 font-mono text-[11px]"
            >
              {f.id}{" "}
              <span className="text-muted-foreground">
                {f.type}
                {f.options?.length ? `(${f.options.join("|")})` : ""}
              </span>
            </span>
          ))}
        </div>
      </div>

      {entity.sampleRecords.length > 0 && (
        <div className="overflow-x-auto border-t border-border">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                {cols.map((c) => (
                  <th key={c} className="whitespace-nowrap px-3 py-1.5 font-medium">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entity.sampleRecords.map((r, i) => (
                <tr key={(r._id as string) ?? i} className="border-t border-border">
                  {cols.map((c) => (
                    <td key={c} className="max-w-[180px] truncate px-3 py-1.5" title={fmt(r[c])}>
                      {fmt(r[c])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function DataModelViewer({
  entities,
  building,
}: {
  entities: EntityModel[];
  building: boolean;
}) {
  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-3xl space-y-5">
        <header className="space-y-1">
          <h2 className="font-heading text-lg font-semibold">Data model</h2>
          <p className="text-sm text-muted-foreground">
            Review the entities and seeded data, then <b>Approve data model</b> to continue.
          </p>
        </header>

        {entities.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border py-16 text-center">
            {building ? (
              <Loader2 className="size-6 animate-spin text-amber-600" />
            ) : (
              <Database className="size-6 text-muted-foreground" />
            )}
            <p className="max-w-xs text-sm text-muted-foreground">
              {building
                ? "Defining entities and seeding sample data…"
                : "The backend agent will define the entities and seed sample data here."}
            </p>
          </div>
        ) : (
          entities.map((e) => <EntityCard key={e.name} entity={e} />)
        )}
      </div>
    </div>
  );
}
