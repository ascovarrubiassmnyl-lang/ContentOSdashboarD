// Integración con Zernio (https://zernio.com) — fuente de datos reales de
// Instagram y de Páginas de Facebook, SIN necesidad de app de Meta propia.
// Zernio trae su propia app aprobada y gestiona la autorización.
//
// Auth: Authorization: Bearer <ZERNIO_API_KEY>
// Endpoints usados:
//   GET /v1/accounts                                      → cuentas conectadas
//   GET /v1/analytics?accountId=..&fromDate=..&toDate=..  → analytics por post
//
// En ambos endpoints `platform` es OPCIONAL: omitirlo devuelve todas las
// plataformas. Antes se mandaba `platform=instagram` fijo, y por eso las
// Páginas de Facebook conectadas en Zernio no aparecían nunca aquí.
import {
  PLATFORMS,
  Platform,
  Workspace,
  accountPlatform,
  getZernioKey,
  updateAccount,
  writeFor,
  writeSingletonFor,
} from './accounts';
import { IgAccount, MediaPost, MetricSnapshot } from '@/types';

const BASE = process.env.ZERNIO_BASE_URL || 'https://api.zernio.com';

// Solo indica si hay una key GLOBAL en el entorno (la de la cuenta original).
// Para saber si una cuenta concreta puede sincronizar, usa hasZernioFor(ws).
export function hasZernioKey(): boolean {
  return Boolean(process.env.ZERNIO_API_KEY);
}

async function zernioGet<T>(
  apiKey: string,
  path: string,
  params: Record<string, string> = {}
): Promise<T> {
  const url = `${BASE}${path}${Object.keys(params).length ? `?${new URLSearchParams(params)}` : ''}`;
  const res = await fetch(url, {
    headers: {
      authorization: `Bearer ${apiKey}`,
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
    // 402 = la cuenta de Zernio dueña de esta API key está en un plan ANTIGUO,
    // de cuando Analytics era un add-on de pago. Zernio ya eliminó los planes
    // por niveles (analytics incluido, 2 cuentas gratis), pero las cuentas
    // viejas se quedan como estaban hasta que cambian de plan a mano.
    if (res.status === 402) {
      throw new Error(
        'La cuenta de Zernio dueña de esta API key está en un plan antiguo, donde Analytics ' +
          'era un add-on de pago. Ya no existe ese add-on: Zernio incluye analytics y da 2 ' +
          'cuentas gratis, pero hay que pasarse al plan nuevo desde su panel. Lo más simple ' +
          'es conectar esta cuenta de Instagram en la MISMA cuenta de Zernio que ya usas.'
      );
    }
    if (res.status === 401 || res.status === 403) {
      throw new Error(
        `Zernio rechazó la API key (${res.status}). Revisa que sea la correcta y que siga activa.`
      );
    }
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
  // Imagen de perfil. Ojo: `profileUrl` es el ENLACE al perfil, no la imagen —
  // se usaba por error como avatar y por eso nunca se veía ninguno.
  profilePicture?: string | null;
  profileUrl?: string;
  followersCount?: number;
  isActive?: boolean;
  enabled?: boolean;
  metadata?: {
    profileData?: {
      username?: string;
      displayName?: string;
      followersCount?: number;
      profilePicture?: string;
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

function isSupported(a: ZernioAccount): a is ZernioAccount & { platform: Platform } {
  return (PLATFORMS as readonly string[]).includes(a.platform);
}

// Todas las cuentas de la key que ContentOS sabe analizar. Zernio conecta 16
// plataformas (y varias redes de anuncios); aquí solo interesan Instagram y
// Facebook, así que el resto se descarta en vez de ofrecerlas y fallar luego.
export async function listConnectedAccounts(apiKey: string): Promise<ZernioAccount[]> {
  const res = await zernioGet<{ accounts?: ZernioAccount[] }>(apiKey, '/v1/accounts');
  return (res.accounts ?? []).filter(isSupported);
}

// Resumen ligero de una cuenta de Zernio, para el flujo "añadir cuenta".
export interface ZernioAccountOption {
  id: string;
  platform: Platform;
  username: string;
  displayName: string;
  followers: number;
  avatarUrl: string | null;
}

// Un texto en blanco es como si no llegara. Hace falta distinguirlo porque `??`
// no lo cubre: Zernio manda `""` —no `null`— en los campos que la cuenta no
// tiene, y muchas Páginas de Facebook no tienen nombre de usuario. Ese `""` se
// colaba hasta el alta y la rechazaba con un "Datos inválidos" sin explicación.
function firstText(...vals: unknown[]): string {
  for (const v of vals) {
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

// Los contadores llegan a veces como cadena. Number('') es 0 y Number(undefined)
// es NaN, así que se normaliza a un entero >= 0 en todos los casos.
function count(...vals: unknown[]): number {
  for (const v of vals) {
    const n = typeof v === 'number' || typeof v === 'string' ? Number(v) : NaN;
    if (Number.isFinite(n) && n > 0) return Math.trunc(n);
  }
  return 0;
}

export function toAccountOption(a: ZernioAccount): ZernioAccountOption {
  const p = a.metadata?.profileData;
  const platform: Platform = isSupported(a) ? a.platform : 'instagram';
  // Una Página de Facebook puede no tener nombre de usuario: ahí el nombre
  // visible ES su identidad, así que se busca primero.
  const name =
    platform === 'facebook'
      ? firstText(a.displayName, p?.displayName, a.username, p?.username)
      : firstText(p?.username, a.username, a.displayName, p?.displayName);
  return {
    id: a._id,
    platform,
    // Último recurso para que nunca vaya vacío: sin nombre, el id la identifica.
    username: (name || `${platform}-${a._id.slice(-6)}`).slice(0, 80),
    displayName: firstText(p?.displayName, a.displayName),
    followers: count(a.followersCount, p?.followersCount),
    avatarUrl: firstText(a.profilePicture, p?.profilePicture) || null,
  };
}

async function fetchAllPosts(
  apiKey: string,
  accountId: string,
  fromDate: string,
  toDate: string
): Promise<ZernioPost[]> {
  const all: ZernioPost[] = [];
  for (let page = 1; page <= 20; page++) {
    // Sin `platform`: ya se filtra por `accountId`, y fijarlo a Instagram
    // dejaba fuera los posts de las Páginas de Facebook.
    const res = await zernioGet<{ posts?: ZernioPost[] }>(apiKey, '/v1/analytics', {
      accountId,
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
    follows: a.follows ?? null,
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

// ── Sync completo desde Zernio, para UNA cuenta ─────────────
// Cada cuenta trae su propia API key y su propio ID dentro de Zernio, así que
// los datos se escriben en las colecciones con el namespace de esa cuenta.
export async function syncFromZernio(ws: Workspace): Promise<{
  account: string;
  postsSynced: number;
  followers: number;
}> {
  const platform = accountPlatform(ws);
  const apiKey = await getZernioKey(ws);
  if (!apiKey) {
    throw new Error(
      `${ws.label} no tiene una API key de Zernio configurada. Añádela en Conexión.`
    );
  }

  const accounts = await listConnectedAccounts(apiKey);
  if (accounts.length === 0) {
    throw new Error(
      'Esta API key no tiene ninguna cuenta de Instagram ni Página de Facebook conectada en ' +
        'Zernio. Conéctala primero en su panel.'
    );
  }

  // Si el workspace apunta a una cuenta concreta de Zernio, tiene que ser ESA.
  // Caer a "la primera activa" cuando no aparece sería catastrófico en
  // multicuenta: sobrescribiría los datos de una cuenta con los de otra.
  let ig;
  if (ws.zernio_account_id) {
    ig = accounts.find((a) => a._id === ws.zernio_account_id);
    if (!ig) {
      throw new Error(
        `Esta API key de Zernio no contiene la cuenta ${ws.username || ws.label}. ` +
          `Contiene: ${accounts.map((a) => toAccountOption(a).username).join(', ')}. ` +
          'Si moviste la cuenta a otra cuenta de Zernio, elimínala aquí y vuelve a añadirla con la key correcta.'
      );
    }
  } else {
    // Solo la cuenta original (creada antes del multicuenta) llega sin id.
    ig = accounts.find((a) => a.enabled !== false && a.isActive !== false) ?? accounts[0];
  }

  const option = toAccountOption(ig);
  const username = option.username;
  const followers = option.followers;

  const to = new Date();
  const from = new Date(Date.now() - 90 * 86400_000);
  const rawPosts = await fetchAllPosts(
    apiKey,
    ig._id,
    from.toISOString().slice(0, 10),
    to.toISOString().slice(0, 10)
  );

  const posts = rawPosts
    .map((p) => mapPost(p, ig._id))
    .filter((p) => p.ig_media_id)
    .sort((a, b) => b.published_at.localeCompare(a.published_at));
  await writeFor(ws, 'media_posts', posts);

  const snapshots = buildDailySnapshots(posts, ig._id, followers);
  await writeFor(ws, 'metric_snapshots', snapshots);
  await writeFor(ws, 'stories', []); // Zernio no expone historias en este plan

  const syncedAt = new Date().toISOString();
  const account: IgAccount = {
    id: ws.id,
    ig_user_id: ig._id,
    username,
    // Una Página de Facebook siempre es un perfil de negocio; en Instagram la
    // cuenta tiene que ser Creator o Business para que haya métricas.
    account_type: platform === 'facebook' ? 'BUSINESS' : 'MEDIA_CREATOR',
    token_expires_at: new Date(Date.now() + 60 * 86400_000).toISOString(),
    last_sync_at: syncedAt,
    connected: true,
  };
  await writeSingletonFor(ws, 'account', account);

  // El registro de cuentas guarda lo que necesita el selector del menú.
  await updateAccount(ws.id, {
    username,
    followers,
    last_sync_at: syncedAt,
    zernio_account_id: ig._id,
    avatar_url: option.avatarUrl ?? ws.avatar_url,
  });

  return { account: username, postsSynced: posts.length, followers };
}
