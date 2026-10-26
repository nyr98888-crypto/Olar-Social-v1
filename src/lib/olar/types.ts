export type OlarView =
  | "home"
  | "yona"
  | "studio"
  | "calendar"
  | "leads"
  | "reviews"
  | "analytics"
  | "mypage"
  | "settings";

export type SocialNetwork =
  | "facebook"
  | "instagram"
  | "twitter"
  | "reels"
  | "tiktok"
  | "whatsapp"
  | "telegram"
  | "google"
  | "pinterest";

export type IntegrationId =
  | "facebook"
  | "instagram"
  | "tiktok"
  | "twitter"
  | "google"
  | "easy"
  | "whatsapp"
  | "telegram"
  | "pinterest";

export type AutomationMode = "semi" | "hybrid" | "full";

export type LeadStatus = "new" | "active" | "closed";

export type LeadNetwork =
  | "facebook"
  | "instagram"
  | "whatsapp"
  | "tiktok"
  | "other";

export interface Lead {
  id: string;
  name: string;
  source: string;
  network: LeadNetwork;
  message: string;
  status: LeadStatus;
  timeAgo: string;
  phone?: string;
  /** Three ready answers: book / price / ask-more */
  replies: {
    book: string;
    price: string;
    ask: string;
  };
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  type: "post" | "holiday" | "reminder";
  network?: string;
  publishTime?: string;
  body?: string;
  suggestion?: string;
}

export interface CampaignStat {
  id: string;
  name: string;
  networkId: IntegrationId;
  network: string;
  clicks: number;
  waClicks: number;
  inquiries: number;
  calls: number;
  maps: number;
  reach: number;
  engagement: number;
  postsUsed: number;
  postsPotential: number;
}

export interface NetworkPostCompare {
  networkId: IntegrationId;
  strongest: { title: string; reach: number; engagement: number };
  weakest: { title: string; reach: number; engagement: number };
}

export interface TickerItem {
  id: string;
  text: string;
  tone: "info" | "warn" | "good";
}

export type AccountKind = "business" | "personal";

export interface ReviewItem {
  id: string;
  author: string;
  source: "google" | "easy";
  stars: number;
  text: string;
  timeAgo: string;
}

export interface ContentIdea {
  id: string;
  title: string;
  blurb: string;
  headline: string;
  body: string;
  hashtags: string[];
}
