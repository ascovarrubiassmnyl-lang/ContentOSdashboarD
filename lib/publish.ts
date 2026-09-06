// Publicación automática: de una pieza del calendario a una publicación real
// en Instagram o en una Página de Facebook, a través de Zernio.
//
// El ciclo completo:
//   1. El usuario sube el archivo a ContentOS  → lib/media/store.ts
//   2. Cerca de la hora  → POST /v1/media/presign + PUT del archivo a Zernio
//   3. POST /v1/posts con scheduledFor          → Zernio publica solo
//   4. GET /v1/posts/{id}                       → estado real y enlace
//
// Por qué el paso 2 va CERCA de la hora y no al subir: los archivos subidos a
// Zernio viven 7 días en almacenamiento temporal y solo pasan a permanente
// cuando el post que los usa se publica. Su propia guía lo dice: si programas
// con semanas de antelación, guarda el archivo de tu lado. Por eso ContentOS
// es el dueño del binario y Zernio lo recibe como muy pronto PUBLISH_LEAD_DAYS
// antes.
import { createHash } from 'crypto';
import {
  Workspace,
  accountPlatform,
  getZernioKey,
  readFor,
  writeFor,
} from './accounts';
import { zernioRequest } from './zernio';
import { deleteMedia, getMediaBytes } from './media/store';
import { CalendarItem, CalendarPublish, PublishState } from '@/types';

// Ventana de subida, en días. Tiene que quedar por debajo de los 7 días de
// caducidad del almacenamiento temporal de Zernio, con margen para que un cron
// caído un día no se coma el margen entero.
export const PUBLISH_LEAD_DAYS = clampDays(process.env.PUBLISH_LEAD_DAYS, 6);

function clampDays(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.max(n, 0.01), 6.5);
}

const LEAD_MS = () => PUBLISH_LEAD_DAYS * 86400_000;

// Cuánto se tolera que una pieza se pase de hora antes de dejar de intentarlo.
// Si el cron estuvo caído dos días, publicar "el martes" un jueves es peor que
// no publicar: la pieza se marca en error y el usuario decide.
const LATE_GRACE_MS = 6 * 3600_000;

export const publishState = (item: CalendarItem): PublishState =>
  item.publish?.state ?? 'off';

export function emptyPublish(): CalendarPublish {
  return {
    auto: false,
    state: 'off',
    zernio_post_id: null,
    permalink: null,
    error: null,
    pushed_at: null,
    published_at: null,
  };
}

// ── Reglas de qué se puede publicar ─────────────────────────
// Devuelve el motivo por el que NO se puede, o null si sí se puede. Se usa
// tanto en la interfaz (para explicarlo antes) como en el motor (para no
// intentarlo).
export function publishBlocker(ws: Workspace, item: CalendarItem): string | null {
  if (!ws.zernio_account_id) {
    return 'Esta cuenta se creó antes del multicuenta y no tiene id de Zernio. Vuelve a añadirla en Conexión.';
  }
  if (item.format === 'ad') {
    return 'Los anuncios no se publican desde aquí: son otra superficie de la API (Meta Ads).';
  }
  if (!item.media) return 'Falta el archivo: Instagram no acepta publicaciones sin imagen ni video.';
  if (item.format === 'reel' && item.media.kind !== 'video') {
    return 'Un reel necesita un video.';
  }
  if (item.format === 'carrusel' && item.media.kind !== 'image') {
    return 'Sube una imagen: el carrusel de varias imágenes todavía no está soportado y esta pieza saldrá como publicación de feed.';
  }
  const text = captionFor(item);
  if (text.length > 2200) return 'El texto pasa de 2200 caracteres, el máximo de Instagram.';
  return null;
}

export function captionFor(item: CalendarItem): string {
  return (item.caption ?? '').trim() || item.title.trim();
}

// ── Traducción de formato de ContentOS a opciones de Zernio ──
// Un solo video publica como Reel automáticamente en Instagram, así que ahí
// solo hay que decir lo contrario cuando NO es un reel.
function platformTarget(ws: Workspace, item: CalendarItem) {
  const platform = accountPlatform(ws);
  const data: Record<string, unknown> = {};
  if (item.format === 'historia') {
    data.contentType = 'story';
  } else if (item.format === 'reel') {
    if (platform === 'facebook') data.contentType = 'reel';
    else data.shareToFeed = true; // el reel también aparece en el feed principal
  }
  return {
    platform,
    accountId: ws.zernio_account_id as string,
    ...(Object.keys(data).length ? { platformSpecificData: data } : {}),
  };
}

// Identificador estable por intento lógico. Zernio trata dos peticiones con el
// mismo `x-request-id` (ventana de ~5 min) como reintento y devuelve el post
// original en vez de crear otro. Derivarlo de la pieza y su hora es justo lo
// que se quiere: si el cron y la app empujan a la vez, sale UN post.
function requestId(item: CalendarItem, mode: string): string {
  // El modo entra en la huella: programar y "publicar ya" son dos peticiones
  // lógicas distintas sobre la misma pieza. Sin esto, pulsar "Publicar ahora"
  // a los pocos minutos de programarla devolvía el post programado como si
  // fuera un reintento, y no se publicaba nada.
  const h = createHash('sha1').update(`${item.id}|${item.scheduled_at}|${mode}`).digest('hex');
  return [h.slice(0, 8), h.slice(8, 12), '4' + h.slice(13, 16), '8' + h.slice(17, 20), h.slice(20, 32)].join('-');
}

// ── Subida del archivo a Zernio ─────────────────────────────
interface PresignResponse {
  uploadUrl: string;
  publicUrl: string;
  key: string;
}

async function uploadToZernio(apiKey: string, item: CalendarItem): Promise<string> {
  const media = item.media!;
  const bytes = await getMediaBytes(media.key);
  if (!bytes) {
    throw new Error('El archivo ya no está en ContentOS. Vuelve a subirlo a la pieza.');
  }
  const presign = await zernioRequest<PresignResponse>(apiKey, {
    method: 'POST',
    path: '/v1/media/presign',
    body: { filename: media.filename, contentType: media.mime, size: media.size },
  });
  // El PUT va directo al almacenamiento, sin cabecera de autorización: la
  // firma va en la URL y añadir un Bearer la invalida.
  const res = await fetch(presign.uploadUrl, {
    method: 'PUT',
    headers: { 'content-type': media.mime },
    body: new Uint8Array(bytes),
  });
  if (!res.ok) {
    throw new Error(
      `No se pudo subir el archivo a Zernio (HTTP ${res.status}). Reintenta en unos minutos.`
    );
  }
  return presign.publicUrl;
}

// ── Creación del post ───────────────────────────────────────
interface ZernioPostResponse {
  post?: { _id?: string; status?: string; platforms?: { platformPostUrl?: string }[] };
  existingPost?: { _id?: string };
}

/**
 * Sube el archivo y crea el post en Zernio. Devuelve el bloque `publish`
 * actualizado — no escribe nada: guardar es responsabilidad de quien llama,
 * que es el único que sabe en qué colección vive la pieza.
 */
export async function pushToZernio(
  ws: Workspace,
  item: CalendarItem,
  opts: { now?: boolean } = {}
): Promise<CalendarPublish> {
  const base: CalendarPublish = { ...emptyPublish(), ...(item.publish ?? {}), auto: true };
  const blocker = publishBlocker(ws, item);
  if (blocker) return { ...base, state: 'error', error: blocker };

  const apiKey = await getZernioKey(ws);
  if (!apiKey) {
    return {
      ...base,
      state: 'error',
      error: `${ws.label} no tiene API key de Zernio. Añádela en Conexión.`,
    };
  }

  // Si la hora ya pasó (el cron estuvo caído un rato, o la pieza se activó
  // tarde) programarla es imposible: Zernio solo acepta instantes futuros. Con
  // el retraso dentro de la tolerancia, lo correcto es publicarla ya.
  const scheduled = new Date(item.scheduled_at);
  const publishNow = Boolean(opts.now) || scheduled.getTime() <= Date.now() + 60_000;

  try {
    const url = await uploadToZernio(apiKey, item);
    const res = await zernioRequest<ZernioPostResponse>(apiKey, {
      method: 'POST',
      path: '/v1/posts',
      headers: { 'x-request-id': requestId(item, publishNow ? 'now' : 'sched') },
      body: {
        title: item.title.slice(0, 160),
        content: captionFor(item),
        mediaItems: [{ url, type: item.media!.kind }],
        platforms: [platformTarget(ws, item)],
        // Instante UTC absoluto con sufijo Z. Con `Z` la API ignora el campo
        // `timezone`, que es justo lo que se quiere: la hora no depende ni de
        // la zona del servidor ni de la del panel de Zernio.
        ...(publishNow ? { publishNow: true } : { scheduledFor: scheduled.toISOString() }),
      },
    });
    const post = res.post ?? res.existingPost;
    const id = post?._id ?? null;
    if (!id) throw new Error('Zernio aceptó el post pero no devolvió su id.');
    const permalink = res.post?.platforms?.[0]?.platformPostUrl ?? null;
    const published = publishNow && isPublishedStatus(res.post?.status);
    return {
      ...base,
      state: published ? 'publicado' : 'programado',
      zernio_post_id: id,
      permalink,
      error: null,
      pushed_at: new Date().toISOString(),
      published_at: published ? new Date().toISOString() : null,
    };
  } catch (err) {
    return { ...base, state: 'error', error: (err as Error).message };
  }
}

function isPublishedStatus(status?: string): boolean {
  // El esquema de Zernio usa `completed`; su guía de inicio habla de
  // `published`. Se aceptan los dos para no depender de cuál mande hoy.
  return status === 'completed' || status === 'published';
}

/** Cancela el post en Zernio si sigue programado. Nunca lanza. */
export async function cancelInZernio(ws: Workspace, item: CalendarItem): Promise<void> {
  const id = item.publish?.zernio_post_id;
  if (!id) return;
  if (item.publish?.state === 'publicado') return; // lo publicado no se cancela
  try {
    const apiKey = await getZernioKey(ws);
    if (!apiKey) return;
    await zernioRequest(apiKey, { method: 'DELETE', path: `/v1/posts/${id}` });
  } catch {
    // Si Zernio ya lo publicó o lo borró, no hay nada que arreglar aquí.
  }
}

// ── Refresco del estado de un post ya creado ────────────────
export async function refreshFromZernio(
  ws: Workspace,
  item: CalendarItem
): Promise<CalendarPublish> {
  const current: CalendarPublish = { ...emptyPublish(), ...(item.publish ?? {}) };
  const id = current.zernio_post_id;
  if (!id) return current;
  try {
    const apiKey = await getZernioKey(ws);
    if (!apiKey) return current;
    const res = await zernioRequest<ZernioPostResponse>(apiKey, {
      path: `/v1/posts/${id}`,
    });
    const post = res.post;
    if (!post) return current;
    const permalink = post.platforms?.find((p) => p.platformPostUrl)?.platformPostUrl ?? null;
    if (isPublishedStatus(post.status)) {
      return {
        ...current,
        state: 'publicado',
        permalink: permalink ?? current.permalink,
        error: null,
        published_at: current.published_at ?? new Date().toISOString(),
      };
    }
    if (post.status === 'failed') {
      return { ...current, state: 'error', error: 'Zernio no pudo publicarla.' };
    }
    if (post.status === 'cancelled') {
      return { ...current, state: 'error', error: 'El post se canceló en Zernio.' };
    }
    return { ...current, state: 'programado', permalink: permalink ?? current.permalink };
  } catch (err) {
    return { ...current, error: (err as Error).message };
  }
}

// ── Motor: qué toca hacer con cada pieza ────────────────────
export function isWithinPushWindow(item: CalendarItem, now = Date.now()): boolean {
  const at = new Date(item.scheduled_at).getTime();
  if (Number.isNaN(at)) return false;
  return at - now <= LEAD_MS();
}

function isTooLate(item: CalendarItem, now = Date.now()): boolean {
  const at = new Date(item.scheduled_at).getTime();
  return !Number.isNaN(at) && now - at > LATE_GRACE_MS;
}

// Una sola pieza no puede estar empujándose dos veces a la vez (el cron y la
// app pueden coincidir). El `x-request-id` ya evita el post duplicado en
// Zernio; esto además evita subir el archivo dos veces.
const inFlight = new Set<string>();

/**
 * Decide y ejecuta lo que corresponda para UNA pieza, y lo guarda.
 * Es la única función que escribe el bloque `publish`.
 */
export async function advanceItem(
  ws: Workspace,
  itemId: string,
  opts: { now?: boolean; force?: boolean } = {}
): Promise<CalendarItem | null> {
  if (inFlight.has(itemId)) return null;
  inFlight.add(itemId);
  try {
    const items = await readFor<CalendarItem>(ws, 'calendar_items');
    const idx = items.findIndex((i) => i.id === itemId);
    if (idx === -1) return null;
    const item = items[idx];
    const pub: CalendarPublish = { ...emptyPublish(), ...(item.publish ?? {}) };
    if (!pub.auto && !opts.now) return item;

    // Volver a empujar con un post ya creado en Zernio duplicaría la
    // publicación: primero se cancela el anterior. Pasa al pulsar "Publicar
    // ahora" sobre algo ya programado, y al reintentar a mano algo que falló.
    if ((opts.now || opts.force) && pub.zernio_post_id) {
      await cancelInZernio(ws, item);
      pub.zernio_post_id = null;
      pub.permalink = null;
    }

    let next = pub;
    if (pub.state === 'publicado') {
      next = pub;
    } else if (pub.zernio_post_id) {
      next = await refreshFromZernio(ws, item);
    } else if (opts.now || opts.force || isWithinPushWindow(item)) {
      if (!opts.now && isTooLate(item)) {
        next = {
          ...pub,
          state: 'error',
          error: 'La hora programada ya pasó hace demasiado. Cambia la fecha o publícala a mano.',
        };
      } else {
        next = await pushToZernio(ws, { ...item, publish: pub }, { now: opts.now });
      }
    } else {
      next = { ...pub, state: 'pendiente', error: null };
    }

    const updated: CalendarItem = {
      ...item,
      publish: next,
      // Que la pieza quede marcada como publicada en el calendario es el punto
      // de todo esto: si no, el usuario no distingue lo que salió de lo que no.
      status: next.state === 'publicado' ? 'publicado' : item.status,
    };
    // Ya publicada: el binario no hace falta y ocupa. El enlace de la
    // publicación queda guardado en `publish.permalink`.
    if (next.state === 'publicado' && updated.media) {
      await deleteMedia(updated.media.key);
      updated.media = null;
    }
    items[idx] = updated;
    await writeFor(ws, 'calendar_items', items);
    return updated;
  } finally {
    inFlight.delete(itemId);
  }
}

export interface PublishTickReport {
  account: string;
  pushed: string[];
  refreshed: number;
  published: string[];
  errors: { title: string; error: string }[];
}

/** Un pase completo sobre una cuenta: empujar, refrescar y limpiar. */
export async function runPublishTick(ws: Workspace): Promise<PublishTickReport> {
  const report: PublishTickReport = {
    account: ws.label,
    pushed: [],
    refreshed: 0,
    published: [],
    errors: [],
  };
  const items = await readFor<CalendarItem>(ws, 'calendar_items');
  for (const item of items) {
    const pub = item.publish;
    if (!pub?.auto) continue;
    if (pub.state === 'publicado') continue;
    const needsPush =
      !pub.zernio_post_id && (pub.state === 'pendiente' || pub.state === 'error');
    if (needsPush && !isWithinPushWindow(item)) continue;
    if (!needsPush && !pub.zernio_post_id) continue;

    const updated = await advanceItem(ws, item.id);
    if (!updated?.publish) continue;
    const after = updated.publish.state;
    if (needsPush && after === 'programado') report.pushed.push(item.title);
    if (!needsPush) report.refreshed++;
    // Aquí `publicado` siempre es nuevo: las ya publicadas se saltaron arriba.
    if (after === 'publicado') report.published.push(item.title);
    if (after === 'error' && updated.publish.error) {
      report.errors.push({ title: item.title, error: updated.publish.error });
    }
  }
  return report;
}
