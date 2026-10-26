/**
 * Assisted (personal) publish: copy caption → download image → open FB/IG.
 */

import {
  assistedDestinationUrl,
  isHttpUrl,
  type SocialPlatform,
} from "@/lib/olar/social-accounts";

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

function triggerBlobDownload(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 2_000);
}

async function downloadImageAsFile(
  imageUrl: string,
  platform: SocialPlatform
): Promise<{ ok: boolean; openedInTab: boolean }> {
  if (!isHttpUrl(imageUrl) && !imageUrl.startsWith("data:")) {
    return { ok: false, openedInTab: false };
  }

  const filename = `oneloop-${platform}-${Date.now()}.jpg`;

  try {
    if (imageUrl.startsWith("data:")) {
      const res = await fetch(imageUrl);
      const blob = await res.blob();
      triggerBlobDownload(blob, filename);
      return { ok: true, openedInTab: false };
    }

    const res = await fetch(imageUrl, { mode: "cors" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    triggerBlobDownload(blob, filename);
    return { ok: true, openedInTab: false };
  } catch {
    // CORS / network — open image in a new tab so the user can save manually
    try {
      window.open(imageUrl, "_blank", "noopener,noreferrer");
      return { ok: false, openedInTab: true };
    } catch {
      return { ok: false, openedInTab: false };
    }
  }
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
