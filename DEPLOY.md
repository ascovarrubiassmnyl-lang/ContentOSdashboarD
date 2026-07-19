# Deploy a producción — Cloudflare

Guía para llevar Content OS a producción. El código ya está preparado: la app
detecta las variables de entorno y cambia sola de modo local a producción.

## Requisitos previos (cuentas)

| Servicio | Para qué | Plan |
|---|---|---|
| [Supabase](https://supabase.com) | BD + archivos + login | Gratis |
| [Cloudflare](https://dash.cloudflare.com) | Hosting (Workers) | Gratis |
| [Anthropic](https://console.anthropic.com) | IA del generador/reportes | Pago por uso (centavos) |
| GitHub | Repo para el deploy con git | Gratis |

---

## Paso 1 — Supabase (15 min)

1. Crea un proyecto en supabase.com (región cercana, p. ej. `us-east-1`).
2. **SQL Editor** → pega y ejecuta `supabase/migrations/002_app_store.sql`.
3. **Authentication → Providers**: activa **Email** (magic link).
4. **Authentication → URL Configuration**: agrega la URL de producción como
   Site URL (cuando la tengas) y `http://localhost:3333` en Redirect URLs.
5. **Settings → API**: copia estos 3 valores:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (⚠️ secreta, solo servidor)

**Prueba local antes del deploy:** pega esas 3 variables + `OWNER_EMAIL` en
`.env.local`, reinicia el servidor y verifica que (a) te pide login, (b) el
magic link a tu correo entra, (c) los datos se guardan en Supabase (tabla
`app_store` se va llenando). Después sincroniza desde /conexion para poblar
la BD con tus datos reales.

## Paso 2 — Cloudflare Workers

Next.js corre en Cloudflare con el adaptador **OpenNext**
([opennext.js.org/cloudflare](https://opennext.js.org/cloudflare)).

⚠️ **Aviso importante — versión de Node:** el adaptador y `wrangler` requieren
**Node 20+** y esta Mac tiene Node 18. Dos salidas:
- **(Recomendada)** Deploy vía **Workers Builds**: conectas el repo de GitHub en
  el dashboard de Cloudflare y ellos compilan en la nube (no dependes del Node local).
- O actualizar Node local (`brew install node@22`) y desplegar con wrangler.

Pasos (vía Workers Builds):
1. Sube el proyecto a un repo de GitHub (privado).
2. En Cloudflare: **Workers & Pages → Create → conectar repo**.
3. Framework preset: **Next.js (OpenNext)**. Build command por defecto.
4. En **Settings → Variables**: agrega las del `.env.example`
   (Zernio, Anthropic, Supabase ×3, CRON_SECRET).
   **Login (opcional, hoy desactivado):** la app solo pide login si defines
   `OWNER_EMAIL`. Sin esa variable, la URL queda abierta a quien la tenga.
   Alternativa sin tocar la app: **Cloudflare Access** (Zero Trust → Access)
   protege el dominio con tu cuenta de Google antes de llegar a la app.
5. En **Settings → Runtime**: flag de compatibilidad **`nodejs_compat`**.
6. Deploy → te da la URL `https://<worker>.workers.dev` (o tu dominio).
7. Vuelve a Supabase → URL Configuration → pon esa URL como Site URL.

⚠️ **Producción requiere Supabase configurado**: en Workers no existe disco,
así que el modo local de archivos JSON no funciona ahí. Sin las variables de
Supabase, la app no podrá guardar datos.

⚠️ **Extracción de PDF/Word en Workers**: `pdf-parse` y `mammoth` son librerías
de Node; con `nodejs_compat` deberían funcionar, pero pruébalo tras el deploy
(sube un PDF en Fuentes). Si fallara, la subida guarda el archivo igualmente y
lo marcamos para procesar de otra forma.

## Paso 3 — Cron diario (7:00 a.m.)

El endpoint ya existe: `GET /api/cron/sync` con header
`authorization: Bearer <CRON_SECRET>`. Sincroniza Instagram y purga el calendario.

Opción A — **Cloudflare Cron Trigger** (mismo dashboard):
un Worker mínimo programado que llama a la URL. Cron en UTC:
- 7:00 a.m. Ciudad de México → `0 13 * * *`
- 7:00 a.m. Bogotá → `0 12 * * *`

Opción B — **cron-job.org** (más simple, sin código): job diario a la URL
`https://<tu-app>/api/cron/sync?secret=<CRON_SECRET>`.

## Paso 4 — Verificación final

- [ ] Entrar desde el celular a la URL de producción → pide login
- [ ] Magic link al correo del dueño → entra; otro correo → rechazado
- [ ] /conexion → Sincronizar ahora → métricas reales
- [ ] Subir un PDF en Fuentes → texto extraído
- [ ] Generar un guion en el chat
- [ ] Disparar el cron a mano (`curl -H "authorization: Bearer <secreto>" https://<app>/api/cron/sync`)
