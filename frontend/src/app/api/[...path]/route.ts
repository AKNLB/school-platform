import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(req, params.path);
}
export async function POST(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(req, params.path);
}
export async function PUT(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(req, params.path);
}
export async function PATCH(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(req, params.path);
}
export async function DELETE(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(req, params.path);
}

async function proxy(req: NextRequest, pathParts: string[]) {
  const origin = process.env.BACKEND_ORIGIN;
  if (!origin) return NextResponse.json({ error: "BACKEND_ORIGIN not set" }, { status: 500 });

  const url = new URL(req.url);
  const target = `${origin}/${pathParts.join("/")}${url.search}`;

  const headers = new Headers(req.headers);
  headers.delete("host");

  const res = await fetch(target, {
    method: req.method,
    headers,
    body: ["GET", "HEAD"].includes(req.method) ? undefined : await req.arrayBuffer(),
    redirect: "manual",
  });

  const outHeaders = new Headers(res.headers);
  // allow cookies to pass through
  outHeaders.delete("content-encoding");

  return new NextResponse(res.body, { status: res.status, headers: outHeaders });
}
