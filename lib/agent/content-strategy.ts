// content_strategy — la estructura de calendario que el usuario DECLARA.
//
// Es el gemelo declarativo de voice-profile.ts: aquel mide lo que la cuenta ya
// hizo, este guarda lo que el usuario quiere hacer. Son dos clases de dato
// distintas y el código las mantiene separadas a propósito (Decisión #1 del
// plan de Fase 4): la estrategia NUNCA es evidencia de rendimiento.
//
// Se persiste en la misma clave `agent_settings` que success_definition, con
// el mismo patrón de `configured: boolean` — así "no lo configuró" y "eligió
// justo esto" nunca se confunden.

import { CalendarFormat, ContentStrategy, StrategySlot } from '@/types';
import { Workspace, readSingletonFor, writeSingletonFor } from '../accounts';
import { isValidTimeZone, WEEKDAY_LABELS } from '../timezone';

const SETTINGS_KEY = 'agent_settings';

interface AgentSettings {
  content_strategy?: ContentStrategy;
  [key: string]: unknown;
}

export const CALENDAR_FORMATS: CalendarFormat[] = ['reel', 'carrusel', 'historia', 'ad'];

// Topes: la estrategia entra en cada system prompt. Sin límites, crece hasta
// encarecer todos los turnos y diluir lo importante.
export const MAX_SLOTS = 14;
export const MAX_PILLARS = 8;

export const DEFAULT_TIMEZONE = 'America/Mexico_City';

// Default DECLARADO, no impuesto: si el usuario no configuró nada, el agente
// usa esto y tiene la obligación (por prompt) de decir que es un supuesto.
export function defaultStrategy(): ContentStrategy {
  return {
    configured: false,
    timezone: DEFAULT_TIMEZONE,
    weekly_targets: [
      { format: 'reel', per_week: 3 },
      { format: 'carrusel', per_week: 1 },
      { format: 'historia', per_week: 0 },
      { format: 'ad', per_week: 0 },
    ],
    funnel_mix: { tofu: 60, mofu: 30, bofu: 10 },
    slots: [
      { weekday: 2, time: '09:00' },
      { weekday: 4, time: '09:00' },
      { weekday: 6, time: '11:00' },
    ],
    pillars: [],
    copy_rules: {
      tone: '',
      cta_style: '',
      caption_length: 'media',
      avoid: [],
    },
    notes: '',
    updated_at: null,
  };
}

export async function getContentStrategy(ws: Workspace): Promise<ContentStrategy> {
  const settings = await readSingletonFor<AgentSettings>(ws, SETTINGS_KEY);
  const stored = settings?.content_strategy;
  if (!stored) return defaultStrategy();
  // Se normaliza al leer, no solo al escribir: datos guardados por una versión
  // anterior del formulario no deben poder romper el cálculo de cobertura.
  return normalizeStrategy({ ...stored, configured: true });
}

export interface StrategyInput {
  timezone?: string;
  weekly_targets?: { format: CalendarFormat; per_week: number }[];
  funnel_mix?: { tofu: number; mofu: number; bofu: number };
  slots?: StrategySlot[];
  pillars?: { name: string; description?: string }[];
  copy_rules?: Partial<ContentStrategy['copy_rules']>;
  notes?: string;
}

// El input es deliberadamente laxo: llega tanto del formulario (campos
// completos) como de un `agent_settings` guardado por una versión anterior.
// Normalizar al leer y al escribir es lo que evita que un dato viejo rompa el
// cálculo de cobertura.
export function normalizeStrategy(
  input: StrategyInput & { configured?: boolean; updated_at?: string | null }
): ContentStrategy {
  const base = defaultStrategy();

  const timezone =
    input.timezone && isValidTimeZone(input.timezone) ? input.timezone : base.timezone;

  // Un objetivo por formato, sin duplicados y sin formatos inventados. Se
  // parte del default para que un guardado parcial (sin `weekly_targets`) no
  // ponga toda la cadencia a cero en silencio.
  const targetMap = new Map<CalendarFormat, number>(
    base.weekly_targets.map((t) => [t.format, t.per_week])
  );
  for (const t of input.weekly_targets ?? []) {
    if (!CALENDAR_FORMATS.includes(t.format)) continue;
    const n = Math.max(0, Math.min(21, Math.round(Number(t.per_week) || 0)));
    targetMap.set(t.format, n);
  }
  const weekly_targets = CALENDAR_FORMATS.map((format) => ({
    format,
    per_week: targetMap.get(format) ?? 0,
  }));

  // La mezcla se normaliza a 100 en código: un formulario que suma 97 no debe
  // producir una cobertura que miente por 3 puntos.
  const rawMix = input.funnel_mix ?? base.funnel_mix;
  const mixTotal = Math.max(0, rawMix.tofu) + Math.max(0, rawMix.mofu) + Math.max(0, rawMix.bofu);
  const funnel_mix =
    mixTotal === 0
      ? base.funnel_mix
      : {
          tofu: Math.round((Math.max(0, rawMix.tofu) / mixTotal) * 100),
          mofu: Math.round((Math.max(0, rawMix.mofu) / mixTotal) * 100),
          bofu: Math.round((Math.max(0, rawMix.bofu) / mixTotal) * 100),
        };
  // El redondeo puede dejar 99 o 101; se ajusta sobre el mayor.
  const mixSum = funnel_mix.tofu + funnel_mix.mofu + funnel_mix.bofu;
  if (mixSum !== 100) {
    const biggest = (['tofu', 'mofu', 'bofu'] as const).reduce((a, b) =>
      funnel_mix[a] >= funnel_mix[b] ? a : b
    );
    funnel_mix[biggest] += 100 - mixSum;
  }

  const seenSlots = new Set<string>();
  const slots = (input.slots ?? base.slots)
    .filter((s) => {
      const weekday = Number(s.weekday);
      if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) return false;
      if (!/^\d{2}:\d{2}$/.test(s.time)) return false;
      const key = `${weekday}-${s.time}`;
      if (seenSlots.has(key)) return false;
      seenSlots.add(key);
      return true;
    })
    .map((s) => ({ weekday: Number(s.weekday), time: s.time }))
    .sort((a, b) => a.weekday - b.weekday || a.time.localeCompare(b.time))
    .slice(0, MAX_SLOTS);

  const pillars = (input.pillars ?? [])
    .map((p) => ({ name: (p.name ?? '').trim(), description: (p.description ?? '').trim() }))
    .filter((p) => p.name.length > 0)
    .slice(0, MAX_PILLARS);

  const copy = { ...base.copy_rules, ...(input.copy_rules ?? {}) };
  const copy_rules = {
    tone: (copy.tone ?? '').trim().slice(0, 300),
    cta_style: (copy.cta_style ?? '').trim().slice(0, 300),
    caption_length: (['corta', 'media', 'larga'] as const).includes(
      copy.caption_length as 'corta' | 'media' | 'larga'
    )
      ? (copy.caption_length as 'corta' | 'media' | 'larga')
      : 'media',
    avoid: (copy.avoid ?? [])
      .map((a) => String(a).trim())
      .filter(Boolean)
      .slice(0, 12),
  };

  return {
    configured: input.configured ?? false,
    timezone,
    weekly_targets,
    funnel_mix,
    slots,
    pillars,
    copy_rules,
    notes: (input.notes ?? '').trim().slice(0, 1000),
    updated_at: input.updated_at ?? null,
  };
}

export async function setContentStrategy(
  ws: Workspace,
  input: StrategyInput
): Promise<ContentStrategy> {
  const strategy = normalizeStrategy({
    ...input,
    configured: true,
    updated_at: new Date().toISOString(),
  });
  const settings = (await readSingletonFor<AgentSettings>(ws, SETTINGS_KEY)) ?? {};
  settings.content_strategy = strategy;
  await writeSingletonFor(ws, SETTINGS_KEY, settings);
  return strategy;
}

// Cuántas piezas por semana suma la cadencia declarada. Lo usa el agente para
// hablar de frecuencia sin tener que sumarlo él (y equivocarse).
export function weeklyTotal(strategy: ContentStrategy): number {
  return strategy.weekly_targets.reduce((a, t) => a + t.per_week, 0);
}

// Bloque compacto para el system prompt. Vacío si no está configurada: una
// sección que dice "no hay nada" solo gasta tokens, y el prompt ya tiene una
// regla para el caso sin configurar.
export async function contentStrategyPromptBlock(ws: Workspace): Promise<string> {
  const s = await getContentStrategy(ws);
  if (!s.configured) return '';

  const cadence = s.weekly_targets
    .filter((t) => t.per_week > 0)
    .map((t) => `${t.per_week} ${t.format}${t.per_week === 1 ? '' : 's'}`)
    .join(', ');
  const slots = s.slots.map((x) => `${WEEKDAY_LABELS[x.weekday]} ${x.time}`).join(', ');
  const pillars = s.pillars.map((p) => p.name).join(', ');

  const lines = [
    `- Cadencia declarada: ${cadence || 'sin piezas declaradas'} por semana (total ${weeklyTotal(s)}).`,
    `- Mezcla de funnel objetivo: TOFU ${s.funnel_mix.tofu}% / MOFU ${s.funnel_mix.mofu}% / BOFU ${s.funnel_mix.bofu}%.`,
    `- Franjas preferidas (${s.timezone}): ${slots || 'sin franjas definidas'}.`,
  ];
  if (pillars) lines.push(`- Pilares de contenido: ${pillars}.`);
  if (s.copy_rules.tone) lines.push(`- Tono declarado: ${s.copy_rules.tone}.`);
  if (s.copy_rules.cta_style) lines.push(`- Estilo de CTA: ${s.copy_rules.cta_style}.`);
  lines.push(`- Longitud de caption preferida: ${s.copy_rules.caption_length}.`);
  if (s.copy_rules.avoid.length) lines.push(`- Evitar siempre: ${s.copy_rules.avoid.join(', ')}.`);
  if (s.notes) lines.push(`- Notas del usuario: ${s.notes}`);

  return `\n\nEstructura de calendario que el usuario DECLARÓ (es lo que quiere hacer, NO evidencia de que funcione — nunca la cites como respaldo de una afirmación de rendimiento):\n${lines.join('\n')}`;
}
