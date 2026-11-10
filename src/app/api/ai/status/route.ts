import { NextResponse } from "next/server";
import { providerStatus } from "@/lib/ai/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Reports which provider is active. Never returns the key itself. */
export async function GET() {
  return NextResponse.json(providerStatus());
}
