// Adaptador OpenNext para Cloudflare Workers.
// Sin caché incremental (no usamos ISR) — configuración mínima.
import { defineCloudflareConfig } from '@opennextjs/cloudflare';

export default defineCloudflareConfig();
