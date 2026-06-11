import { NextResponse } from "next/server";
import { deleteApp, getApp } from "@/lib/server/apps";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ appId: string }> },
) {
  const { appId } = await params;
  const app = getApp(appId);
  if (!app) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ app });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ appId: string }> },
) {
  const { appId } = await params;
  deleteApp(appId);
  return NextResponse.json({ ok: true });
}
