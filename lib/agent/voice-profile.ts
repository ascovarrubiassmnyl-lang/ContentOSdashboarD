// Perfil de voz de la cuenta, DERIVADO EN CÓDIGO de las piezas que mejor
// rendimiento tuvieron de verdad (Decisión #5 del plan de Fase 2).
//
// Por qué no se le pide al modelo que describa la voz: si el modelo inventa la
// definición y luego escribe "en esa voz", se está calificando a sí mismo con
// su propio criterio — el perfil no es falsable y no aporta nada. Midiendo el
// copy de las piezas que funcionaron, el perfil se puede contrastar contra la
// realidad y cambia cuando cambia el contenido.

import { MediaPost, VoiceProfile } from '@/types';
import { Workspace, readFor } from '../accounts';
import { confidenceTier } from './confidence';

// Cuántas piezas top se analizan. Suficientes para que un patrón se note, no
// tantas como para diluirlo con contenido mediocre.
const TOP_N = 15;

function interactions(p: MediaPost): number {
  return p.likes + p.comments + p.saves + p.shares;
}

function words(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean);
}

// Rango de emojis suficientemente amplio para el uso real en captions.
const EMOJI_RE = /\p{Extended_Pictographic}/gu;

function pct(count: number, total: number): number | null {
  if (total === 0) return null;
  return +((count / total) * 100).toFixed(1);
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return +(values.reduce((a, b) => a + b, 0) / values.length).toFixed(1);
}

export async function getVoiceProfile(ws: Workspace): Promise<VoiceProfile> {
  const all = await readFor<MediaPost>(ws, 'media_posts');
  const top = all
    .slice()
    .sort((a, b) => interactions(b) - interactions(a))
    .slice(0, TOP_N);

  const hooks = top.map((p) => p.hook).filter((h): h is string => Boolean(h && h.trim()));
  const captions = top.map((p) => p.caption).filter((c): c is string => Boolean(c && c.trim()));

  const formatCounts = new Map<MediaPost['media_type'], number>();
  for (const p of top) {
    formatCounts.set(p.media_type, (formatCounts.get(p.media_type) ?? 0) + 1);
  }

  const n = top.length;

  return {
    n,
    // El tier se calcula sobre las piezas analizadas, igual que en cualquier
    // otra tool: un "perfil de voz" sacado de 3 posts es una corazonada.
    confidence_tier: confidenceTier(n),
    based_on: `Las ${n} publicaciones con más interacciones de la cuenta (de ${all.length} en total).`,
    avg_hook_words: mean(hooks.map((h) => words(h).length)),
    avg_caption_chars: mean(captions.map((c) => c.length)),
    hooks_with_question_pct: pct(hooks.filter((h) => h.includes('?')).length, hooks.length),
    hooks_with_number_pct: pct(hooks.filter((h) => /\d/.test(h)).length, hooks.length),
    avg_emojis_per_caption: mean(captions.map((c) => (c.match(EMOJI_RE) ?? []).length)),
    dominant_formats: [...formatCounts.entries()]
      .map(([media_type, count]) => ({ media_type, count }))
      .sort((a, b) => b.count - a.count),
    // Ejemplos literales: le dan al modelo el registro real que debe imitar,
    // en vez de una descripción abstracta que puede interpretar como quiera.
    sample_hooks: hooks.slice(0, 8),
  };
}
