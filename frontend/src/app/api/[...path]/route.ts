import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

export async function GET(req: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxy(req, path);
}

export async function POST(req: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxy(req, path);
}

export async function PUT(req: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxy(req, path);
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxy(req, path);
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxy(req, path);
}

async function proxy(req: NextRequest, pathParts: string[]) {
  const origin = process.env.BACKEND_ORIGIN;
  if (!origin) {
    return NextResponse.json(
      { error: "BACKEND_ORIGIN not set" },
      { status: 500 }
    );
  }

  const url = new URL(req.url);
  const target = `${origin}/${pathParts.join("/")}${url.search}`;

  const headers = new Headers(req.headers);
  headers.delete("host");

  const res = await fetch(target, {
    method: req.method,
    headers,
    body: ["GET", "HEAD"].includes(req.method)
      ? undefined
      : await req.arrayBuffer(),
    redirect: "manual",
  });

  const outHeaders = new Headers(res.headers);
  outHeaders.delete("content-encoding");

  return new NextResponse(res.body, {
    status: res.status,
    headers: outHeaders,
  });
}