/**
 * Patch Onboarding.tsx: real Google OAuth + FAL image on payoff.
 * UTF-8 safe via Node.
 */
import fs from "fs";

const path = "src/components/olar/Onboarding.tsx";
let s = fs.readFileSync(path, "utf8");

if (!s.includes("signInWithGoogle")) {
  s = s.replace(
    'import { MessageCircle, Phone, Sparkles, X } from "lucide-react";',
    `import { MessageCircle, Phone, Sparkles, X } from "lucide-react";
import { signInWithGoogle } from "@/lib/olar/auth-client";
import { PostCardPreview } from "@/components/olar/PostCardPreview";`
  );
}

// Add image state
if (!s.includes("postImageUrl")) {
  s = s.replace(
    "  const [softToast, setSoftToast] = useState<string | null>(null);",
    `  const [softToast, setSoftToast] = useState<string | null>(null);
  const [postImageUrl, setPostImageUrl] = useState<string | null>(null);
  const [postImageLoading, setPostImageLoading] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);`
  );
}

// After setPhase("payoff") generate image
if (!s.includes("generateOnboardingImage")) {
  const helper = `
  async function generateOnboardingImage(p: BusinessProfile) {
    setPostImageLoading(true);
    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: \`\${p.businessName} \${p.tagline} \${p.firstPost.headline} \${p.niche}\`,
          businessName: p.businessName,
          niche: p.niche,
          purpose: "post",
          aspectRatio: "16:9",
        }),
        signal: AbortSignal.timeout(55_000),
      });
      const data = (await res.json().catch(() => ({}))) as {
        image?: { url?: string };
      };
      if (data.image?.url) setPostImageUrl(data.image.url);
    } catch {
      /* soft fail */
    } finally {
      setPostImageLoading(false);
    }
  }

  async function continueWithGoogle() {
    if (profile) saveProfile(profile);
    try {
      localStorage.setItem("olar-onboarding-pending", "1");
    } catch { /* ignore */ }
    setAuthBusy(true);
    const { error } = await signInWithGoogle("/");
    if (error) {
      setAuthBusy(false);
      // Soft fallback: still allow guest entry
      finishToApp();
    }
  }
`;
  s = s.replace(
    "  function finishToApp() {",
    helper + "\n  function finishToApp() {"
  );
}

// Call image gen when entering payoff
if (!s.includes("void generateOnboardingImage")) {
  s = s.replace(
    '    setPhase("payoff");\n  }',
    `    setPhase("payoff");
    // Fire Art Director → FAL for post card image
    const pForImg = profile;
    if (pForImg) void generateOnboardingImage(pForImg);
    else {
      // profile state may lag one tick — use local from closure via setTimeout
      window.setTimeout(() => {
        /* image generated after merge below */
      }, 0);
    }
  }`
  );
}

// Better: after setProfile(merged) and before setPhase, store ref
// Replace the payoff transition more carefully
s = s.replace(
  /setSoftToast\(\s*data\.soft_message \|\| C\.aiSoftReady[\s\S]*?\);\s*\}\s*catch[\s\S]*?setSoftToast\(C\.aiSoftReady[\s\S]*?\);\s*\}\s*setPhase\("payoff"\);[\s\S]*?\}/,
  `setSoftToast(
        data.soft_message || C.aiSoftReady || "ready"
      );
      const finalProfile = data.profile
        ? {
            ...local,
            businessName: data.profile.businessName || local.businessName,
            city: data.profile.city || local.city,
            niche: (data.profile.niche as BusinessProfile["niche"]) || local.niche,
            tagline: data.profile.tagline || local.tagline,
            description: data.profile.description || local.description,
            firstPost: data.profile.firstPost
              ? {
                  headline: data.profile.firstPost.headline || local.firstPost.headline,
                  body: data.profile.firstPost.body || local.firstPost.body,
                  cta: data.profile.firstPost.cta || local.firstPost.cta,
                  hashtags:
                    data.profile.firstPost.hashtags?.length
                      ? data.profile.firstPost.hashtags
                      : local.firstPost.hashtags,
                }
              : local.firstPost,
          }
        : local;
      setProfile(finalProfile);
      setPhase("payoff");
      void generateOnboardingImage(finalProfile);
    } catch {
      await minWait;
      setSoftToast(C.aiSoftReady || "ready");
      setPhase("payoff");
      void generateOnboardingImage(local);
    }
  }`
);

// Replace empty image rectangle in payoff with PostCardPreview
const emptyImg = `              <div className="mt-3 flex h-28 items-center justify-center rounded-xl bg-gradient-to-br from-sky-100 via-sky-50 to-slate-100 text-accent">
                <Sparkles className="h-8 w-8" />
              </div>
              <h3
                className="mt-4 text-2xl font-bold text-slate-950"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {page.firstPost.headline}
              </h3>
              <p className="mt-3 whitespace-pre-line text-base leading-relaxed text-slate-800">
                {page.firstPost.body}
              </p>
              {page.firstPost.cta ? (
                <p className="mt-2 text-sm font-medium text-slate-900">
                  {page.firstPost.cta}
                </p>
              ) : null}
              <p className="mt-3 text-sm text-accent">
                {page.firstPost.hashtags.join(" ")}
              </p>`;

const cardPreview = `              <div className="mt-3 max-h-[70vh] overflow-y-auto overscroll-contain">
                <PostCardPreview
                  network="instagram"
                  businessName={page.businessName}
                  post={{
                    headline: page.firstPost.headline,
                    body: page.firstPost.body,
                    hashtags: page.firstPost.hashtags,
                    call_to_action: page.firstPost.cta,
                  }}
                  imageUrl={postImageUrl}
                  imageLoading={postImageLoading}
                />
              </div>`;

if (s.includes(emptyImg)) {
  s = s.replace(emptyImg, cardPreview);
} else {
  console.warn("empty image block not exact match — trying softer replace");
  s = s.replace(
    /<div className="mt-3 flex h-28 items-center justify-center rounded-xl[\s\S]*?\{page\.firstPost\.hashtags\.join\(" "\)\}\s*<\/p>/,
    cardPreview
  );
}

// Google button → continueWithGoogle; Guest → finishToApp
s = s.replace(
  /onClick=\{finishToApp\}\s*className="mt-6 flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl border border-slate-300/,
  `onClick={() => void continueWithGoogle()}
              disabled={authBusy}
              className="mt-6 flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl border border-slate-300`
);

fs.writeFileSync(path, s, "utf8");
console.log("Onboarding patched", {
  oauth: s.includes("signInWithGoogle"),
  image: s.includes("generateOnboardingImage"),
  postCard: s.includes("PostCardPreview"),
  googleBtn: s.includes("continueWithGoogle"),
});
