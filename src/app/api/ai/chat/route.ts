import { NextResponse } from "next/server";
import { z } from "zod";
import { runChat } from "@/lib/ai/chat";
import { validateConfig } from "@/lib/config/validate";
import { badRequest, errorResponse } from "../_shared";

export const runtime = "nodejs";
export const maxDuration = 120;

const bodySchema = z.object({
  mode: z.enum(["intake", "workspace"]),
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(4000) }))
    .min(1)
    .max(40),
  config: z.unknown().optional(),
  existingTasks: z.array(z.string().max(300)).max(80).optional(),
  forceDemo: z.boolean().optional(),
});

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest("Invalid request: " + parsed.error.issues[0]?.message);
  const { mode, messages, forceDemo } = parsed.data;
  let config;
  if (mode === "workspace") {
    const v = validateConfig(parsed.data.config);
    if (!v.ok) return badRequest("Current workspace config is invalid: " + v.errors.slice(0, 3).join("; "));
    config = v.config!;
  }
  try {
    return NextResponse.json(await runChat({ mode, messages, config, existingTasks: parsed.data.existingTasks, forceDemo }));
  } catch (err) {
    return errorResponse(err);
  }
}
