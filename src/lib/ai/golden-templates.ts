/**
 * Soft empty fallback when AI fails — NEVER inject canned marketing copy
 * ("טיפול פנים", "אם חיפשתם שירות…", niche postBody, etc.).
 * UI shows empty preview + soft_message instead of fake posts.
 */
import type { AgentOutput, GeneratedPostResponse } from "../../../schemas/agent";
import { disambiguateBusinessDomain } from "./hebrew-disambiguation";
import type { PostInputContext } from "./pipeline-validator";
import { NEUTRAL_PRICE_CTA } from "./guardrails";
import { stripCategoryLeak } from "@/lib/olar/strip-category";

export type GoldenNiche =
  | "garage"
  | "cosmetics"
  | "interior"
  | "restaurant"
  | "general";

const KEYWORD_MAP: { keys: string[]; niche: GoldenNiche }[] = [
  {
    keys: [
      "אדריכלות פנים",
      "עיצוב פנים",
      "מעצב פנים",
      "מעצבת פנים",
      "עיצוב חללים",
      "אדריכל פנים",
      "interior design",
      "interior architecture",
    ],
    niche: "interior",
  },
  {
    keys: ["מוסך", "רכב", "garage", "צמיג", "מכונאי", "שמן מנוע"],
    niche: "garage",
  },
  {
    keys: [
      "קוסמט",
      "מכון יופי",
      "קליניקה אסתטית",
      "בוטוקס",
      "הסרת שיער",
      "ציפורניים",
      "ספא",
      "beauty",
    ],
    niche: "cosmetics",
  },
  {
    keys: ["מסעדה", "קפה", "cafe", "restaurant", "אוכל", "מאפה", "פיצה", "סושי"],
    niche: "restaurant",
  },
];

const DOMAIN_TO_GOLDEN: Record<string, GoldenNiche> = {
  interior: "interior",
  cosmetics: "cosmetics",
  garage: "garage",
  cafe: "restaurant",
  salon: "general",
  painting: "general",
  accountant: "general",
  locksmith: "general",
};

export function detectGoldenNiche(raw: string): GoldenNiche {
  const hit = disambiguateBusinessDomain({ text: raw, niche: raw });
  if (hit) {
    const mapped = DOMAIN_TO_GOLDEN[hit.domain.nicheId];
    if (mapped) return mapped;
  }
  const lower = (raw || "").toLowerCase();
  for (const row of KEYWORD_MAP) {
    if (row.keys.some((k) => lower.includes(k.toLowerCase()))) return row.niche;
  }
  return "general";
}

/** Empty post shell — no niche marketing prose. */
export function buildEmptyPostResponse(
  _ctx: PostInputContext = { rawPrompt: "" }
): GeneratedPostResponse {
  return {
    headline: "",
    postText: "",
    suggestedImagePrompt: "",
    callToAction: "",
    hasExplicitPrice: false,
  };
}

/**
 * @deprecated Name kept for router/text-service imports — returns EMPTY post, not golden marketing.
 */
export function buildGoldenPost(
  ctx: PostInputContext,
  _niche?: GoldenNiche
): GeneratedPostResponse {
  return buildEmptyPostResponse(ctx);
}

/** Neutral retry — never lecture; generate-post / studio use grounded dual instead. */
export const SOFT_FAIL_REPLY = "הכנתי לך פוסט מוכן — אפשר להמשיך לערוך בסטודיו!";

/** Legacy alias kept for imports that still reference the old soft-fail string. */
export const LEGACY_SOFT_FAIL_REPLY = "חלה שגיאה בייצור, אנא נסה שנית";

/** Blocked chat_reply strings — must never surface as Maya success copy. */
export function isBlockedStudioChatReply(text: string): boolean {
  const t = (text || "").trim();
  if (!t) return false;
  return (
    t === LEGACY_SOFT_FAIL_REPLY ||
    /בלי טקסט מוכן|טקסט מוכן מראש|לא הצלחתי לייצר פוסט כרגע|חלה שגיאה בייצור/i.test(
      t
    )
  );
}

/** Soft AgentOutput — callers should prefer dualGroundedVariations for real copy. */
export function buildGoldenAgentOutput(
  ctx: PostInputContext = { rawPrompt: "" },
  _niche?: GoldenNiche
): AgentOutput {
  const raw = stripCategoryLeak(ctx.rawPrompt || "").trim();
  return {
    chat_reply: SOFT_FAIL_REPLY,
    intent: raw ? "campaign_request" : "chit_chat",
    social_post: null,
    image_task: {
      generate_image: false,
      aspect_ratio: "1:1",
      prompt: "",
    },
  };
}

/** Prefer AI draft; if invalid, return soft empty — never swap in marketing templates. */
export function preferDraftOrEmpty(
  output: AgentOutput | null | undefined,
  ctx: PostInputContext = { rawPrompt: "" }
): AgentOutput {
  if (!output) return buildGoldenAgentOutput(ctx);
  const post = output.social_post;
  if (
    post &&
    stripCategoryLeak(post.headline || "").trim() &&
    stripCategoryLeak(post.body || "").trim()
  ) {
    return {
      ...output,
      social_post: {
        ...post,
        headline: stripCategoryLeak(post.headline),
        body: stripCategoryLeak(post.body),
        call_to_action: stripCategoryLeak(
          post.call_to_action || NEUTRAL_PRICE_CTA
        ),
      },
    };
  }
  const reply = output.chat_reply?.trim() || "";
  return {
    ...buildGoldenAgentOutput(ctx),
    chat_reply:
      reply && !isBlockedStudioChatReply(reply) ? reply : SOFT_FAIL_REPLY,
  };
}
