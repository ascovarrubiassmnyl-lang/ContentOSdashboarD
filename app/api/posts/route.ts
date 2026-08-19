import { NextResponse } from 'next/server';
import { activeWorkspace, readFor } from '@/lib/accounts';
import { seedIfNeeded } from '@/lib/mock';
import { MediaPost } from '@/types';

// Todos los posts de la cuenta activa, del más reciente al más antiguo.
// /api/metrics solo devuelve recortes (top 5, últimos 8) porque alimenta el
// dashboard; la galería necesita el catálogo completo.
export async function GET() {
  const ws = await activeWorkspace();
  await seedIfNeeded(ws);
  const posts = (await readFor<MediaPost>(ws, 'media_posts')).sort((a, b) =>
    b.published_at.localeCompare(a.published_at)
  );
  return NextResponse.json({ posts });
}
