// Tools que ESCRIBEN. Separadas de las de lectura a propósito: son las únicas
// que dejan rastro, y conviene poder verlas todas de un vistazo.
//
// Decisión #4 del plan de Fase 2: nada de esto sale de ContentOS. Los guiones
// nacen como borrador y el calendario es el interno de la app, que no está
// conectado a Instagram. Por eso no hace falta un sistema de permisos: no hay
// acción irreversible ni visible hacia fuera. Toda escritura queda auditada.

import { CalendarFormat, CalendarItem, FunnelLevel, Script, ScriptFormat } from '@/types';
import { Workspace, readFor, writeFor } from '../accounts';
import { uid } from '../db';

// ── Guiones ──────────────────────────────────────────────────
export async function saveScriptDraft(
  ws: Workspace,
  args: {
    title: string;
    hook: string;
    body: string;
    cta: string;
    format: ScriptFormat;
    justification: string;
  }
): Promise<{ saved: true; script_id: string; title: string; status: 'borrador' }> {
  const script: Script = {
    id: uid(),
    account_id: ws.id,
    title: args.title,
    hook: args.hook,
    body: args.body,
    cta: args.cta,
    format: args.format,
    source_ids: [],
    metrics_context: null,
    justification: args.justification,
    // Siempre borrador: aprobar es una decisión del usuario, no del agente.
    status: 'borrador',
    score: 0,
    created_at: new Date().toISOString(),
  };

  const scripts = await readFor<Script>(ws, 'scripts');
  scripts.unshift(script);
  await writeFor(ws, 'scripts', scripts);

  return { saved: true, script_id: script.id, title: script.title, status: 'borrador' };
}

// ── Calendario ───────────────────────────────────────────────
function inRange(iso: string, start: string, end: string) {
  const day = iso.slice(0, 10);
  return day >= start && day <= end;
}

export async function listCalendar(
  ws: Workspace,
  args: { range: { start: string; end: string } }
): Promise<{
  items: Pick<CalendarItem, 'id' | 'title' | 'format' | 'nivel' | 'scheduled_at' | 'status'>[];
  n: number;
  period: string;
}> {
  const items = (await readFor<CalendarItem>(ws, 'calendar_items'))
    .filter((i) => inRange(i.scheduled_at, args.range.start, args.range.end))
    .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))
    .map((i) => ({
      id: i.id,
      title: i.title,
      format: i.format,
      nivel: i.nivel ?? null,
      scheduled_at: i.scheduled_at,
      status: i.status,
    }));

  return {
    items,
    n: items.length,
    period: `${args.range.start}/${args.range.end}`,
  };
}

export async function scheduleCalendarItem(
  ws: Workspace,
  args: {
    title: string;
    format: CalendarFormat;
    scheduled_at: string;
    nivel?: FunnelLevel;
    notes?: string;
    script_id?: string;
    pillar?: string;
  }
): Promise<{ saved: true; item_id: string; title: string; scheduled_at: string }> {
  const item: CalendarItem = {
    id: uid(),
    account_id: ws.id,
    script_id: args.script_id ?? null,
    title: args.title,
    format: args.format,
    nivel: args.nivel ?? null,
    scheduled_at: args.scheduled_at,
    // Entra como idea: el agente propone la pieza, el usuario decide cuándo
    // pasa a producción.
    status: 'idea',
    notes: args.notes ?? '',
    // Pieza suelta: no viene de ningún plan aprobado en bloque.
    plan_id: null,
    pillar: args.pillar ?? null,
  };

  const items = await readFor<CalendarItem>(ws, 'calendar_items');
  items.push(item);
  await writeFor(ws, 'calendar_items', items);

  return { saved: true, item_id: item.id, title: item.title, scheduled_at: item.scheduled_at };
}

export async function moveCalendarItem(
  ws: Workspace,
  args: { item_id: string; scheduled_at: string }
): Promise<{ moved: true; item_id: string; from: string; to: string }> {
  const items = await readFor<CalendarItem>(ws, 'calendar_items');
  const item = items.find((i) => i.id === args.item_id);
  if (!item) {
    throw new Error(
      `No existe ninguna pieza con id "${args.item_id}". Llama a list_calendar primero para obtener los ids reales — no los inventes.`
    );
  }
  const from = item.scheduled_at;
  item.scheduled_at = args.scheduled_at;
  await writeFor(ws, 'calendar_items', items);
  return { moved: true, item_id: item.id, from, to: item.scheduled_at };
}
