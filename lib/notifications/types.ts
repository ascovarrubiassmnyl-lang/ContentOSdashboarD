// Tipos del sistema de notificaciones (Fase 5).

export type NotificationKind = 'calendar_reminder' | 'agent_activity' | 'system_alert';

export interface AppNotification {
  id: string;
  account_id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  url: string;
  // Clave de deduplicación: impide que el tick del cron reenvíe el mismo aviso
  // cada 15 minutos. Sin esto, "faltan 2 horas" se dispara 8 veces y el
  // usuario apaga las notificaciones para siempre.
  dedupe_key: string;
  created_at: string;
  read_at: string | null;
}

export interface NotificationPreferences {
  user_id: string;
  kinds: Record<NotificationKind, boolean>;
  // Cuántos minutos antes de la hora programada avisar de una pieza.
  reminder_lead_minutes: number;
  // Ventana en la que NO se envía push (el aviso igual queda en el historial).
  quiet_hours: { start: string; end: string } | null; // "HH:MM" local
  timezone: string;
}

export const DEFAULT_PREFERENCES: Omit<NotificationPreferences, 'user_id'> = {
  kinds: {
    calendar_reminder: true,
    agent_activity: true,
    system_alert: true,
  },
  reminder_lead_minutes: 120,
  quiet_hours: { start: '22:00', end: '07:30' },
  timezone: 'America/Mexico_City',
};

export const KIND_LABELS: Record<NotificationKind, string> = {
  calendar_reminder: 'Recordatorios de calendario',
  agent_activity: 'Actividad del agente',
  system_alert: 'Alertas del sistema',
};
