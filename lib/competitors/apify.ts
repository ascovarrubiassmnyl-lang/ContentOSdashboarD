// Proveedor de competencia sobre Apify.
//
// Existe porque `instagram-public` está confirmado bloqueado: Instagram
// responde 400 a su endpoint público desde una IP de servidor. Apify mantiene
// el scraper (proxies, sesiones, cambios de endpoint) y aquí solo se traduce
// su salida al CompetitorObservation que el resto de la app ya entiende.
//
// Es de pago y se factura por perfil leído. Con el cron diario y 10
// competidores son ~300 lecturas al mes: revisa el plan antes de activarlo.

import { instagramActor, num, runActor } from '../apify';
import { CompetitorObservation, CompetitorProvider } from './types';

// Cuántas publicaciones recientes se piden para promediar likes/comentarios.
// Es el `n` de la observación, así que subirlo mejora la muestra y encarece
// la corrida en la misma proporción.
const POSTS_PER_PROFILE = 12;

export const apifyCompetitorProvider: CompetitorProvider = {
  name: 'apify',

  async fetchProfile(username: string): Promise<CompetitorObservation> {
    const items = await runActor(instagramActor(), {
      directUrls: [`https://www.instagram.com/${username}/`],
      resultsType: 'details',
      resultsLimit: POSTS_PER_PROFILE,
      addParentData: false,
    });

    const profile = items[0];
    const followers = num(profile, 'followersCount');
    if (followers === null) {
      throw new Error(
        `Apify no devolvió el número de seguidores de @${username}. La cuenta puede ser privada o el actor cambió de formato.`
      );
    }

    // Las medias salen de las publicaciones que el actor pudo ver. Si no vio
    // ninguna, se devuelve sample_size: 0 con las medias en null — nunca 0,
    // que se leería como "mide cero interacciones".
    const posts = Array.isArray(profile.latestPosts)
      ? (profile.latestPosts as Record<string, unknown>[])
      : [];

    const likes = posts.map((p) => num(p, 'likesCount')).filter((n): n is number => n !== null && n >= 0);
    const comments = posts
      .map((p) => num(p, 'commentsCount'))
      .filter((n): n is number => n !== null && n >= 0);

    const avg = (xs: number[]) =>
      xs.length === 0 ? null : Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);

    return {
      followers,
      posts_count: num(profile, 'postsCount'),
      avg_likes: avg(likes),
      avg_comments: avg(comments),
      sample_size: posts.length,
    };
  },
};
