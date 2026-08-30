// Contrato del proveedor de datos de competencia.
//
// Existe como interfaz a propósito: Instagram bloquea el scraping sin sesión y
// cambia sus endpoints sin aviso, así que el proveedor por defecto se va a
// romper — es cuestión de cuándo, no de si. Cuando pase, se escribe otro
// proveedor y se cambia COMPETITOR_PROVIDER, sin tocar el almacén, el cron, la
// tool del agente ni la UI.

export interface CompetitorObservation {
  followers: number | null;
  posts_count: number | null;
  avg_likes: number | null;
  avg_comments: number | null;
  // Cuántas publicaciones se pudieron ver para calcular las medias. Es el `n`
  // de esta observación: 0 significa que no se vio ninguna, no que valgan 0.
  sample_size: number;
}

export interface CompetitorProvider {
  readonly name: string;
  /**
   * Devuelve lo observado de un perfil público.
   *
   * Contrato explícito: si no se puede leer el perfil, LANZA. Nunca devuelve
   * ceros ni nulls "por si acaso" — durante la Fase 1 ya se vio que un dato
   * vacío que parece real acaba redactado como hallazgo ("el alcance se
   * mantuvo estable en 0"). Un fallo tiene que verse como fallo.
   */
  fetchProfile(username: string): Promise<CompetitorObservation>;
}
