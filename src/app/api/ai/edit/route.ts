import { NextResponse } from "next/server";
import { z } from "zod";
import { runEdit } from "@/lib/ai/pipeline";
import { validateConfig } from "@/lib/config/validate";
import { badRequest, errorResponse } from "../_shared";

export const runtime = "nodejs";
export const maxDuration = 300;

const bodySchema = z.object({
  instruction: z.string().trim().min(2).max(2000),
  config: z.unknown(),
  /** short lines describing the tasks already in the workspace, so the AI doesn't duplicate them */
  existingTasks: z.array(z.string().max(300)).max(80).optional(),
  forceDemo: z.boolean().optional(),
});

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest("Invalid request: " + parsed.error.issues[0]?.message);
  const current = validateConfig(parsed.data.config);
  if (!current.ok) return badRequest("Current workspace config is invalid: " + current.errors.slice(0, 3).join("; "));
  try {
    return NextResponse.json(await runEdit({ instruction: parsed.data.instruction, config: current.config!, existingTasks: parsed.data.existingTasks, forceDemo: parsed.data.forceDemo }));
  } catch (err) {
    return errorResponse(err);
  }
}
