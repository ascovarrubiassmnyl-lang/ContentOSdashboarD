// Integración con Zernio (https://zernio.com) — fuente de datos reales de
// Instagram SIN necesidad de app de Meta ni Página de Facebook. Zernio trae
// su propia app aprobada y conecta vía "Instagram Login for Business".
//
// Auth: Authorization: Bearer <ZERNIO_API_KEY>
// Endpoints usados:
//   GET /v1/accounts?platform=instagram   → cuentas conectadas
//   GET /v1/analytics?accountId=..&fromDate=..&toDate=..  → analytics por post
import { writeCollection, writeSingleton } from './db';
import { IgAccount, MediaPost, MetricSnapshot } from '@/types';

const BASE = process.env.ZERNIO_BASE_URL || 'https://api.zernio.com';

export function hasZernioKey(): boolean {
  return Boolean(process.env.ZERNIO_API_KEY);
}

async function zernioGet<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = `${BASE}${path}${Object.keys(params).length ? `?${new URLSearchParams(params)}` : ''}`;
  const res = await fetch(url, {
    headers: {
      authorization: `Bearer ${process.env.ZERNIO_API_KEY}`,
      accept: 'application/json',
    },
  });
  const text = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Zernio: respuesta no-JSON (${res.status}): ${text.slice(0, 200)}`);
  }
  if (!res.ok) {
    const msg = (json as { message?: string; error?: string })?.message ??
      (json as { error?: string })?.error ?? res.statusText;
    throw new Error(`Zernio API ${res.status}: ${msg}`);
  }
  return json as T;
}

// ── Shapes de Zernio (según docs; verificadas en vivo con el probe) ─────
interface ZernioAccount {
  _id: string;
  platform: string;
  username?: string;
  displayName?: string;
  followersCount?: number;
  isActive?: boolean;
  enabled?: boolean;
  metadata?: {
    profileData?: {
      username?: string;
      displayName?: string;
      followersCount?: number;
      profileUrl?: string;
    };
  };
}

interface ZernioAnalyticsBlock {
  impressions?: number;
  reach?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  clicks?: number;
  views?: number;
  follows?: number;
  igReelsAvgWatchTime?: number; // en milisegundos
  engagementRate?: number;
}

interface ZernioPost {
  _id?: string;
  content?: string;
  publishedAt?: string;
  status?: string;
  mediaType?: string;
  thumbnailUrl?: string;
  platformPostUrl?: string;
  isAd?: boolean;
  analytics?: ZernioAnalyticsBlock;
  platforms?: { platformPostId?: string; platformPostUrl?: string; analytics?: ZernioAnalyticsBlock }[];
}

export async function listInstagramAccounts(): Promise<ZernioAccount[]> {
  const res = await zernioGet<{ accounts?: ZernioAccount[] }>('/v1/accounts', {
    platform: 'instagram',
  });
  return res.accounts ?? [];
}

async function fetchAllPosts(
  accountId: string,
  fromDate: string,
  toDate: string
): Promise<ZernioPost[]> {
  const all: ZernioPost[] = [];
  for (let page = 1; page <= 20; page++) {
    const res = await zernioGet<{ posts?: ZernioPost[] }>('/v1/analytics', {
      accountId,
      platform: 'instagram',
      fromDate,
      toDate,
      limit: '100',
      page: String(page),
    });
    const rows = res.posts ?? [];
    all.push(...rows);
    if (rows.length < 100) break;
  }
  return all;
}

function mapMediaType(t?: string): MediaPost['media_type'] {
  const v = (t ?? '').toUpperCase();
  if (v.includes('REEL') || v === 'VIDEO') return 'REEL';
  if (v.includes('CAROUSEL') || v.includes('ALBUM')) return 'CAROUSEL';
  if (v.includes('STORY')) return 'STORY';
  return 'IMAGE';
}

function mapPost(p: ZernioPost, accountId: string): MediaPost {
  // Las métricas viven en post.analytics (con fallback al primer platform).
  const a = p.analytics ?? p.platforms?.[0]?.analytics ?? {};
  const igId = p.platforms?.[0]?.platformPostId ?? p._id ?? '';
  const caption = p.content ?? '';
  const isReel = (p.mediaType ?? '').toUpperCase().includes('VIDEO') ||
    (p.platformPostUrl ?? '').includes('/reel/');
  return {
    id: 'post_' + (p._id ?? igId),
    account_id: 'acc_' + accountId,
    ig_media_id: igId,
    media_type: isReel ? 'REEL' : mapMediaType(p.mediaType),
    caption,
    hook: caption.split('\n')[0].slice(0, 90) || '(sin texto)',
    thumbnail_url: p.thumbnailUrl ?? null,
    permalink: p.platformPostUrl ?? p.platforms?.[0]?.platformPostUrl ?? '',
    published_at: p.publishedAt ?? new Date().toISOString(),
    likes: a.likes ?? 0,
    comments: a.comments ?? 0,
    saves: a.saves ?? 0,
    shares: a.shares ?? 0,
    views: a.views ?? a.impressions ?? 0,
    reach: a.reach ?? 0,
    avg_watch_time_seconds:
      a.igReelsAvgWatchTime != null && a.igReelsAvgWatchTime > 0
        ? +(a.igReelsAvgWatchTime / 1000).toFixed(1)
        : null,
    retention_curve: null,
  };
}

// Agrega los posts de cada día en un snapshot diario aproximado.
function buildDailySnapshots(posts: MediaPost[], accountId: string, followers: number): MetricSnapshot[] {
  const byDay = new Map<string, MediaPost[]>();
  for (const p of posts) {
    const day = p.published_at.slice(0, 10);
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push(p);
  }
  const snapshots: MetricSnapshot[] = [];
  for (const [day, dayPosts] of byDay) {
    const sum = (k: keyof MediaPost) => dayPosts.reduce((a, p) => a + (Number(p[k]) || 0), 0);
    const reach = sum('reach');
    const views = sum('views');
    const likes = sum('likes');
    const comments = sum('comments');
    const saves = sum('saves');
    const shares = sum('shares');
    const interactions = likes + comments + saves + shares;
    snapshots.push({
      id: `snap_${day}`,
      account_id: 'acc_' + accountId,
      snapshot_date: day,
      followers,
      followers_gained: 0,
      followers_lost: 0,
      views,
      reach,
      interactions,
      engagement_rate: reach ? +((interactions / reach) * 100).toFixed(2) : 0,
      likes,
      comments,
      saves,
      shares,
      reposts: 0,
      engaged_accounts: Math.round(interactions * 0.8),
      link_taps: 0,
      ctr_bio: 0,
      frequency: reach ? +(views / reach).toFixed(2) : 0,
    });
  }
  return snapshots.sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date));
}

// ── Sync completo desde Zernio ──────────────────────────────
export async function syncFromZernio(): Promise<{
  account: string;
  postsSynced: number;
  followers: number;
}> {
  const accounts = await listInstagramAccounts();
  const ig = accounts.find((a) => a.enabled !== false && a.isActive !== false) ?? accounts[0];
  if (!ig) {
    throw new Error(
      'No hay ninguna cuenta de Instagram conectada en Zernio. Conéctala primero en su dashboard.'
    );
  }

  const username = ig.metadata?.profileData?.username ?? ig.username ?? ig.displayName ?? 'instagram';
  const followers = ig.followersCount ?? ig.metadata?.profileData?.followersCount ?? 0;

  const to = new Date();
  const from = new Date(Date.now() - 90 * 86400_000);
  const rawPosts = await fetchAllPosts(
    ig._id,
    from.toISOString().slice(0, 10),
    to.toISOString().slice(0, 10)
  );

  const posts = rawPosts
    .map((p) => mapPost(p, ig._id))
    .filter((p) => p.ig_media_id)
    .sort((a, b) => b.published_at.localeCompare(a.published_at));
  await writeCollection('media_posts', posts);

  const snapshots = buildDailySnapshots(posts, ig._id, followers);
  await writeCollection('metric_snapshots', snapshots);
  await writeCollection('stories', []); // Zernio no expone historias en este plan

  const account: IgAccount = {
    id: 'acc_' + ig._id,
    ig_user_id: ig._id,
    username,
    account_type: 'MEDIA_CREATOR',
    token_expires_at: new Date(Date.now() + 60 * 86400_000).toISOString(),
    last_sync_at: new Date().toISOString(),
    connected: true,
  };
  await writeSingleton('account', account);

  return { account: username, postsSynced: posts.length, followers };
}
