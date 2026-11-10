import { NextResponse } from "next/server";
import { z } from "zod";
import { briefing } from "@/lib/ai/assist";
import { badRequest, errorResponse } from "../_shared";

export const runtime = "nodejs";
export const maxDuration = 60;

const s = (n: number) => z.string().max(n);
const num = z.number().finite();
const factsSchema = z.object({
  workspace: s(80),
  today: s(10),
  language: z.enum(["bn", "en", "banglish"]),
  totals: z.object({ tasks: num, open: num, done: num, late: num, atRisk: num, doneThisWeek: num }),
  people: z.array(z.object({ name: s(60), role: s(60), open: num, late: num, atRisk: num, dueThisWeek: num, doneThisWeek: num, logs7d: num, hours7d: num })).max(100),
  attention: z.array(z.object({ title: s(160), people: s(300), due: s(10).optional(), days: num.optional(), status: s(40), risk: s(10) })).max(12),
  recentWork: z.array(s(160)).max(15),
});

export async function POST(req: Request) {
  const parsed = z.object({ facts: factsSchema, forceDemo: z.boolean().optional() }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest("Invalid request: " + parsed.error.issues[0]?.message);
  try {
    return NextResponse.json(await briefing(parsed.data));
  } catch (err) {
    return errorResponse(err);
  }
}
