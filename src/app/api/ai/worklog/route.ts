import { NextResponse } from "next/server";
import { z } from "zod";
import { runWorklog } from "@/lib/ai/pipeline";
import { badRequest, errorResponse } from "../_shared";

export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({
  text: z.string().trim().min(2).max(3000),
  forceDemo: z.boolean().optional(),
});

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest("Invalid request: " + parsed.error.issues[0]?.message);
  try {
    return NextResponse.json(await runWorklog(parsed.data));
  } catch (err) {
    return errorResponse(err);
  }
}
