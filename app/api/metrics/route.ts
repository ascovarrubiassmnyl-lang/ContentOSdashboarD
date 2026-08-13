import { NextRequest, NextResponse } from 'next/server';
import { buildMetrics } from '@/lib/metrics';
import { activeWorkspace } from '@/lib/accounts';
import { Period } from '@/types';

export async function GET(req: NextRequest) {
  const period = (req.nextUrl.searchParams.get('period') ?? '7d') as Period;
  if (!['today', '7d', '30d'].includes(period)) {
    return NextResponse.json({ error: 'Periodo inválido' }, { status: 400 });
  }
  const ws = await activeWorkspace();
  return NextResponse.json(await buildMetrics(ws, period));
}
