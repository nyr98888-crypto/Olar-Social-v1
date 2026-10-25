# Vercel production (Hobby) — reliability notes

## Cold start

On **Vercel Hobby**, serverless functions sleep after idle. The first request after a pause can take several seconds and sometimes returns **502/504**. The app retries once and shows a Hebrew timeout message instead of hanging forever.

Optional keep-alive: ping `GET /api/health` every ~5–10 minutes from an external cron if you need fewer cold starts (not required for guest chat).

## Env vars (set in Vercel → Project → Settings → Environment Variables)

**Server-only (never `NEXT_PUBLIC_`):**

| Name | Required | Notes |
|------|----------|--------|
| `OPENROUTER_API_KEY` | yes | Primary chat |
| `GROQ_API_KEY` | recommended | Failover text |
| `GEMINI_API_KEY` | recommended | Vision + last text backup (`GOOGLE_AI_API_KEY` also accepted) |
| `FAL_KEY` | yes for images | Flux schnell |

**Baked at build time — set before Redeploy:**

| Name | Required | Notes |
|------|----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | optional | `https://PROJECT.supabase.co` — without it, **guest still works** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | optional | anon/public key — Google login needs both |
| `NEXT_PUBLIC_APP_URL` | recommended | Your Vercel URL, e.g. `https://….vercel.app` |

After changing any `NEXT_PUBLIC_*` variable: **Redeploy** (they are inlined at build).

## Guest without Google

`/api/guest` sets an httpOnly cookie. Middleware skips Supabase auth for guests so missing Google OAuth or broken Supabase DNS never blocks entry.

## Timeouts

| Layer | Limit |
|-------|--------|
| Route `maxDuration` | 60s (Hobby max) |
| Client chat UX | ~45s + one retry on 502/504 |
| Client image follow-up | ~40s |
| OpenRouter / Groq / FAL | hard AbortSignal / `withTimeout` — fail fast with Hebrew |

Chat returns **text first**; image is a separate request so mobile is not stuck on «יונה חושבת».
