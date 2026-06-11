import { NextResponse } from "next/server";
import { createApp, listApps } from "@/lib/server/apps";

export async function GET() {
  return NextResponse.json({ apps: listApps() });
}

export async function POST(req: Request) {
  const { name, description } = (await req.json()) as {
    name?: string;
    description?: string;
  };
  if (!name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  const app = createApp(name.trim(), description?.trim() ?? "");
  return NextResponse.json({ app }, { status: 201 });
}
