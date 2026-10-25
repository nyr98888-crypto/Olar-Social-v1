import { NextResponse } from "next/server";

/**
 * Map provider/raw errors to a clean JSON body for the client.
 * Never leak Google/OpenRouter stacks or raw SDK dumps.
 */
export function toClientErrorPayload(err: unknown): {
  error: string;
  error_he: string;
} {
  const raw = err instanceof Error ? err.message : String(err ?? "");

  if (
    /\b(429|503)\b/.test(raw) ||
    /high demand|Service Unavailable|RESOURCE_EXHAUSTED|overloaded|rate.?limit/i.test(
      raw
    )
  ) {
    return {
      error: "AI service is temporarily busy. Please try again in a moment.",
      error_he: "השירות עמוס כרגע. נסי שוב בעוד רגע.",
    };
  }

  if (/timed out|ETIMEDOUT|AbortError|aborted/i.test(raw)) {
    return {
      error: "The request took too long. Please try again.",
      error_he: "הבקשה ארכה יותר מדי. נסי שוב.",
    };
  }

  if (/\b(502|504)\b/.test(raw) || /bad gateway|gateway timeout/i.test(raw)) {
    return {
      error: "The server is warming up or temporarily unavailable.",
      error_he:
        "השרת מתעורר או זמנית לא זמין (cold start). נסי שוב בעוד כמה שניות.",
    };
  }

  if (/unauthorized|GEMINI_API_KEY|OPENROUTER_API_KEY|GROQ_API_KEY|FAL_KEY/i.test(raw)) {
    return {
      error: "Service configuration error. Please try again later.",
      error_he: "שגיאת הגדרות שירות. נסי שוב מאוחר יותר.",
    };
  }

  if (/FAL|image/i.test(raw)) {
    return {
      error: "Image generation failed. Please try again.",
      error_he: "יצירת התמונה נכשלה. נסי שוב.",
    };
  }

  return {
    error: "Something went wrong. Please try again.",
    error_he: "משהו השתבש. נסי שוב.",
  };
}

export function jsonClientError(err: unknown, status = 500) {
  console.error("[api]", err instanceof Error ? err.message : err);
  return NextResponse.json(toClientErrorPayload(err), { status });
}
