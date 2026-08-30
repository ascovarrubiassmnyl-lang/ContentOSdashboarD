// Orquesta el loop del agente con un prompt de tarea fijo para producir el
// reporte quincenal de 5 secciones (crecimiento, retención, ranking + por
// qué, copy/formato + por qué, qué mejorar/mantener). Lo usan tanto
// lib/reports.ts (botón manual) como app/api/cron/reports/route.ts (cada 15
// días, sin intervención humana).

import { Insight, MediaPost, MetricSnapshot } from '@/types';
import { Workspace, readFor } from '../accounts';
import { runAgentTask } from './loop';

function inRange(date: string, start: string, end: string) {
  return date >= start && date <= end;
}

export async function generateAgentReport(
  ws: Workspace,
  periodStart: string,
  periodEnd: string
): Promise<{ summary_md: string; insights: Insight[] }> {
  const snapshots = (await readFor<MetricSnapshot>(ws, 'metric_snapshots')).filter((s) =>
    inRange(s.snapshot_date, periodStart, periodEnd)
  );
  const posts = (await readFor<MediaPost>(ws, 'media_posts')).filter((p) =>
    inRange(p.published_at.slice(0, 10), periodStart, periodEnd)
  );
  const hasData =
    posts.length > 0 || snapshots.some((s) => s.reach > 0 || s.views > 0 || s.interactions > 0);

  // Salida temprana ANTES de invocar al modelo: evita gastar una llamada y,
  // sobre todo, evita el riesgo de que el modelo "rellene" con generalidades
  // cuando no hay nada real que analizar (mismo criterio que tenía
  // lib/reports.ts antes de este plan).
  if (!hasData) {
    return {
      summary_md: `## Resumen ejecutivo

**No hay datos para el periodo ${periodStart} – ${periodEnd}.** No se registraron publicaciones ni métricas en esa ventana, así que no hay nada que analizar.

## Posibles causas

- La cuenta no publicó nada en esas fechas.
- Todavía no se ha sincronizado con Instagram: ve a **Conexión IG** y pulsa *Sincronizar ahora*.
- El periodo es anterior a los datos disponibles (Zernio entrega los últimos 90 días).

---
*Reporte sin datos — deliberadamente no se ha estimado ni redondeado ninguna cifra.*`,
      insights: [],
    };
  }

  // Periodo anterior de igual longitud, para que el agente pueda comparar
  // crecimiento sin tener que calcular fechas por su cuenta.
  const days = Math.max(
    1,
    Math.round((new Date(periodEnd).getTime() - new Date(periodStart).getTime()) / 86400_000) + 1
  );
  const prevEnd = new Date(new Date(periodStart).getTime() - 86400_000).toISOString().slice(0, 10);
  const prevStart = new Date(new Date(prevEnd).getTime() - (days - 1) * 86400_000)
    .toISOString()
    .slice(0, 10);

  const who = ws.username ? `${ws.label} (@${ws.username})` : ws.label;
  const taskPrompt = `Genera el reporte quincenal de ${who} para el periodo ${periodStart} → ${periodEnd} (compáralo contra el periodo anterior ${prevStart} → ${prevEnd}). Escribe el Markdown final con EXACTAMENTE estas 5 secciones, en este orden, cada una respaldada por tool calls antes de redactarse:

## 1. Crecimiento
Usa get_metrics para "reach", "views", "followers_net" e "interactions" en ambos periodos y compáralos. Reporta el delta.

## 2. Retención en video
Usa get_metrics o get_post_breakdown con segment.media_type = "REEL" en el periodo actual. Analiza avg_watch_time_seconds de esas piezas.

## 3. Ranking del mejor contenido y por qué
Usa get_post_breakdown ordenado por "interactions" en el periodo actual. Lista el top 3-5 y explica, con datos de esas mismas piezas (media_type, métricas), por qué funcionaron — no especules sin anclar la explicación a algo que devolvió la tool.

## 4. Copy y formato de las piezas top
Sobre las mismas piezas del ranking anterior, analiza el hook y el media_type. Además, usa get_format_performance en el periodo actual para comparar formatos entre sí — respeta el confidence_tier de cada formato por separado, no uses el de uno para hablar de otro. Identifica patrones repetidos.

## 5. Qué no funciona y qué mantener
Compara el periodo actual contra el anterior con get_metrics (mismas métricas de la sección 1) y con get_post_breakdown ordenado por "saves" e "interactions". Da recomendaciones accionables, no teoría genérica.

Cada afirmación de rendimiento en cualquiera de las 5 secciones debe tener un insight correspondiente en submit_insights.`;

  const result = await runAgentTask({ ws, taskPrompt });
  return { summary_md: result.replyMd, insights: result.insights };
}
