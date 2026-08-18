import { NextResponse } from 'next/server';
import { hasEncryptionKey } from '@/lib/crypto';

// Healthcheck para el despliegue (Railway lo consulta al arrancar).
// A propósito NO toca la base de datos: un healthcheck que escribe puede
// dejar datos a medias si el contenedor se reinicia en bucle. Solo informa
// de qué integraciones están configuradas, nunca de sus valores.
export function GET() {
  return NextResponse.json({
    ok: true,
    at: new Date().toISOString(),
    config: {
      supabase: Boolean(
        process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
      ),
      zernio: Boolean(process.env.ZERNIO_API_KEY),
      encryption: hasEncryptionKey(),
      claude: Boolean(process.env.ANTHROPIC_API_KEY),
      cron: Boolean(process.env.CRON_SECRET),
      auth: Boolean(process.env.OWNER_EMAIL),
    },
  });
}
