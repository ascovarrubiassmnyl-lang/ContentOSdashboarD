// Log de auditoría mínimo (CONTENTOS_AGENTE_ARNES.md §7): una fila por cada
// tool call, suficiente para verificar que ninguna cifra del reporte o del
// chat salió sin respaldo — sin construir event-sourcing completo.

import { AuditLogEntry } from '@/types';
import { Workspace, readFor, writeFor } from '../accounts';

const AUDIT_KEY = 'agent_audit_log';

export async function logToolCall(
  ws: Workspace,
  entry: Omit<AuditLogEntry, 'created_at'>
): Promise<void> {
  const rows = await readFor<AuditLogEntry>(ws, AUDIT_KEY);
  rows.push({ ...entry, created_at: new Date().toISOString() });
  await writeFor(ws, AUDIT_KEY, rows);
}
