import { NextResponse } from "next/server";
import {
  computeMetric,
  deleteRecord,
  getRecord,
  queryRecords,
  saveRecord,
  type ListParams,
  type MetricParams,
} from "@/lib/server/entity-store";

interface ExecuteRequest {
  type: string;
  /** Params with all bindings already resolved client-side. */
  params: Record<string, unknown>;
}

/**
 * Executes one datasource request against the local entity store. The client
 * runtime resolves $state/$datasource bindings BEFORE calling this endpoint,
 * so params arrive as plain JSON. Returns `{ result }` — the client wraps it
 * in the `{ data, isLoading, error, lastFetchedAt }` envelope.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ appId: string }> },
) {
  const { appId } = await params;
  const { type, params: dsParams } = (await req.json()) as ExecuteRequest;

  try {
    switch (type) {
      case "bdo.list": {
        const { bdo, ...rest } = dsParams as unknown as { bdo: string } & ListParams;
        const { data, page } = queryRecords(appId, bdo, rest);
        return NextResponse.json({ result: data, page });
      }
      case "bdo.get": {
        const { bdo, _id } = dsParams as { bdo: string; _id: string };
        const record = getRecord(appId, bdo, String(_id));
        return NextResponse.json({ result: record });
      }
      case "bdo.metric": {
        const { bdo, ...rest } = dsParams as unknown as { bdo: string } & MetricParams;
        return NextResponse.json({ result: computeMetric(appId, bdo, rest) });
      }
      case "bdo.save": {
        const { bdo, values, _id } = dsParams as {
          bdo: string;
          values: Record<string, unknown>;
          _id?: string;
        };
        if (!values || typeof values !== "object") {
          return NextResponse.json(
            { error: "bdo.save requires resolved `values`" },
            { status: 400 },
          );
        }
        const saved = saveRecord(appId, bdo, values, _id ? String(_id) : undefined);
        return NextResponse.json({ result: saved });
      }
      case "bdo.delete": {
        const { bdo, _id } = dsParams as { bdo: string; _id: string };
        deleteRecord(appId, bdo, String(_id));
        return NextResponse.json({ result: { ok: true } });
      }
      case "activity.list":
      case "activity.get":
        // No local workflow engine — return empty rather than failing pages.
        return NextResponse.json({ result: type === "activity.list" ? [] : null });
      case "activity.submit":
      case "workflow.start":
        return NextResponse.json(
          { error: `${type} is not supported in the local preview runtime` },
          { status: 501 },
        );
      default:
        return NextResponse.json({ error: `Unknown datasource type "${type}"` }, { status: 400 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
