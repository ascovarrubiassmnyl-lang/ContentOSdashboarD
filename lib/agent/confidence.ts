// Capa 1 del contrato de confianza estadística (ver CONTENTOS_AGENTE_ARNES.md
// §5 y planes/2026-08-29-agente-os-fase1-arnes.md). El tamaño de muestra `n`
// y su clasificación los calcula SIEMPRE código, nunca el modelo — así una
// instrucción de prompt que falla el 10% de las veces no puede colar una
// cifra sin respaldo como si fuera sólida.

import { ConfidenceTier } from '@/types';

// Provisional: umbrales de sentido común, no estadísticamente rigurosos.
// Recalibrar contra el volumen real de posts/mes de las cuentas piloto —
// ver "Preguntas Abiertas" en planes/2026-08-29-agente-os-fase1-arnes.md.
export const CONFIDENCE_THRESHOLDS = {
  insuficiente: 10, // n < 10
  debil: 30, // 10 <= n < 30 ; n >= 30 => razonable
} as const;

export function confidenceTier(n: number): ConfidenceTier {
  if (n < CONFIDENCE_THRESHOLDS.insuficiente) return 'insuficiente';
  if (n < CONFIDENCE_THRESHOLDS.debil) return 'debil';
  return 'razonable';
}

// Disclaimer que un paso de código —nunca el modelo— inserta en el Markdown
// final cuando la confianza no es "razonable". `null` cuando no hace falta.
export function confidenceDisclaimer(tier: ConfidenceTier, n: number): string | null {
  if (tier === 'razonable') return null;
  if (tier === 'insuficiente') {
    return `⚠️ Basado en solo ${n} post${n === 1 ? '' : 's'} — muestra insuficiente, trátalo como una hipótesis a validar, no como una conclusión.`;
  }
  return `⚠️ Basado en ${n} posts — señal débil todavía, trátalo como hipótesis, no como regla.`;
}
