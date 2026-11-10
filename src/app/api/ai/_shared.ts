import "server-only";
import { NextResponse } from "next/server";
import { PipelineError } from "@/lib/ai/pipeline";

export function errorResponse(err: unknown) {
  if (err instanceof PipelineError) {
    const status = err.kind === "provider" ? 502 : 422;
    return NextResponse.json({ error: err.message, kind: err.kind, details: err.details, canFallback: true, usage: err.usage }, { status });
  }
  console.error("[ai] unexpected error", err);
  return NextResponse.json({ error: "Unexpected server error", kind: "server", canFallback: true }, { status: 500 });
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message, kind: "bad_request" }, { status: 400 });
}
