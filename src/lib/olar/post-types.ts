/**
 * Content Pillars — post type ids, Hebrew UI, placeholders, and LLM tone blocks.
 */

export const POST_TYPE_IDS = [
  "milestone",
  "client_satisfaction",
  "before_after",
  "promotion",
] as const;

export type PostTypeId = (typeof POST_TYPE_IDS)[number];

export const DEFAULT_POST_TYPE: PostTypeId = "promotion";

export type PostTypeDef = {
  id: PostTypeId;
  labelHe: string;
  placeholder: string;
  /** Injected into generate-post system prompt */
  llmToneBlock: string;
  /** Default CTA when LLM/fallback omit one (var_1 = punchy, var_2 = soft) */
  defaultCtaVar1: string;
  defaultCtaVar2: string;
};

const PROMOTION_PLACEHOLDER =
  "לדוגמה: מוסך דוד בהרצליה — הכנת רכב לחורף, בלמים ומגבים, תכתבו בוואטסאפ...";

export const POST_TYPES: readonly PostTypeDef[] = [
  {
    id: "milestone",
    labelHe: "🏆 הישג והצלחה",
    placeholder:
      "ספרו לנו על ההצלחה היום: למשל - אחרי שבועיים של עבודה מאומצת סיימנו פרויקט מורכב, רכב שיצא מהסדנה כמו חדש, פגישה מוצלחת במשרד...",
    llmToneBlock: `POST TYPE = MILESTONE / ACHIEVEMENT (STRICT):
- Tone: proud, authentic, professional — celebrate a real win from userText.
- NEVER invent discounts, promotions, prices, or limited-time offers.
- NEVER use sales CTAs like "להזמנה מהירה" / "מבצע" / promo booking language.
- Prefer engagement CTAs: "פרגנו בתגובות!", "איך יצא לדעתכם?", "לפרויקטים נוספים דברו איתנו".
- Variation 1: short punchy, result-focused.
- Variation 2: storytelling — process, challenge, then the win.`,
    defaultCtaVar1: "פרגנו בתגובות!",
    defaultCtaVar2: "איך יצא לדעתכם?",
  },
  {
    id: "client_satisfaction",
    labelHe: "🤝 לקוח מרוצה",
    placeholder:
      "ספרו על החוויה: למשל - מסרנו עוד מפתח לרכב מתוקן ללקוח מרוצה, לקוחה קבועה שיצאה עם חיוך וסט ציפורניים מושלם...",
    llmToneBlock: `POST TYPE = CLIENT SATISFACTION (STRICT):
- Tone: warm, grateful for trust, personal service — highlight the human moment.
- NEVER invent discounts, fake prices, or promotional offers.
- NEVER invent named customers unless the user named them.
- Prefer soft engagement / contact CTAs (thank-you + invite), not hard sales.
- Variation 1: short punchy gratitude + result.
- Variation 2: storytelling of the service journey and the smile at the end.`,
    defaultCtaVar1: "תודה על האמון — דברו איתנו",
    defaultCtaVar2: "נשמח לשמוע גם אתכם",
  },
  {
    id: "before_after",
    labelHe: "🔄 לפני ואחרי / מהשטח",
    placeholder:
      "תארו את השינוי: מאיזה מצב התחלתם ואיך זה נראה בסיום העבודה...",
    llmToneBlock: `POST TYPE = BEFORE / AFTER / FIELD WORK (STRICT):
- Emphasize transformation: starting state → craft/process → finished result.
- NEVER invent numeric prices unless the user wrote them.
- Avoid pure promo framing; focus on craft and visible change.
- Variation 1: short punchy finished-result focus.
- Variation 2: storytelling of the challenge and the process.`,
    defaultCtaVar1: "ראו את התוצאה — דברו איתנו",
    defaultCtaVar2: "לפרטים ותיאום ישיר",
  },
  {
    id: "promotion",
    labelHe: "🏷️ מבצע והזמנות",
    placeholder: PROMOTION_PLACEHOLDER,
    llmToneBlock: `POST TYPE = PROMOTION / OFFERS:
- Existing sales/direct rules OK: clear offer, availability, next step.
- Still never invent prices the user did not write.
- Variation 1 (sales): short punchy, offer-focused, WhatsApp booking CTA.
- Variation 2 (story): warm community tone, soft invite CTA.`,
    defaultCtaVar1: "להזמנה מהירה בוואטסאפ",
    defaultCtaVar2: "לפרטים ותיאום ישיר",
  },
] as const;

const BY_ID: Record<PostTypeId, PostTypeDef> = Object.fromEntries(
  POST_TYPES.map((p) => [p.id, p])
) as Record<PostTypeId, PostTypeDef>;

export function isPostTypeId(raw: unknown): raw is PostTypeId {
  return (
    typeof raw === "string" &&
    (POST_TYPE_IDS as readonly string[]).includes(raw)
  );
}

export function normalizePostType(raw?: string | null): PostTypeId {
  if (raw && isPostTypeId(raw)) return raw;
  return DEFAULT_POST_TYPE;
}

export function getPostTypeDef(id?: PostTypeId | null): PostTypeDef {
  return BY_ID[normalizePostType(id)] ?? BY_ID.promotion;
}

export function postTypePlaceholder(id?: PostTypeId | null): string {
  return getPostTypeDef(id).placeholder;
}

export function postTypeLlmToneBlock(id?: PostTypeId | null): string {
  return getPostTypeDef(id).llmToneBlock;
}

export function postTypeDefaultCtas(id?: PostTypeId | null): {
  var1: string;
  var2: string;
} {
  const def = getPostTypeDef(id);
  return { var1: def.defaultCtaVar1, var2: def.defaultCtaVar2 };
}
