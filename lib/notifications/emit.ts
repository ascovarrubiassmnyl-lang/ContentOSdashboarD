// Punto ÚNICO de emisión de notificaciones (Decisión #2 del plan de Fase 5).
//
// Todo —recordatorios, actividad del agente, alertas— pasa por aquí, que
// graba en el historial Y envía el push. Si fueran caminos separados, el panel
// de la app y el teléfono acabarían contando historias distintas, y el usuario
// creería la que le contradiga.

import { Workspace } from '../accounts';
import { sendToUser } from '../push/send';
import { isoToLocalParts } from '../timezone';
import { createNotification, getPreferences, hasDedupeKey } from './store';
import { NotificationKind } from './types';

export interface EmitInput {
  ws: Workspace;
  kind: NotificationKind;
  title: string;
  body: string;
  url: string;
  dedupeKey: string;
}

export interface EmitResult {
  emitted: boolean;
  reason?: string;
  pushed?: number;
}

// ¿Estamos dentro de las horas de silencio? Soporta ventanas que cruzan la
// medianoche (22:00 → 07:30), que es el caso normal.
function inQuietHours(nowLocal: string, quiet: { start: string; end: string }): boolean {
  if (quiet.start === quiet.end) return false;
  if (quiet.start < quiet.end) return nowLocal >= quiet.start && nowLocal < quiet.end;
  return nowLocal >= quiet.start || nowLocal < quiet.end;
}

export async function emitNotification(input: EmitInput): Promise<EmitResult> {
  const { ws, kind, title, body, url, dedupeKey } = input;

  if (await hasDedupeKey(ws, dedupeKey)) {
    return { emitted: false, reason: 'ya se notificó (dedupe)' };
  }

  // El dueño de la cuenta es quien recibe. Una cuenta sin dueño (datos previos
  // al login multiusuario) no es de nadie: se registra en el historial pero no
  // se manda push a ningún lado.
  const userId = ws.owner_user_id;
  await createNotification(ws, { kind, title, body, url, dedupeKey });

  if (!userId) return { emitted: true, reason: 'la cuenta no tiene dueño: solo historial' };

  const prefs = await getPreferences(userId);
  if (!prefs.kinds[kind]) {
    return { emitted: true, reason: 'el usuario desactivó este tipo: solo historial' };
  }

  // Las horas de silencio se aplican en el SERVIDOR: decidirlo en el cliente
  // sería tarde, el teléfono ya sonó.
  if (prefs.quiet_hours) {
    const nowLocal = isoToLocalParts(new Date().toISOString(), prefs.timezone).time;
    if (inQuietHours(nowLocal, prefs.quiet_hours)) {
      return { emitted: true, reason: 'horas de silencio: solo historial' };
    }
  }

  const result = await sendToUser(userId, {
    title,
    body,
    url,
    // El tag colapsa avisos repetidos del mismo asunto en la bandeja del
    // sistema en vez de apilar cinco tarjetas iguales.
    tag: dedupeKey,
    kind,
  });

  return { emitted: true, pushed: result.sent, reason: result.skipped_reason };
}
