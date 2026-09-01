// Planificación en bloque: el agente PROPONE un calendario completo, el
// usuario lo aprueba de un clic, y el código lo aterriza.
//
// Decisión #3 del plan de Fase 4: `draftCalendarPlan` escribe en
// `calendar_plans`, JAMÁS en `calendar_items`. Aplicar es una acción del
// usuario contra una ruta HTTP, no una interpretación del modelo de que dijo
// que sí. Y así 12 piezas se escriben en una operación atómica en vez de en 12
// tool calls que pueden fallar a la mitad dejando medio calendario escrito.

import {
  CalendarCoverage,
  CalendarFormat,
  CalendarItem,
  CalendarPlan,
  CalendarPlanItem,
  FunnelLevel,
  PlanDeviation,
} from '@/types';
import { Workspace, readFor, writeFor } from '../accounts';
import { uid } from '../db';
import { addDays, isoToLocalParts, localToIso, weekStart, WEEKDAY_LABELS } from '../timezone';
import { getContentStrategy } from './content-strategy';

// Tope por plan: un mes de operación intensa cabe de sobra. Más que esto es
// casi siempre un modelo en bucle, y aplicar 200 piezas por error es un
// desastre que el usuario tendría que limpiar a mano.
export const MAX_PLAN_ITEMS = 60;
// Historial de planes por cuenta.
export const MAX_PLANS = 20;

export interface DraftPlanInput {
  range: { start: string; end: string };
  rationale: string;
  items: {
    title: string;
    format: CalendarFormat;
    date: string; // YYYY-MM-DD, en la zona de la estrategia
    time?: string; // HH:MM local; si falta, se toma de la franja del día
    nivel?: FunnelLevel;
    pillar?: string;
    notes?: string;
    script_id?: string;
  }[];
}

async function readPlans(ws: Workspace): Promise<CalendarPlan[]> {
  return readFor<CalendarPlan>(ws, 'calendar_plans');
}

async function writePlans(ws: Workspace, plans: CalendarPlan[]): Promise<void> {
  // Se conservan los últimos MAX_PLANS por fecha de creación: el historial de
  // qué se planeó es útil, pero no a costa de que la colección crezca sin fin.
  const trimmed = [...plans]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, MAX_PLANS);
  await writeFor(ws, 'calendar_plans', trimmed);
}

// ── Propuesta ────────────────────────────────────────────────
export async function draftCalendarPlan(
  ws: Workspace,
  input: DraftPlanInput
): Promise<{
  plan_id: string;
  status: 'propuesto';
  pending_user_approval: true;
  range: { start: string; end: string };
  items: CalendarPlanItem[];
  deviations: PlanDeviation[];
  note: string;
}> {
  const strategy = await getContentStrategy(ws);
  const tz = strategy.timezone;

  if (input.items.length === 0) {
    throw new Error('Un plan necesita al menos una pieza. No propongas un plan vacío.');
  }
  if (input.items.length > MAX_PLAN_ITEMS) {
    throw new Error(
      `Un plan no puede tener más de ${MAX_PLAN_ITEMS} piezas (llegaron ${input.items.length}). Propón un rango más corto.`
    );
  }

  // Hoy en la zona del usuario: comparar contra UTC adelantaría o atrasaría el
  // corte según el huso y rechazaría piezas de hoy por "pasadas".
  const todayLocal = isoToLocalParts(new Date().toISOString(), tz).date;

  const slotsByWeekday = new Map<number, string[]>();
  for (const s of strategy.slots) {
    slotsByWeekday.set(s.weekday, [...(slotsByWeekday.get(s.weekday) ?? []), s.time]);
  }

  const taken = new Set<string>();
  // Las piezas ya programadas también ocupan franja: si no se miran, el plan
  // encima de un calendario existente duplica horarios.
  const existing = await readFor<CalendarItem>(ws, 'calendar_items');
  for (const item of existing) {
    try {
      const parts = isoToLocalParts(item.scheduled_at, tz);
      taken.add(`${parts.date} ${parts.time}`);
    } catch {
      // fecha corrupta en una pieza vieja: no debe tumbar la planificación
    }
  }

  const items: CalendarPlanItem[] = [];
  for (const [index, raw] of input.items.entries()) {
    const where = `pieza ${index + 1} ("${raw.title}")`;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw.date)) {
      throw new Error(`${where}: "date" debe ser YYYY-MM-DD, llegó "${raw.date}".`);
    }
    if (raw.date < input.range.start || raw.date > input.range.end) {
      throw new Error(
        `${where}: la fecha ${raw.date} cae fuera del rango del plan (${input.range.start} a ${input.range.end}).`
      );
    }
    if (raw.date < todayLocal) {
      throw new Error(
        `${where}: ${raw.date} ya pasó (hoy es ${todayLocal} en ${tz}). Programa a futuro — una pieza con fecha pasada se borra sola a las 24 h.`
      );
    }

    // Hora: la que venga, o la franja declarada de ese día de la semana, o
    // mediodía como último recurso declarado.
    let time = raw.time;
    if (time && !/^\d{2}:\d{2}$/.test(time)) {
      throw new Error(`${where}: "time" debe ser HH:MM en 24 h, llegó "${time}".`);
    }
    if (!time) {
      const weekday = isoToLocalParts(localToIso(raw.date, '12:00', tz), tz).weekday;
      const candidates = slotsByWeekday.get(weekday) ?? [];
      time = candidates.find((t) => !taken.has(`${raw.date} ${t}`)) ?? candidates[0] ?? '12:00';
    }

    const key = `${raw.date} ${time}`;
    if (taken.has(key)) {
      throw new Error(
        `${where}: ya hay una pieza a las ${time} del ${raw.date}. Usa otra hora o mueve la pieza a otro día — no apiles dos publicaciones en la misma franja.`
      );
    }
    taken.add(key);

    items.push({
      title: raw.title.trim(),
      format: raw.format,
      nivel: raw.nivel ?? null,
      pillar: raw.pillar?.trim() || null,
      scheduled_at: localToIso(raw.date, time, tz),
      notes: raw.notes?.trim() ?? '',
      script_id: raw.script_id ?? null,
    });
  }

  items.sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));

  const plan: CalendarPlan = {
    id: uid(),
    account_id: ws.id,
    status: 'propuesto',
    range: { start: input.range.start, end: input.range.end },
    rationale: input.rationale.trim(),
    items,
    deviations: computeDeviations(items, strategy, tz),
    created_at: new Date().toISOString(),
    applied_at: null,
  };

  const plans = await readPlans(ws);
  await writePlans(ws, [...plans, plan]);

  return {
    plan_id: plan.id,
    status: 'propuesto',
    pending_user_approval: true,
    range: plan.range,
    items: plan.items,
    deviations: plan.deviations,
    note: 'El plan quedó PROPUESTO: todavía no hay ninguna pieza en el calendario. El usuario tiene que aprobarlo con el botón "Aplicar al calendario" que aparece bajo tu respuesta. Dile eso explícitamente.',
  };
}

// Los desvíos NO son errores (Decisión #4): una semana de lanzamiento se sale
// de la cadencia a propósito. Se informan y decide el usuario.
function computeDeviations(
  items: CalendarPlanItem[],
  strategy: Awaited<ReturnType<typeof getContentStrategy>>,
  tz: string
): PlanDeviation[] {
  const out: PlanDeviation[] = [];
  if (!strategy.configured) return out;

  const byWeek = new Map<string, CalendarPlanItem[]>();
  for (const item of items) {
    const week = weekStart(isoToLocalParts(item.scheduled_at, tz).date);
    byWeek.set(week, [...(byWeek.get(week) ?? []), item]);
  }

  for (const [week, weekItems] of [...byWeek.entries()].sort()) {
    for (const target of strategy.weekly_targets) {
      const count = weekItems.filter((i) => i.format === target.format).length;
      if (count !== target.per_week && (count > 0 || target.per_week > 0)) {
        out.push({
          kind: 'cadencia',
          detail: `Semana del ${week}: ${count} ${target.format}${count === 1 ? '' : 's'} frente a ${target.per_week} declarado${target.per_week === 1 ? '' : 's'}.`,
        });
      }
    }
  }

  const withLevel = items.filter((i) => i.nivel);
  if (withLevel.length > 0) {
    const pct = (level: FunnelLevel) =>
      Math.round((withLevel.filter((i) => i.nivel === level).length / withLevel.length) * 100);
    const real = { tofu: pct('tofu'), mofu: pct('mofu'), bofu: pct('bofu') };
    // Umbral de 15 puntos: por debajo de eso, la diferencia es ruido de
    // redondeo en planes de pocas piezas, no una decisión que merezca aviso.
    for (const level of ['tofu', 'mofu', 'bofu'] as const) {
      const diff = Math.abs(real[level] - strategy.funnel_mix[level]);
      if (diff >= 15) {
        out.push({
          kind: 'funnel',
          detail: `${level.toUpperCase()}: ${real[level]}% del plan frente al ${strategy.funnel_mix[level]}% declarado.`,
        });
      }
    }
  }

  if (strategy.pillars.length > 0) {
    const known = new Set(strategy.pillars.map((p) => p.name.toLowerCase()));
    const unknown = [
      ...new Set(
        items
          .map((i) => i.pillar)
          .filter((p): p is string => !!p && !known.has(p.toLowerCase()))
      ),
    ];
    if (unknown.length > 0) {
      out.push({
        kind: 'pilar',
        detail: `Pilares que no están en tu estrategia: ${unknown.join(', ')}.`,
      });
    }
  }

  return out;
}

// ── Consulta ─────────────────────────────────────────────────
export async function listPlans(
  ws: Workspace,
  status?: CalendarPlan['status']
): Promise<CalendarPlan[]> {
  const plans = await readPlans(ws);
  return plans
    .filter((p) => !status || p.status === status)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function getPlan(ws: Workspace, id: string): Promise<CalendarPlan | null> {
  return (await readPlans(ws)).find((p) => p.id === id) ?? null;
}

// ── Aplicación ───────────────────────────────────────────────
export async function applyPlan(
  ws: Workspace,
  id: string
): Promise<{ applied: true; plan_id: string; created: number }> {
  const plans = await readPlans(ws);
  const plan = plans.find((p) => p.id === id);
  if (!plan) throw new Error('Ese plan no existe.');
  if (plan.status === 'aplicado') throw new Error('Ese plan ya se aplicó al calendario.');
  if (plan.status === 'descartado') throw new Error('Ese plan fue descartado.');

  const items = await readFor<CalendarItem>(ws, 'calendar_items');
  for (const source of plan.items) {
    items.push({
      id: uid(),
      account_id: ws.id,
      script_id: source.script_id,
      title: source.title,
      format: source.format,
      nivel: source.nivel,
      scheduled_at: source.scheduled_at,
      // Entra como idea, igual que schedule_calendar_item: aprobar el plan es
      // aceptar la propuesta, no declarar el contenido listo para publicar.
      status: 'idea',
      notes: source.notes,
      plan_id: plan.id,
      pillar: source.pillar,
    });
  }
  await writeFor(ws, 'calendar_items', items);

  plan.status = 'aplicado';
  plan.applied_at = new Date().toISOString();
  await writePlans(ws, plans);

  return { applied: true, plan_id: plan.id, created: plan.items.length };
}

// Descarta un plan propuesto, o deshace uno aplicado borrando EXACTAMENTE las
// piezas que creó (Decisión #7): sin deshacer, el primer plan que no guste
// obliga a limpiar 12 piezas a mano y el usuario no vuelve a pulsar el botón.
export async function discardPlan(
  ws: Workspace,
  id: string
): Promise<{ discarded: true; removed_items: number }> {
  const plans = await readPlans(ws);
  const plan = plans.find((p) => p.id === id);
  if (!plan) throw new Error('Ese plan no existe.');

  let removed = 0;
  if (plan.status === 'aplicado') {
    const items = await readFor<CalendarItem>(ws, 'calendar_items');
    const kept = items.filter((i) => i.plan_id !== plan.id);
    removed = items.length - kept.length;
    await writeFor(ws, 'calendar_items', kept);
  }

  plan.status = 'descartado';
  plan.applied_at = null;
  await writePlans(ws, plans);
  return { discarded: true, removed_items: removed };
}

// ── Cobertura ────────────────────────────────────────────────
// Lo declarado contra lo realmente programado. Es lo que le permite al agente
// decir "te faltan 2 reels esta semana" sin inventarse la cuenta.
export async function getCalendarCoverage(
  ws: Workspace,
  range: { start: string; end: string }
): Promise<CalendarCoverage> {
  const strategy = await getContentStrategy(ws);
  const tz = strategy.timezone;
  const items = await readFor<CalendarItem>(ws, 'calendar_items');

  const inRange = items.filter((i) => {
    try {
      const day = isoToLocalParts(i.scheduled_at, tz).date;
      return day >= range.start && day <= range.end;
    } catch {
      return false;
    }
  });

  const byWeek = new Map<string, CalendarItem[]>();
  // Se siembran todas las semanas del rango, también las vacías: una semana
  // sin nada programado es justo la que hay que ver.
  for (let day = weekStart(range.start); day <= range.end; day = addDays(day, 7)) {
    byWeek.set(day, []);
  }
  for (const item of inRange) {
    const week = weekStart(isoToLocalParts(item.scheduled_at, tz).date);
    byWeek.set(week, [...(byWeek.get(week) ?? []), item]);
  }

  const weeks = [...byWeek.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week_start, weekItems]) => ({
      week_start,
      by_format: strategy.weekly_targets.map((t) => {
        const scheduled = weekItems.filter((i) => i.format === t.format).length;
        return {
          format: t.format,
          scheduled,
          target: t.per_week,
          gap: t.per_week - scheduled,
        };
      }),
      funnel: {
        tofu: weekItems.filter((i) => i.nivel === 'tofu').length,
        mofu: weekItems.filter((i) => i.nivel === 'mofu').length,
        bofu: weekItems.filter((i) => i.nivel === 'bofu').length,
        sin_nivel: weekItems.filter((i) => !i.nivel).length,
      },
      total_scheduled: weekItems.length,
    }));

  return { timezone: tz, configured: strategy.configured, weeks };
}

export { WEEKDAY_LABELS };
