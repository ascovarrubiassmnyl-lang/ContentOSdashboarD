// success_definition — la métrica de éxito que el usuario configura por
// cuenta. Persistida, nunca re-decidida por el modelo turno a turno (ver
// CONTENTOS_AGENTE_ARNES.md §7 y §8 pregunta #3).

import { SuccessDefinition } from '@/types';
import { Workspace, readSingletonFor, writeSingletonFor } from '../accounts';

// Mismas claves que ya expone `comparison` en lib/reports.ts — así el default
// y cualquier configuración explícita hablan siempre del mismo vocabulario
// que el resto del dashboard.
export const SUCCESS_METRICS = [
  'reach',
  'views',
  'interactions',
  'saves',
  'followers_net',
  'link_taps',
] as const;
export type SuccessMetric = (typeof SUCCESS_METRICS)[number];

export const DEFAULT_SUCCESS_METRIC: SuccessMetric = 'reach';

const SETTINGS_KEY = 'agent_settings';

interface AgentSettings {
  success_definition?: SuccessDefinition;
}

export async function getSuccessDefinition(ws: Workspace): Promise<SuccessDefinition> {
  const settings = await readSingletonFor<AgentSettings>(ws, SETTINGS_KEY);
  if (settings?.success_definition) return settings.success_definition;
  // No configurada: default declarado explícitamente, no forzado. El
  // renderer del loop (lib/agent/loop.ts) es quien decide mostrar el aviso
  // de "asumiendo alcance porque no configuraste una métrica".
  return { metric: DEFAULT_SUCCESS_METRIC, configured: false };
}

export async function setSuccessDefinition(ws: Workspace, metric: SuccessMetric): Promise<void> {
  const settings = (await readSingletonFor<AgentSettings>(ws, SETTINGS_KEY)) ?? {};
  settings.success_definition = { metric, configured: true };
  await writeSingletonFor(ws, SETTINGS_KEY, settings);
}
