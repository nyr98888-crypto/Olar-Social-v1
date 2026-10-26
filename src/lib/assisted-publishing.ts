/**
 * Assisted (personal) publish: copy caption → download image → open FB/IG.
 */

import {
  assistedDestinationUrl,
  isHttpUrl,
  type SocialPlatform,
} from "@/lib/olar/social-accounts";
import { downloadImageDirect } from "@/lib/utils/download-image";

export type AssistedPublishInput = {
  platform: SocialPlatform;
  text: string;
  imageUrl?: string | null;
  profileUrl?: string | null;
};

export type AssistedPublishResult = {
  ok: boolean;
  clipboardOk: boolean;
  downloadOk: boolean;
  openedUrl: string;
  /** True when image was opened in a new tab instead of downloaded (CORS). */
  imageOpenedInTab: boolean;
  error?: string;
};

async function downloadImageAsFile(
  imageUrl: string,
  platform: SocialPlatform
): Promise<{ ok: boolean; openedInTab: boolean }> {
  if (!isHttpUrl(imageUrl) && !imageUrl.startsWith("data:")) {
    return { ok: false, openedInTab: false };
  }
  const filename = `oneloop-${platform}-${Date.now()}.png`;
  return downloadImageDirect(imageUrl, filename);
}

/**
 * 1) clipboard.writeText(text)
 * 2) fetch image → blob download
 * 3) after ~300ms open FB/IG destination
 */
export async function executeAssistedPublish(
  input: AssistedPublishInput
): Promise<AssistedPublishResult> {
  const { platform, text, imageUrl, profileUrl } = input;
  let clipboardOk = false;
  let downloadOk = false;
  let imageOpenedInTab = false;

  try {
    await navigator.clipboard.writeText(text || "");
    clipboardOk = true;
  } catch {
    clipboardOk = false;
  }

  if (imageUrl?.trim()) {
    const dl = await downloadImageAsFile(imageUrl.trim(), platform);
    downloadOk = dl.ok;
    imageOpenedInTab = dl.openedInTab;
  }

  const openedUrl = assistedDestinationUrl(platform, profileUrl);

  await new Promise((r) => window.setTimeout(r, 300));
  try {
    window.open(openedUrl, "_blank", "noopener,noreferrer");
  } catch {
    return {
      ok: clipboardOk,
      clipboardOk,
      downloadOk,
      openedUrl,
      imageOpenedInTab,
      error: "לא הצלחנו לפתוח את העמוד — נסו שוב או פתחו ידנית",
    };
  }

  return {
    ok: true,
    clipboardOk,
    downloadOk,
    openedUrl,
    imageOpenedInTab,
  };
}
