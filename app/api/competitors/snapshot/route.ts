import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireWorkspace } from '@/lib/session';
import { addSnapshot, listCompetitors } from '@/lib/competitors/store';

// Registro MANUAL de una observación de competencia.
//
// Es el respaldo de Decisión #2: cuando Instagram bloquea el scraping (que es
// lo normal, no la excepción), el usuario puede mirar el perfil con sus ojos y
// anotar lo que ve. Queda marcado `method: 'manual'`, así que el agente sabe
// de dónde salió y lo sigue tratando como estimación.
const schema = z.object({
  competitor_id: z.string().min(1),
  followers: z.number().int().nonnegative().nullable().optional(),
  posts_count: z.number().int().nonnegative().nullable().optional(),
  avg_likes: z.number().int().nonnegative().nullable().optional(),
  avg_comments: z.number().int().nonnegative().nullable().optional(),
  // Cuántas publicaciones miró el usuario para estimar las medias. Es el `n`
  // de la observación: sin él, una media sacada de 2 posts pesa igual que una
  // de 30.
  sample_size: z.number().int().nonnegative(),
});

export async function POST(req: NextRequest) {
  const r = await requireWorkspace();
  if ('error' in r) return r.error;

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Datos inválidos', issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const competitors = await listCompetitors(r.ws);
  if (!competitors.some((c) => c.id === parsed.data.competitor_id)) {
    return NextResponse.json({ error: 'Ese competidor no existe' }, { status: 404 });
  }

  const { competitor_id, ...observation } = parsed.data;
  const snapshot = await addSnapshot(r.ws, {
    competitor_id,
    observed_at: new Date().toISOString(),
    method: 'manual',
    followers: observation.followers ?? null,
    posts_count: observation.posts_count ?? null,
    avg_likes: observation.avg_likes ?? null,
    avg_comments: observation.avg_comments ?? null,
    sample_size: observation.sample_size,
  });

  return NextResponse.json({ snapshot }, { status: 201 });
}
