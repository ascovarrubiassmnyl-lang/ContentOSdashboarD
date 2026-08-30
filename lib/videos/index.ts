// Registro de proveedores de video. Mismo patrón que
// lib/competitors/refresh.ts: cambiar de fuente es una variable de entorno,
// no un refactor.

import { apifyVideoProvider } from './apify';
import { VideoProvider } from './types';

const PROVIDERS: Record<string, VideoProvider> = {
  apify: apifyVideoProvider,
};

export function activeVideoProvider(): VideoProvider {
  const name = process.env.VIDEO_PROVIDER || 'apify';
  const provider = PROVIDERS[name];
  if (!provider) {
    throw new Error(
      `VIDEO_PROVIDER="${name}" no existe. Disponibles: ${Object.keys(PROVIDERS).join(', ')}.`
    );
  }
  return provider;
}

export type { VideoObservation, VideoProvider } from './types';
