import { NextResponse } from "next/server";
import { z } from "zod";
import { runGenerate } from "@/lib/ai/pipeline";
import { badRequest, errorResponse } from "../_shared";

export const runtime = "nodejs";
export const maxDuration = 300;

const bodySchema = z.object({
  prompt: z.string().trim().min(2).max(4000),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) }))
    .max(10)
    .optional(),
  forceDemo: z.boolean().optional(),
  forceGenerate: z.boolean().optional(),
});

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest("Invalid request: " + parsed.error.issues[0]?.message);
  try {
    return NextResponse.json(await runGenerate(parsed.data));
  } catch (err) {
    return errorResponse(err);
  }
}
