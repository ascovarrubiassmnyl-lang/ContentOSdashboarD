import { MediaPost, MetricSnapshot, Report } from '@/types';
import { readCollection, uid, writeCollection } from './db';
import { askClaude, hasClaudeKey } from './claude';
import { seedIfNeeded } from './mock';

function inRange(date: string, start: string, end: string) {
  return date >= start && date <= end;
}

function sum(rows: MetricSnapshot[], key: keyof MetricSnapshot) {
  return rows.reduce((a, r) => a + (r[key] as number), 0);
}

const REPORT_SYSTEM = `Eres el analista de contenido de Santiago Castro (@scav_86). Escribes reportes ejecutivos en español, en Markdown, con esta estructura: ## Resumen ejecutivo (3 líneas), ## Qué funcionó, ## Qué cayó, ## Recomendaciones concretas (accionables mañana, no teoría). Usas los números reales que te paso, sin inventar datos.`;

export async function generateReport(
  periodStart: string,
  periodEnd: string
): Promise<Report> {
  await seedIfNeeded();
  const snapshots = (await readCollection<MetricSnapshot>('metric_snapshots')).filter((s) =>
    inRange(s.snapshot_date, periodStart, periodEnd)
  );
  const posts = (await readCollection<MediaPost>('media_posts')).filter((p) =>
    inRange(p.published_at.slice(0, 10), periodStart, periodEnd)
  );

  // Periodo anterior de igual longitud, para la comparativa
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
  const prevSnapshots = (await readCollection<MetricSnapshot>('metric_snapshots')).filter((s) =>
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

  const topPosts = [...posts]
    .sort(
      (a, b) =>
        b.likes + b.comments + b.saves + b.shares -
        (a.likes + a.comments + a.saves + a.shares)
    )
    .slice(0, 3);

  let summary: string;
  if (hasClaudeKey()) {
    const dataBlock = `PERIODO: ${periodStart} → ${periodEnd} (vs ${prevStart} → ${prevEnd})\n\nCOMPARATIVA:\n${JSON.stringify(
      comparison,
      null,
      2
    )}\n\nTOP POSTS DEL PERIODO:\n${topPosts
      .map(
        (p) =>
          `- [${p.media_type}] "${p.hook}" → ${
            p.likes + p.comments + p.saves + p.shares
          } interacciones`
      )
      .join('\n')}`;
    summary = await askClaude(REPORT_SYSTEM, dataBlock, 2500);
  } else {
    const arrow = (d: number | null) =>
      d === null ? '—' : d >= 0 ? `▲ +${d}%` : `▼ ${d}%`;
    summary = `## Resumen ejecutivo

Entre **${periodStart}** y **${periodEnd}** la cuenta alcanzó **${cur.reach.toLocaleString(
      'es-CO'
    )} cuentas** (${arrow(comparison.reach.delta)} vs periodo anterior) con **${cur.views.toLocaleString(
      'es-CO'
    )} vistas** y un neto de **${cur.gained - cur.lost} seguidores nuevos**. Las interacciones ${
      (comparison.interactions.delta ?? 0) >= 0 ? 'crecieron' : 'cayeron'
    } ${arrow(comparison.interactions.delta)}.

## Qué funcionó

${topPosts
  .map(
    (p, i) =>
      `${i + 1}. **"${p.hook}"** (${p.media_type.toLowerCase()}) — ${
        p.likes + p.comments + p.saves + p.shares
      } interacciones, ${p.reach.toLocaleString('es-CO')} de alcance.`
  )
  .join('\n')}

Los guardados del periodo (${cur.saves.toLocaleString(
      'es-CO'
    )}, ${arrow(comparison.saves.delta)}) confirman que el contenido de valor accionable sigue siendo el motor de la cuenta.

## Qué cayó

${
  (comparison.link_taps.delta ?? 0) < 0
    ? `- Los taps al link cayeron ${arrow(
        comparison.link_taps.delta
      )} — revisar el CTA de bio y las historias con link.`
    : '- Sin caídas relevantes en los indicadores principales del periodo.'
}
${
  (comparison.views.delta ?? 0) < 0
    ? `- Las vistas retrocedieron ${arrow(comparison.views.delta)} — el volumen de publicación bajó o los hooks perdieron tensión.`
    : ''
}

## Recomendaciones concretas

1. **Duplicar el patrón del top 1**: "${topPosts[0]?.hook ?? '—'}" — grabar 2 variaciones del mismo ángulo esta semana.
2. **Programar en los horarios pico** detectados en el heatmap del dashboard (revisar sección Control).
3. **Convertir guardados en seguidores**: añadir CTA de seguimiento en los 3 posts con más guardados del periodo.

---
*Generado en modo demo — configura ANTHROPIC_API_KEY para reportes redactados por Claude.*`;
  }

  const report: Report = {
    id: uid(),
    account_id: 'acc_scav86',
    period_start: periodStart,
    period_end: periodEnd,
    summary_md: summary,
    data: comparison as unknown as Record<string, unknown>,
    created_at: new Date().toISOString(),
  };

  const reports = await readCollection<Report>('reports');
  reports.unshift(report);
  await writeCollection('reports', reports);
  return report;
}
