/** Hand-off from Dashboard idea cards → Yona composer */
export const YONA_IDEA_KEY = "olar-yona-idea";

export type YonaIdeaPayload = {
  id?: string;
  title: string;
  blurb?: string;
  headline?: string;
  body?: string;
};

export function stashYonaIdea(idea: YonaIdeaPayload) {
  try {
    localStorage.setItem(YONA_IDEA_KEY, JSON.stringify(idea));
  } catch {
    /* ignore */
  }
}

function parseIdea(raw: string | null): YonaIdeaPayload | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as YonaIdeaPayload;
    if (!parsed?.title || typeof parsed.title !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Read without clearing — useful before focus/mount apply. */
export function peekYonaIdea(): YonaIdeaPayload | null {
  try {
    return parseIdea(localStorage.getItem(YONA_IDEA_KEY));
  } catch {
    return null;
  }
}

export function takeYonaIdea(): YonaIdeaPayload | null {
  try {
    const raw = localStorage.getItem(YONA_IDEA_KEY);
    if (!raw) return null;
    localStorage.removeItem(YONA_IDEA_KEY);
    return parseIdea(raw);
  } catch {
    return null;
  }
}

export function ideaPromptText(idea: {
  title: string;
  blurb?: string;
  headline?: string;
  body?: string;
}): string {
  if (idea.headline && idea.body) {
    return `${idea.headline}\n${idea.body}`;
  }
  if (idea.blurb) return `${idea.title}\n${idea.blurb}`;
  return idea.title;
}
