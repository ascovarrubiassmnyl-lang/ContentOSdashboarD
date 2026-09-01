// Playbook de arquetipos de calendario — la "base de conocimiento" del agente
// sobre cómo se estructura un calendario de contenido.
//
// Decisión #2 del plan de Fase 4: esto vive en el repo, no en un vector store.
// El corpus son unos pocos arquetipos que caben aquí, se revisan en un PR y
// viajan enteros al contexto. Un pipeline de embeddings añadiría
// infraestructura entera y, peor, haría no auditable de dónde salió cada
// recomendación.
//
// REGLA DURA: todo lo de este archivo es heurística DECLARADA. No es
// rendimiento medido de ninguna cuenta. La tool que lo sirve lo marca con
// `source: 'playbook'` y un caveat fijo que el modelo no puede quitar.

import { CalendarFormat, FunnelLevel } from '@/types';

export interface CalendarArchetype {
  id: string;
  name: string;
  fits: string; // a quién le sirve
  not_for: string; // cuándo NO usarlo — sin esto un arquetipo se aplica a todo
  weekly_targets: { format: CalendarFormat; per_week: number }[];
  funnel_mix: { tofu: number; mofu: number; bofu: number };
  suggested_slots: { weekday: number; time: string }[];
  pillars: string[];
  copy_note: string;
}

export const PLAYBOOK_CAVEAT =
  'Estos arquetipos son heurísticas de partida declaradas en el propio ContentOS, NO son rendimiento medido de esta cuenta ni de ninguna otra. Sirven para proponer una estructura cuando el usuario todavía no tiene una; en cuanto haya datos propios, mandan los datos propios. Dilo explícitamente cuando recomiendes uno.';

export const CALENDAR_ARCHETYPES: CalendarArchetype[] = [
  {
    id: 'educativo-b2b',
    name: 'Educativo B2B',
    fits: 'Consultoría, software, servicios profesionales. Audiencia que decide con criterio racional y ciclo de compra largo.',
    not_for: 'Cuentas de producto impulsivo o entretenimiento puro: el formato explicativo mata el alcance ahí.',
    weekly_targets: [
      { format: 'reel', per_week: 2 },
      { format: 'carrusel', per_week: 2 },
      { format: 'historia', per_week: 3 },
      { format: 'ad', per_week: 0 },
    ],
    funnel_mix: { tofu: 50, mofu: 35, bofu: 15 },
    suggested_slots: [
      { weekday: 2, time: '08:00' },
      { weekday: 3, time: '13:00' },
      { weekday: 4, time: '08:00' },
      { weekday: 5, time: '13:00' },
    ],
    pillars: ['Errores del sector', 'Caso o resultado', 'Marco/método propio', 'Detrás del proceso'],
    copy_note: 'Hook con la objeción o el error concreto; cierre con una pregunta que invite a comentar el caso propio.',
  },
  {
    id: 'marca-personal',
    name: 'Marca personal / creador',
    fits: 'Una persona construyendo autoridad. La cara y la voz son el activo.',
    not_for: 'Cuentas corporativas sin portavoz: sin cara identificable el formato pierde su ventaja.',
    weekly_targets: [
      { format: 'reel', per_week: 4 },
      { format: 'carrusel', per_week: 1 },
      { format: 'historia', per_week: 5 },
      { format: 'ad', per_week: 0 },
    ],
    funnel_mix: { tofu: 70, mofu: 20, bofu: 10 },
    suggested_slots: [
      { weekday: 1, time: '19:00' },
      { weekday: 2, time: '19:00' },
      { weekday: 4, time: '19:00' },
      { weekday: 6, time: '11:00' },
    ],
    pillars: ['Opinión con filo', 'Historia personal', 'Cómo lo hago yo', 'Respuesta a comentario'],
    copy_note: 'Primera persona, una idea por pieza. El CTA suele ser conversación, no venta.',
  },
  {
    id: 'ecommerce-producto',
    name: 'E-commerce / producto',
    fits: 'Catálogo con compra directa. El producto se puede mostrar en uso.',
    not_for: 'Servicios de ticket alto donde la decisión requiere confianza previa, no demostración.',
    weekly_targets: [
      { format: 'reel', per_week: 4 },
      { format: 'carrusel', per_week: 2 },
      { format: 'historia', per_week: 7 },
      { format: 'ad', per_week: 1 },
    ],
    funnel_mix: { tofu: 45, mofu: 30, bofu: 25 },
    suggested_slots: [
      { weekday: 1, time: '12:00' },
      { weekday: 3, time: '12:00' },
      { weekday: 5, time: '18:00' },
      { weekday: 0, time: '18:00' },
    ],
    pillars: ['Producto en uso', 'Antes y después', 'Reseña de cliente', 'Oferta / novedad'],
    copy_note: 'Beneficio concreto en los primeros 3 segundos; CTA explícito a comprar o guardar.',
  },
  {
    id: 'servicios-locales',
    name: 'Servicios locales',
    fits: 'Negocio con área geográfica: clínica, restaurante, taller, inmobiliaria.',
    not_for: 'Marcas nacionales sin anclaje local, donde la señal geográfica limita el alcance útil.',
    weekly_targets: [
      { format: 'reel', per_week: 3 },
      { format: 'carrusel', per_week: 1 },
      { format: 'historia', per_week: 5 },
      { format: 'ad', per_week: 1 },
    ],
    funnel_mix: { tofu: 45, mofu: 30, bofu: 25 },
    suggested_slots: [
      { weekday: 2, time: '09:00' },
      { weekday: 4, time: '14:00' },
      { weekday: 6, time: '10:00' },
    ],
    pillars: ['Cliente real', 'El equipo', 'Preguntas frecuentes', 'Referencia local'],
    copy_note: 'Nombrar la zona o el barrio en el copy; CTA a mensaje directo o reserva.',
  },
  {
    id: 'autoridad-lenta',
    name: 'Autoridad / bajo volumen',
    fits: 'Quien no puede sostener alta frecuencia y compite por profundidad, no por presencia.',
    not_for: 'Cuentas nuevas que todavía necesitan volumen para que el algoritmo entienda de qué van.',
    weekly_targets: [
      { format: 'reel', per_week: 1 },
      { format: 'carrusel', per_week: 1 },
      { format: 'historia', per_week: 2 },
      { format: 'ad', per_week: 0 },
    ],
    funnel_mix: { tofu: 40, mofu: 40, bofu: 20 },
    suggested_slots: [
      { weekday: 2, time: '09:00' },
      { weekday: 4, time: '09:00' },
    ],
    pillars: ['Análisis profundo', 'Tesis contraria', 'Datos propios'],
    copy_note: 'Pieza larga y trabajada. Mejor 2 excelentes que 6 tibias — el riesgo es desaparecer del feed.',
  },
  {
    id: 'lanzamiento',
    name: 'Semana de lanzamiento',
    fits: 'Ventana corta (1-2 semanas) alrededor de un lanzamiento o campaña concreta.',
    not_for: 'Operación sostenida: esta cadencia quema audiencia si se mantiene mes tras mes.',
    weekly_targets: [
      { format: 'reel', per_week: 5 },
      { format: 'carrusel', per_week: 3 },
      { format: 'historia', per_week: 10 },
      { format: 'ad', per_week: 2 },
    ],
    funnel_mix: { tofu: 30, mofu: 30, bofu: 40 },
    suggested_slots: [
      { weekday: 1, time: '09:00' },
      { weekday: 2, time: '09:00' },
      { weekday: 3, time: '09:00' },
      { weekday: 4, time: '09:00' },
      { weekday: 5, time: '09:00' },
    ],
    pillars: ['Cuenta atrás', 'Objeción resuelta', 'Prueba social', 'Cierre / urgencia'],
    copy_note: 'Cada pieza empuja a la misma acción. Repetir el mismo CTA es correcto aquí, no pereza.',
  },
];

export const FUNNEL_GUIDE: Record<FunnelLevel, string> = {
  tofu: 'Descubrimiento: llega a quien no te conoce. Se mide por alcance y compartidos, no por ventas.',
  mofu: 'Consideración: convence a quien ya te vio. Se mide por guardados, comentarios y seguidores nuevos.',
  bofu: 'Decisión: pide la acción. Se mide por mensajes, clics y ventas — casi nunca por alcance.',
};

export function getPlaybooks(archetypeId?: string) {
  const archetypes = archetypeId
    ? CALENDAR_ARCHETYPES.filter((a) => a.id === archetypeId)
    : CALENDAR_ARCHETYPES;
  return {
    source: 'playbook' as const,
    kind: 'declarado' as const,
    caveat: PLAYBOOK_CAVEAT,
    funnel_guide: FUNNEL_GUIDE,
    archetypes,
  };
}
