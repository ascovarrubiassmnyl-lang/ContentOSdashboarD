// Contrato del proveedor de videos individuales.
//
// Hermano de CompetitorProvider (lib/competitors/types.ts) y con la misma
// regla dura: leer un post ajeno es observar desde fuera, no medir. Lo que se
// ve son las cifras que Instagram publica; el alcance, los guardados y si
// llevaba pauta no se ven nunca.

export interface VideoObservation {
  url: string;
  // Quién lo publicó, sin @. Puede faltar si el proveedor no lo expone.
  author: string | null;
  caption: string | null;
  posted_at: string | null; // ISO
  media_type: string | null; // "Video" | "Image" | "Sidecar" según el proveedor
  duration_seconds: number | null;
  likes: number | null;
  comments: number | null;
  // Reproducciones que el post muestra públicamente. NO es alcance: cuenta
  // repeticiones y no distingue cuentas únicas.
  plays: number | null;
}

export interface VideoProvider {
  readonly name: string;
  /**
   * Lee un post público a partir de su URL.
   *
   * Contrato explícito: si no se puede leer, LANZA con un mensaje que diga
   * por qué. Nunca devuelve ceros ni un objeto vacío "por si acaso" — en la
   * Fase 1 ya se vio que un dato vacío con pinta de real acaba redactado como
   * hallazgo ("el alcance se mantuvo estable en 0").
   */
  fetchVideo(url: string): Promise<VideoObservation>;
}
