import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseEnv, isSupabaseConfigured } from "./config";

export {
  getSupabaseConfigHint,
  isSupabaseConfigured,
  SupabaseConfigError,
} from "./config";

export function createClient() {
  const { url, anonKey } = getSupabaseEnv();
  return createBrowserClient(url, anonKey);
}
