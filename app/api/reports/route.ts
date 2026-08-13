import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { activeWorkspace, readFor } from '@/lib/accounts';
import { seedIfNeeded } from '@/lib/mock';
import { generateReport } from '@/lib/reports';
import { Report } from '@/types';

const reportSchema = z.object({
  period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function GET() {
  const ws = await activeWorkspace();
  await seedIfNeeded(ws);
  const reports = await readFor<Report>(ws, 'reports');
  return NextResponse.json({ reports });
}

export async function POST(req: NextRequest) {
  const ws = await activeWorkspace();
  await seedIfNeeded(ws);
  const parsed = reportSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Fechas inválidas', issues: parsed.error.issues },
      { status: 400 }
    );
  }
  if (parsed.data.period_start > parsed.data.period_end) {
    return NextResponse.json(
      { error: 'La fecha inicial debe ser anterior a la final' },
      { status: 400 }
    );
  }
  try {
    const report = await generateReport(ws, parsed.data.period_start, parsed.data.period_end);
    return NextResponse.json({ report }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: `Error generando reporte: ${(err as Error).message}` },
      { status: 500 }
    );
  }
}
