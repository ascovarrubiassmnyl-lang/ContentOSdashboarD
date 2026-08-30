// Proveedor de video individual sobre Apify.
//
// Lee UN post público de Instagram a partir de su URL. Se usa cuando el
// usuario pega un link en el chat: "mira este reel".

import { instagramActor, num, runActor, str } from '../apify';
import { VideoObservation, VideoProvider } from './types';

const INSTAGRAM_HOSTS = ['instagram.com', 'www.instagram.com', 'instagr.am'];

// Acepta /p/, /reel/, /reels/ y /tv/. Devuelve la URL canónica, porque el
// actor se atraganta con parámetros de tracking (?igsh=…) pegados desde la app.
export function normalizeInstagramUrl(raw: string): string {
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    throw new Error(`"${raw}" no es una URL válida. Pega el link completo, empezando por https://`);
  }

  const host = parsed.hostname.toLowerCase();
  if (!INSTAGRAM_HOSTS.includes(host)) {
    throw new Error(
      `Solo se pueden leer links de Instagram y este es de ${host}. TikTok y YouTube necesitarían otro actor de Apify.`
    );
  }

  const match = parsed.pathname.match(/\/(p|reel|reels|tv)\/([A-Za-z0-9_-]+)/);
  if (!match) {
    throw new Error(
      'Ese link de Instagram no apunta a una publicación. Necesito uno de /p/, /reel/ o /tv/ — el de un perfil no sirve.'
    );
  }
  const [, kind, code] = match;
  // /reels/ solo existe en la app; la web canónica es /reel/.
  return `https://www.instagram.com/${kind === 'reels' ? 'reel' : kind}/${code}/`;
}

export const apifyVideoProvider: VideoProvider = {
  name: 'apify',

  async fetchVideo(url: string): Promise<VideoObservation> {
    const canonical = normalizeInstagramUrl(url);

    const items = await runActor(instagramActor(), {
      directUrls: [canonical],
      resultsType: 'posts',
      resultsLimit: 1,
      addParentData: false,
    });

    const post = items[0];

    const likes = num(post, 'likesCount', 'likes');
    const comments = num(post, 'commentsCount', 'comments');
    // Un post que existe siempre trae al menos una de las dos. Si no viene
    // ninguna, el actor devolvió otra cosa (una página de login, un item de
    // perfil) y hay que fallar en vez de reportar nulls como si fueran el post.
    if (likes === null && comments === null) {
      throw new Error(
        'Apify respondió, pero sin likes ni comentarios: probablemente devolvió otra cosa en lugar del post. Comprueba el link.'
      );
    }

    // Instagram oculta el contador de likes en muchos posts; -1 es cómo lo
    // marca el actor. Convertirlo a null evita reportar "-1 likes".
    const hidden = (n: number | null) => (n !== null && n < 0 ? null : n);

    return {
      url: canonical,
      author: str(post, 'ownerUsername', 'username'),
      caption: str(post, 'caption'),
      posted_at: str(post, 'timestamp'),
      media_type: str(post, 'type', 'productType'),
      duration_seconds: num(post, 'videoDuration'),
      likes: hidden(likes),
      comments: hidden(comments),
      plays: num(post, 'videoPlayCount', 'videoViewCount'),
    };
  },
};
