/** Robustly pull a JSON object out of an LLM response (handles ```json fences / prose). */
export function extractJson(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    /* fall through */
  }
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) {
    try {
      return JSON.parse(fence[1]);
    } catch {
      /* fall through */
    }
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start !== -1 && end > start) {
    const slice = trimmed.slice(start, end + 1);
    try {
      return JSON.parse(slice);
    } catch {
      // remove trailing commas — a frequent LLM mistake
      try {
        return JSON.parse(slice.replace(/,\s*([}\]])/g, "$1"));
      } catch {
        /* fall through */
      }
    }
  }
  throw new Error("AI response was not valid JSON");
}
