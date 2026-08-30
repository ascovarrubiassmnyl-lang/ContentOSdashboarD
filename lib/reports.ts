import { MetricSnapshot, Report } from '@/types';
import { uid } from './db';
import { Workspace, readFor, writeFor } from './accounts';
import { generateAgentReport } from './agent/report';
import { seedIfNeeded } from './mock';

function inRange(date: string, start: string, end: string) {
  return date >= start && date <= end;
}

function sum(rows: MetricSnapshot[], key: keyof MetricSnapshot) {
  return rows.reduce((a, r) => a + (r[key] as number), 0);
}

export async function generateReport(
  ws: Workspace,
  periodStart: string,
  periodEnd: string
): Promise<Report> {
  await seedIfNeeded(ws);
  const snapshots = (await readFor<MetricSnapshot>(ws, 'metric_snapshots')).filter((s) =>
    inRange(s.snapshot_date, periodStart, periodEnd)
  );

  // Periodo anterior de igual longitud, para la comparativa que guarda el
  // campo `data` del Report (lo consume components/agente/ReportsPanel.tsx).
  const days = Math.max(
    1,
    Math.round(
      (new Date(periodEnd).getTime() - new Date(periodStart).getTime()) / 86400_000
    ) + 1
  );
  const prevEnd = new Date(new Date(periodStart).getTime() - 86400_000)
    .toISOString()
    .slice(0, 10);
  const prevStart = new Date(new Date(prevEnd).getTime() - (days - 1) * 86400_000)
    .toISOString()
    .slice(0, 10);
  const prevSnapshots = (await readFor<MetricSnapshot>(ws, 'metric_snapshots')).filter((s) =>
    inRange(s.snapshot_date, prevStart, prevEnd)
  );

  const agg = (rows: MetricSnapshot[]) => ({
    reach: sum(rows, 'reach'),
    views: sum(rows, 'views'),
    interactions: sum(rows, 'interactions'),
    saves: sum(rows, 'saves'),
    shares: sum(rows, 'shares'),
    gained: sum(rows, 'followers_gained'),
    lost: sum(rows, 'followers_lost'),
    taps: sum(rows, 'link_taps'),
  });
  const cur = agg(snapshots);
  const prev = agg(prevSnapshots);
  const pct = (c: number, p: number) => (p === 0 ? null : +(((c - p) / p) * 100).toFixed(1));

  const comparison = {
    reach: { current: cur.reach, previous: prev.reach, delta: pct(cur.reach, prev.reach) },
    views: { current: cur.views, previous: prev.views, delta: pct(cur.views, prev.views) },
    interactions: {
      current: cur.interactions,
      previous: prev.interactions,
      delta: pct(cur.interactions, prev.interactions),
    },
    saves: { current: cur.saves, previous: prev.saves, delta: pct(cur.saves, prev.saves) },
    followers_net: {
      current: cur.gained - cur.lost,
      previous: prev.gained - prev.lost,
      delta: pct(cur.gained - cur.lost, prev.gained - prev.lost),
    },
    link_taps: { current: cur.taps, previous: prev.taps, delta: pct(cur.taps, prev.taps) },
  };

  const { summary_md } = await generateAgentReport(ws, periodStart, periodEnd);

  const report: Report = {
    id: uid(),
    account_id: ws.id,
    period_start: periodStart,
    period_end: periodEnd,
    summary_md,
    data: comparison as unknown as Record<string, unknown>,
    created_at: new Date().toISOString(),
  };

  const reports = await readFor<Report>(ws, 'reports');
  reports.unshift(report);
  await writeFor(ws, 'reports', reports);
  return report;
}
