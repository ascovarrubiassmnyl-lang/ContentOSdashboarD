import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireWorkspace } from '@/lib/session';
import {
  addCompetitor,
  addSnapshot,
  latestSnapshotByCompetitor,
  listCompetitors,
  removeCompetitor,
} from '@/lib/competitors/store';
import { activeProvider } from '@/lib/competitors/refresh';

// GET — competidores con su última observación.
export async function GET() {
  const r = await requireWorkspace();
  if ('error' in r) return r.error;

  const competitors = await listCompetitors(r.ws);
  const latest = await latestSnapshotByCompetitor(r.ws);

  return NextResponse.json({
    competitors: competitors.map((c) => ({ ...c, latest: latest.get(c.id) ?? null })),
    provider: process.env.COMPETITOR_PROVIDER || 'instagram-public',
  });
}

const postSchema = z.object({
  username: z.string().min(1),
  label: z.string().optional(),
  notes: z.string().optional(),
});

// POST — añadir competidor. Intenta una primera observación de inmediato, pero
// que falle NO impide darlo de alta: el usuario puede registrar los datos a
// mano, que es justo el respaldo para cuando Instagram bloquea.
export async function POST(req: NextRequest) {
  const r = await requireWorkspace();
  if ('error' in r) return r.error;

  const parsed = postSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Datos inválidos', issues: parsed.error.issues },
      { status: 400 }
    );
  }

  let competitor;
  try {
    competitor = await addCompetitor(r.ws, parsed.data);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }

  let firstObservation: string | null = null;
  try {
    const observation = await activeProvider().fetchProfile(competitor.username);
    await addSnapshot(r.ws, {
      competitor_id: competitor.id,
      observed_at: new Date().toISOString(),
      method: 'scrape',
      ...observation,
    });
  } catch (err) {
    firstObservation = (err as Error).message;
  }

  return NextResponse.json(
    {
      competitor,
      // Se devuelve el motivo para que la UI pueda decir "añadido, pero no
      // pudimos leer su perfil: regístralo a mano" en vez de fingir éxito.
      scrapeError: firstObservation,
    },
    { status: 201 }
  );
}

const deleteSchema = z.object({ id: z.string().min(1) });

export async function DELETE(req: NextRequest) {
  const r = await requireWorkspace();
  if ('error' in r) return r.error;

  const parsed = deleteSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'Falta el id' }, { status: 400 });
  }
  await removeCompetitor(r.ws, parsed.data.id);
  return NextResponse.json({ ok: true });
}
