export interface SocialPost {
  headline: string;
  body: string;
  hashtags: string[];
}

export interface UiMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  social_post?: SocialPost | null;
  image_url?: string | null;
  image_seed?: number | null;
  image_prompt?: string | null;
  intent?: string | null;
  created_at?: string;
}

export type LiveStatus =
  | "idle"
  | "thinking"
  | "analyzing"
  | "generating"
  | "error";

export const STATUS_LABELS: Record<LiveStatus, string> = {
  idle: "",
  thinking: "יונה חושבת...",
  analyzing: "מנתחת תמונות...",
  generating: "מייצרת ויז'ואל...",
  error: "משהו השתבש, נסי שוב",
};

export const DEFAULT_CHAT_ERROR_HE =
  "משהו השתבש. אפשר לנסות שוב — השיחה נשארת פעילה.";
