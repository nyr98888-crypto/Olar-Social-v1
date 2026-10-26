/**
 * Campaigns store — Turso (libSQL) via @libsql/client.
 * Requires TURSO_DATABASE_URL + TURSO_AUTH_TOKEN.
 */
import { createClient, type Client } from "@libsql/client";

export type CampaignRow = {
  id: number;
  title: string;
  bodyText: string;
  imageUrl: string;
  niche: string | null;
  hashtags: string | null;
  platform: string;
  createdAt: string;
};

export type CampaignInsert = {
  title: string;
  bodyText: string;
  imageUrl: string;
  niche?: string | null;
  hashtags?: string | null;
  platform?: string | null;
};

export type CampaignUpdate = {
  title?: string;
  bodyText?: string;
  imageUrl?: string;
  niche?: string | null;
  hashtags?: string | null;
  platform?: string | null;
};

let client: Client | null = null;
let schemaReady = false;

export function getDb(): Client {
  if (!client) {
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;
    if (!url?.trim()) {
      throw new Error(
        "TURSO_DATABASE_URL is not set. Add it (and TURSO_AUTH_TOKEN) to your environment."
      );
    }
    client = createClient({
      url,
      authToken,
    });
  }
  return client;
}

/** Create the campaigns table on Turso if it does not already exist. */
export async function ensureCampaignsSchema(): Promise<void> {
  if (schemaReady) return;
  const db = getDb();
  await db.execute(`
    CREATE TABLE IF NOT EXISTS campaigns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      bodyText TEXT NOT NULL,
      imageUrl TEXT NOT NULL,
      niche TEXT,
      hashtags TEXT,
      platform TEXT DEFAULT 'Instagram',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  schemaReady = true;
}

function mapRow(row: Record<string, unknown>): CampaignRow {
  return {
    id: Number(row.id),
    title: String(row.title ?? ""),
    bodyText: String(row.bodyText ?? ""),
    imageUrl: String(row.imageUrl ?? ""),
    niche: row.niche == null ? null : String(row.niche),
    hashtags: row.hashtags == null ? null : String(row.hashtags),
    platform: String(row.platform ?? "Instagram"),
    createdAt: String(row.createdAt ?? ""),
  };
}

export async function insertCampaign(
  input: CampaignInsert
): Promise<CampaignRow> {
  await ensureCampaignsSchema();
  const db = getDb();
  const title = (input.title || "").trim() || "פוסט";
  const bodyText = (input.bodyText || "").trim();
  const imageUrl = (input.imageUrl || "").trim() || "";
  const niche = input.niche?.trim() || null;
  const hashtags =
    input.hashtags == null
      ? null
      : typeof input.hashtags === "string"
        ? input.hashtags
        : null;
  const platform = (input.platform || "Instagram").trim() || "Instagram";

  const result = await db.execute({
    sql: `INSERT INTO campaigns (title, bodyText, imageUrl, niche, hashtags, platform)
          VALUES (?, ?, ?, ?, ?, ?)
          RETURNING *`,
    args: [title, bodyText, imageUrl, niche, hashtags, platform],
  });

  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (!row) {
    // Fallback if RETURNING unsupported
    const latest = await getLatestCampaign();
    if (!latest) throw new Error("Failed to insert campaign");
    return latest;
  }
  return mapRow(row);
}

export async function getLatestCampaign(): Promise<CampaignRow | null> {
  await ensureCampaignsSchema();
  const db = getDb();
  const result = await db.execute(
    `SELECT * FROM campaigns ORDER BY id DESC LIMIT 1`
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;
  return row ? mapRow(row) : null;
}

export async function getCampaignById(
  id: number
): Promise<CampaignRow | null> {
  await ensureCampaignsSchema();
  if (!Number.isFinite(id) || id <= 0) return null;
  const db = getDb();
  const result = await db.execute({
    sql: `SELECT * FROM campaigns WHERE id = ? LIMIT 1`,
    args: [id],
  });
  const row = result.rows[0] as Record<string, unknown> | undefined;
  return row ? mapRow(row) : null;
}

export async function updateCampaign(
  id: number,
  patch: CampaignUpdate
): Promise<CampaignRow | null> {
  await ensureCampaignsSchema();
  if (!Number.isFinite(id) || id <= 0) return null;

  const existing = await getCampaignById(id);
  if (!existing) return null;

  const title =
    patch.title !== undefined ? patch.title.trim() || existing.title : existing.title;
  const bodyText =
    patch.bodyText !== undefined
      ? patch.bodyText.trim()
      : existing.bodyText;
  const imageUrl =
    patch.imageUrl !== undefined
      ? patch.imageUrl.trim()
      : existing.imageUrl;
  const niche =
    patch.niche !== undefined
      ? patch.niche?.trim() || null
      : existing.niche;
  const hashtags =
    patch.hashtags !== undefined
      ? patch.hashtags
      : existing.hashtags;
  const platform =
    patch.platform !== undefined
      ? (patch.platform?.trim() || existing.platform)
      : existing.platform;

  const db = getDb();
  await db.execute({
    sql: `UPDATE campaigns
          SET title = ?, bodyText = ?, imageUrl = ?, niche = ?, hashtags = ?, platform = ?
          WHERE id = ?`,
    args: [title, bodyText, imageUrl, niche, hashtags, platform, id],
  });

  return getCampaignById(id);
}
