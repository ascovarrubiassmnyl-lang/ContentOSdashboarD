import { NextResponse } from 'next/server';
import { hasEncryptionKey } from '@/lib/crypto';
import { isAuthEnabled } from '@/lib/auth';
import { isDbConfigured } from '@/lib/pg';

// Healthcheck para el despliegue (Railway lo consulta al arrancar).
// A propósito NO toca la base de datos: un healthcheck que escribe puede
// dejar datos a medias si el contenedor se reinicia en bucle. Solo informa
// de qué integraciones están configuradas, nunca de sus valores.
export function GET() {
  return NextResponse.json({
    ok: true,
    at: new Date().toISOString(),
    config: {
      db: isDbConfigured(),
      zernio: Boolean(process.env.ZERNIO_API_KEY),
      encryption: hasEncryptionKey(),
      claude: Boolean(process.env.ANTHROPIC_API_KEY),
      cron: Boolean(process.env.CRON_SECRET),
      auth: isAuthEnabled(),
    },
  });
}
