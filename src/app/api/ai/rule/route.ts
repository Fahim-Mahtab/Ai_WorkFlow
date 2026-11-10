import { NextResponse } from "next/server";
import { z } from "zod";
import { ruleFromText } from "@/lib/ai/assist";
import { validateConfig } from "@/lib/config/validate";
import { badRequest, errorResponse } from "../_shared";

export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({
  text: z.string().trim().min(3).max(600),
  config: z.unknown(),
  forceDemo: z.boolean().optional(),
});

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest("Invalid request: " + parsed.error.issues[0]?.message);
  const v = validateConfig(parsed.data.config);
  if (!v.ok) return badRequest("Current workspace config is invalid: " + v.errors.slice(0, 3).join("; "));
  try {
    return NextResponse.json(await ruleFromText({ text: parsed.data.text, config: v.config!, forceDemo: parsed.data.forceDemo }));
  } catch (err) {
    return errorResponse(err);
  }
}
