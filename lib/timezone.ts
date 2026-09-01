// Conversión entre "día + hora local + zona IANA" e ISO en UTC.
//
// Existe porque la estrategia de contenido declara franjas en hora LOCAL
// ("martes a las 18:00") y el calendario guarda ISO en UTC. Pedirle al modelo
// que calcule el offset es pedirle que se equivoque el día que cambie el
// horario de verano: el offset de una zona depende de la fecha concreta, no
// solo de la zona.
//
// Sin dependencias nuevas: se resuelve con Intl, que ya conoce las reglas de
// cada zona (incluido el cambio de horario) en el runtime de Node.

// Devuelve el offset de una zona, en minutos, PARA UN INSTANTE CONCRETO.
// Positivo al este de Greenwich (Madrid en verano = +120).
function offsetMinutesAt(utcDate: Date, timeZone: string): number {
  // Truco estándar: formatear el instante en la zona pedida, volver a leer
  // esos componentes como si fueran UTC, y medir la diferencia.
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = dtf.formatToParts(utcDate);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? '0');
  // `hour` puede venir como 24 con hour12:false en algunos runtimes.
  const hour = get('hour') % 24;
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), hour, get('minute'), get('second'));
  return Math.round((asUtc - utcDate.getTime()) / 60000);
}

export function isValidTimeZone(timeZone: string): boolean {
  if (!timeZone) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

export function assertTimeZone(timeZone: string): string {
  if (!isValidTimeZone(timeZone)) {
    throw new Error(
      `Zona horaria desconocida: "${timeZone}". Usa un identificador IANA como "America/Mexico_City" o "Europe/Madrid".`
    );
  }
  return timeZone;
}

// "2026-09-08" + "18:00" + "America/Mexico_City" → ISO en UTC.
//
// La primera estimación usa el offset del instante interpretado como UTC y
// luego se corrige con el offset real de ese momento local. La segunda pasada
// es lo que arregla las fechas que caen justo en un cambio de horario.
export function localToIso(date: string, time: string, timeZone: string): string {
  assertTimeZone(timeZone);
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  if (!y || !m || !d || Number.isNaN(hh) || Number.isNaN(mm)) {
    throw new Error(`Fecha u hora inválidas: "${date}" "${time}" (se esperaba YYYY-MM-DD y HH:MM).`);
  }
  const naive = Date.UTC(y, m - 1, d, hh, mm, 0, 0);
  let utc = naive - offsetMinutesAt(new Date(naive), timeZone) * 60000;
  utc = naive - offsetMinutesAt(new Date(utc), timeZone) * 60000;
  return new Date(utc).toISOString();
}

// La vuelta: qué día y hora local corresponden a un ISO.
export function isoToLocalParts(
  iso: string,
  timeZone: string
): { date: string; time: string; weekday: number } {
  assertTimeZone(timeZone);
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) throw new Error(`Fecha ISO inválida: "${iso}".`);
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
  });
  const parts = dtf.formatToParts(at);
  const val = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const weekdays: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const hour = String(Number(val('hour')) % 24).padStart(2, '0');
  return {
    date: `${val('year')}-${val('month')}-${val('day')}`,
    time: `${hour}:${val('minute')}`,
    weekday: weekdays[val('weekday')] ?? 0,
  };
}

// Lunes de la semana natural a la que pertenece una fecha (YYYY-MM-DD).
// La cobertura se calcula por semana natural porque es como se lee un
// calendario, no por ventanas móviles de 7 días.
export function weekStart(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const at = new Date(Date.UTC(y, m - 1, d));
  const dow = at.getUTCDay(); // 0 = domingo
  const backToMonday = dow === 0 ? 6 : dow - 1;
  at.setUTCDate(at.getUTCDate() - backToMonday);
  return at.toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const at = new Date(Date.UTC(y, m - 1, d));
  at.setUTCDate(at.getUTCDate() + days);
  return at.toISOString().slice(0, 10);
}

export const WEEKDAY_LABELS = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
];
