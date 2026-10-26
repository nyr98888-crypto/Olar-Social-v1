/**
 * Secure client-side image download.
 * FAL / CDN often block browser CORS — try same-origin proxy first, then direct CORS, then open tab.
 */
"use client";

function triggerBlobDownload(blob: Blob, filename: string) {
  const blobUrl = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(blobUrl);
}

async function fetchImageBlob(imageUrl: string): Promise<Blob> {
  if (imageUrl.startsWith("data:")) {
    const res = await fetch(imageUrl);
    if (!res.ok) throw new Error(`data-URI fetch failed (${res.status})`);
    return res.blob();
  }

  // 1) Same-origin proxy — bypasses FAL Cross-Origin restrictions
  try {
    const proxyRes = await fetch(
      `/api/proxy-image?url=${encodeURIComponent(imageUrl)}`,
      { signal: AbortSignal.timeout(45_000) }
    );
    if (proxyRes.ok) return proxyRes.blob();
  } catch {
    /* fall through to direct CORS */
  }

  // 2) Direct CORS fetch (works when CDN sends ACAO)
  const response = await fetch(imageUrl, {
    mode: "cors",
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) {
    throw new Error(`Image fetch failed (${response.status})`);
  }
  return response.blob();
}

/**
 * Download a remote (or data:) image as a local file.
 * On total failure, opens the URL in a new tab for manual save.
 */
export async function downloadImageDirect(
  imageUrl: string,
  filename: string = "post-image.png"
): Promise<{ ok: boolean; openedInTab: boolean }> {
  if (!imageUrl?.trim()) {
    return { ok: false, openedInTab: false };
  }

  try {
    const blob = await fetchImageBlob(imageUrl.trim());
    // Normalize extension from MIME when caller used .png but blob is jpeg
    let outName = filename;
    if (blob.type.includes("jpeg") || blob.type.includes("jpg")) {
      outName = filename.replace(/\.png$/i, ".jpg");
    } else if (blob.type.includes("png") && !/\.png$/i.test(filename)) {
      outName = filename.replace(/\.(jpe?g|webp)$/i, ".png");
    }
    triggerBlobDownload(blob, outName);
    return { ok: true, openedInTab: false };
  } catch (error) {
    console.error("Failed to download image directly:", error);
    // Fallback: open image in a new tab for manual save
    try {
      window.open(imageUrl, "_blank", "noopener,noreferrer");
      return { ok: false, openedInTab: true };
    } catch {
      return { ok: false, openedInTab: false };
    }
  }
}
