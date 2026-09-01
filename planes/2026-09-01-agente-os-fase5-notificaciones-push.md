# Plan: Fase 5 — Notificaciones push reales al teléfono (Web Push + PWA)

**Creado:** 2026-09-01
**Estado:** implementado (2026-09-01) — ver "Resultado de la validación" al final
**Pedido:** Que las notificaciones lleguen a la bandeja del teléfono con sonido, como un mensaje de WhatsApp: recordatorios de calendario, actividad del agente y alertas del sistema.

**Depende de:** el soporte PWA ya desplegado (commit `b6ab8b7`). Complementa —sin requerir— la Fase 4.

---

## Descripción General

### Qué Logra Este Plan

ContentOS deja de avisar solo cuando la app está abierta. Con la PWA instalada, el teléfono recibe una notificación del sistema —bandeja, sonido y vibración del dispositivo— cuando falta poco para publicar una pieza del calendario, cuando el agente termina un trabajo, o cuando algo del sistema se rompe (sync fallido, API key de Zernio ilegible). El panel de notificaciones de la app, hoy completamente mockeado, pasa a mostrar el historial real y el mismo evento alimenta ambos canales.

### Por Qué Importa

Un calendario editorial que solo existe dentro de una pestaña abierta no cambia la conducta de nadie: la pieza se pasa de hora porque nadie la miró. El valor operativo del calendario depende de que el aviso salga de la app y llegue al bolsillo. Además cierra una de las limitaciones listadas en la auditoría (`Estado de el sistema.md` §4: "Sin notificaciones / alertas").

---

## Estado Actual

### Estructura Existente Relevante

- `public/sw.js` — service worker con caché (SWR + network-first + fallback offline). **No tiene handler de `push` ni de `notificationclick`.**
- `components/pwa/PwaRegister.tsx` — registra `/sw.js` y detecta versiones nuevas.
- `components/pwa/PwaInstallBanner.tsx` — invita a instalar la PWA (prerrequisito duro en iOS).
- `public/manifest.webmanifest` + `manifest.json` — `display: standalone`, iconos 192/512, ya válidos para push.
- `components/NotificationsPanel.tsx` — panel lateral con **datos mock hardcodeados**.
- `app/api/cron/{sync,reports,competitors}/route.ts` — patrón de cron: `CRON_SECRET` por header o query, tolerancia a fallos por cuenta, resumen JSON.
- `scripts/railway-cron.mjs` — servicio cron de Railway (`npm run cron`), hoy diario.
- `lib/db.ts` — almacén key-value dual (JSON local / Postgres), `lib/accounts.ts` para lo que es por cuenta.
- `lib/session.ts` — `requireWorkspace()`; `lib/auth.ts` — `getSessionUser()`.

### Brechas o Problemas que se Abordan

1. **No hay push.** Ni suscripciones, ni claves VAPID, ni envío, ni handler en el service worker.
2. **El panel de notificaciones es una maqueta.** Muestra tres avisos inventados que nunca cambian.
3. **No hay dónde guardar una notificación.** No existe el concepto de evento notificable ni su historial.
4. **El cron es diario.** Un recordatorio de "faltan 2 horas" necesita un tick de ~15 minutos: hace falta un segundo servicio de cron con otro horario.
5. **Las suscripciones son del usuario, no de la cuenta.** Todo el almacén está namespaceado por workspace; un usuario con 3 cuentas y un teléfono necesita un almacén por **usuario**, que es una categoría que hoy no existe en `SCOPED_COLLECTIONS`.

---

## Cambios Propuestos

### Resumen de Cambios

- Web Push estándar con claves VAPID (`web-push`), suscripciones por usuario y por dispositivo, con limpieza automática de las caducadas.
- Un único punto de emisión (`emitNotification`) que graba el evento en el historial de la cuenta y lo envía por push a los dispositivos del dueño, con clave de deduplicación.
- Tres orígenes: recordatorios de calendario (cron cada 15 min), actividad del agente (al terminar un reporte o aplicarse un plan) y alertas del sistema (fallos de sync / key ilegible, desde el cron diario).
- Handlers `push`, `notificationclick` y `pushsubscriptionchange` en el service worker.
- Panel de notificaciones con datos reales, no leídas con badge, y preferencias por usuario (qué tipos, antelación, horas de silencio).
- Servicio de cron adicional en Railway (`npm run cron:notify`, `*/15`).

### Nuevos Archivos a Crear

| Ruta del Archivo | Propósito |
| --- | --- |
| `lib/push/vapid.ts` | Lee las claves VAPID del entorno; `isPushConfigured()` para degradar con elegancia si faltan. |
| `lib/push/subscriptions.ts` | Suscripciones por usuario (alta, baja, listado, baja por endpoint caducado). |
| `lib/push/send.ts` | Envío vía `web-push`, con purga de suscripciones que devuelven 404/410. |
| `lib/notifications/types.ts` | `AppNotification`, `NotificationKind`, `NotificationPreferences`. |
| `lib/notifications/store.ts` | Historial por cuenta, no leídas, marcar leído, deduplicación, tope de 200. |
| `lib/notifications/emit.ts` | Punto único: graba + envía push respetando preferencias y horas de silencio. |
| `app/api/push/route.ts` | GET clave pública + estado; POST alta de suscripción; DELETE baja. |
| `app/api/notifications/route.ts` | GET historial + no leídas; PATCH marcar leídas. |
| `app/api/notifications/preferences/route.ts` | GET/PUT preferencias del usuario. |
| `app/api/cron/notifications/route.ts` | Tick de recordatorios de calendario (cada 15 min). |
| `components/pwa/PushOptIn.tsx` | Botón de activación (gesto de usuario, obligatorio en iOS) + estado y diagnóstico. |
| `scripts/railway-cron-notify.mjs` | Servicio cron de alta frecuencia para Railway. |

### Archivos a Modificar

| Ruta del Archivo | Cambios |
| --- | --- |
| `public/sw.js` | Handlers `push`, `notificationclick`, `pushsubscriptionchange`; subir `CACHE_NAME` a `contentos-pwa-v2`. |
| `components/NotificationsPanel.tsx` | Datos reales desde `/api/notifications`, marcar leídas, activación de push, estado vacío. |
| `components/layout/AppShell.tsx` | Badge de no leídas en la campana. |
| `app/api/cron/sync/route.ts` | Emitir alerta del sistema cuando una cuenta falla al sincronizar. |
| `app/api/cron/reports/route.ts` | Emitir "reporte listo" al generar uno. |
| `scripts/railway-cron.mjs` | Nada obligatorio; documentar que los recordatorios van en el otro servicio. |
| `package.json` | `web-push` + script `cron:notify`. |
| `.env.example`, `DEPLOY.md`, `README.md`, `CLAUDE.md` | Variables VAPID, cómo generarlas, segundo servicio de cron y límites reales por plataforma. |

---

## Decisiones de Diseño

### Decisiones Clave Tomadas

1. **Web Push estándar, no un servicio externo.** Ya hay PWA, service worker y manifest válidos; lo único que falta son claves VAPID y ~150 líneas. Firebase/OneSignal añadirían un SDK, una cuenta y un tercero con los datos de los usuarios para resolver algo que el navegador ya hace.

2. **Un solo punto de emisión.** Todo pasa por `emitNotification({ ws, kind, title, body, url, dedupeKey })`, que graba en el historial **y** envía el push. Si fueran caminos separados, el panel y el teléfono acabarían contando historias distintas — y el usuario creería la que le contradiga.

3. **Deduplicación obligatoria, en código.** El tick de recordatorios corre cada 15 minutos y ve la misma pieza varias veces. Cada notificación lleva `dedupe_key` (ej. `reminder:<item_id>:120m`) y `emitNotification` no reenvía una clave ya usada. Sin esto, un aviso de "faltan 2 horas" se dispara 8 veces y el usuario apaga las notificaciones para siempre.

4. **Las suscripciones son del usuario; el historial es de la cuenta.** Un teléfono pertenece a una persona, no a un workspace: `push_subscriptions` es una colección global indexada por `user_id`. El historial sí es por cuenta (`notifications` en `SCOPED_COLLECTIONS`), porque "faltan 2 h para el reel" es un hecho de esa cuenta y debe morir con ella.

5. **Sin claves VAPID, todo sigue funcionando.** `isPushConfigured()` es false → el panel muestra el historial igual y la activación explica qué falta. Es la misma degradación elegante que el resto del sistema (sin IA → plantillas, sin Zernio → demo).

6. **Las suscripciones muertas se borran solas.** Un endpoint que responde 404/410 está caducado: se elimina en el mismo envío. Acumular suscripciones zombis hace que cada emisión tarde más y falle más, hasta que nadie sabe si el push funciona.

7. **Sobre el sonido, se dice la verdad en la UI.** La notificación la muestra el sistema operativo, así que **suena con el tono de notificación del dispositivo**, igual que WhatsApp. Lo que **no** se puede hacer es enviar un tono propio: el campo `sound` de la Notification API está fuera del estándar y ningún navegador actual lo respeta. Se implementa lo que sí es posible: (a) push del sistema con sonido y vibración del dispositivo, y (b) un tono propio corto cuando la app está **en primer plano**, que sí se puede reproducir. Prometer un tono personalizado en background sería vender algo que la plataforma no permite.

8. **iOS tiene requisitos duros y la UI los explica.** En iOS (16.4+) el push solo funciona si la PWA está **instalada en la pantalla de inicio**, y el permiso debe pedirse desde un gesto del usuario. `PushOptIn` detecta iOS + no instalada y muestra las instrucciones en vez de un error genérico de permiso denegado.

9. **Horas de silencio se respetan en el servidor.** Una notificación fuera de la ventana permitida se **graba en el historial pero no se envía**. Decidirlo en el cliente sería tarde: el teléfono ya sonó.

### Alternativas Consideradas

- **Firebase Cloud Messaging / OneSignal**: rechazado por Decisión #1.
- **Sondeo desde el cliente (`setInterval` + `Notification`)**: solo funciona con la app abierta — no resuelve el pedido, que es que llegue al teléfono con la app cerrada.
- **Emitir el recordatorio al crear la pieza (job programado por item)**: requeriría una cola de trabajos persistente; el barrido cada 15 minutos sobre un calendario de decenas de items es trivial y no añade infraestructura.
- **Notificaciones por correo**: no hay proveedor de email configurado (limitación ya documentada) y no cumple "bandeja del teléfono con sonido".

### Preguntas Abiertas (si las hay)

1. **Antelación por defecto de los recordatorios**: se propone 120 min, configurable por usuario. ¿Un segundo aviso a los 15 min?
2. **¿Notificar actividad del agente iniciada por el propio usuario?** Si el usuario está mirando el chat, el push es ruido. Se propone notificar solo el trabajo **no interactivo** (cron de reportes) y dejar el interactivo solo en el historial.
3. **Coste del tick de 15 min en Railway**: un servicio cron que arranca 96 veces al día. Si pesa, la alternativa es bajar a 30 min y aceptar esa granularidad en la antelación.

---

## Tareas Paso a Paso

### Paso 1: Dependencia y claves

**Acciones:**

- `npm install web-push` (+ `@types/web-push` en dev).
- Documentar en `.env.example` y `DEPLOY.md`: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (mailto:), y cómo generarlas con `npx web-push generate-vapid-keys`.
- `lib/push/vapid.ts` con `isPushConfigured()` y la configuración perezosa de `web-push`.

**Archivos afectados:** `package.json`, `.env.example`, `DEPLOY.md`, `lib/push/vapid.ts`

---

### Paso 2: Suscripciones por usuario

**Acciones:**

- `lib/push/subscriptions.ts` sobre `readCollection`/`writeCollection` con la clave global `push_subscriptions`: `listForUser`, `save` (idempotente por endpoint), `removeByEndpoint`, `removeForUser`.
- Guardar `user_agent` y `created_at` para que el usuario pueda distinguir sus dispositivos.

**Archivos afectados:** `lib/push/subscriptions.ts`

---

### Paso 3: Envío

**Acciones:**

- `lib/push/send.ts`: `sendToUser(userId, payload)` que recorre suscripciones, envía con `web-push`, y borra las que devuelvan 404/410. Devuelve `{ sent, removed, failed }` — nunca lanza por un dispositivo caído.

**Archivos afectados:** `lib/push/send.ts`

---

### Paso 4: Historial y preferencias

**Acciones:**

- `lib/notifications/types.ts` y `lib/notifications/store.ts`: `AppNotification { id, account_id, kind, title, body, url, dedupe_key, created_at, read_at }`; listar, marcar leídas, contar no leídas, tope de 200 por cuenta.
- Preferencias por usuario (clave global `notification_preferences`): `kinds` habilitados, `reminder_lead_minutes`, `quiet_hours { start, end }`, `timezone`.
- Registrar `notifications` en `SCOPED_COLLECTIONS`.

**Archivos afectados:** `lib/notifications/types.ts`, `lib/notifications/store.ts`, `lib/accounts.ts`

---

### Paso 5: Emisión única

**Acciones:**

- `lib/notifications/emit.ts`: comprueba dedupe, graba, y —si el tipo está habilitado, hay claves VAPID y no estamos en horas de silencio— envía push al dueño de la cuenta (`ws.owner_user_id`). Cuentas sin dueño se saltan.

**Archivos afectados:** `lib/notifications/emit.ts`

---

### Paso 6: Service worker

**Acciones:**

- `public/sw.js`: `push` → `showNotification` con título, cuerpo, icono, badge, `vibrate`, `tag` (colapsa repetidos) y `data.url`; `notificationclick` → enfocar una ventana existente o abrir la URL; `pushsubscriptionchange` → re-suscribir y reenviar al servidor.
- Subir `CACHE_NAME` a `contentos-pwa-v2` para forzar la actualización.

**Archivos afectados:** `public/sw.js`

---

### Paso 7: Endpoints

**Acciones:**

- `app/api/push/route.ts` (GET estado + clave pública, POST alta, DELETE baja), `app/api/notifications/route.ts` (GET, PATCH), `app/api/notifications/preferences/route.ts` (GET, PUT). Todos con sesión.
- `app/api/cron/notifications/route.ts` con `CRON_SECRET`: recorre cuentas, busca piezas cuya hora esté dentro de la ventana de antelación y emite recordatorios; resumen JSON como los otros crons.

**Archivos afectados:** las cuatro rutas

---

### Paso 8: UI

**Acciones:**

- `components/pwa/PushOptIn.tsx`: estado (no soportado / iOS sin instalar / permiso denegado / activo), activación desde click, alta y baja de suscripción.
- `components/NotificationsPanel.tsx`: historial real, marcar todas como leídas, bloque de activación arriba, estado vacío honesto.
- `components/layout/AppShell.tsx`: badge de no leídas.

**Archivos afectados:** los tres

---

### Paso 9: Orígenes de eventos

**Acciones:**

- `app/api/cron/reports/route.ts`: emitir `report_ready` con enlace a `/agente?panel=reportes`.
- `app/api/cron/sync/route.ts`: emitir `system_alert` cuando una cuenta falle.

**Archivos afectados:** ambos crons

---

### Paso 10: Cron de alta frecuencia

**Acciones:**

- `scripts/railway-cron-notify.mjs` (mismo patrón que `railway-cron.mjs`, llamando solo a `/api/cron/notifications`) y script `cron:notify`.
- `DEPLOY.md`: segundo servicio de Railway con `*/15 * * * *`, `APP_URL` y `CRON_SECRET`.

**Archivos afectados:** `scripts/railway-cron-notify.mjs`, `package.json`, `DEPLOY.md`

---

### Paso 11: Validación

**Acciones:**

- `npx tsc --noEmit` y `npm run build` limpios.
- Sin VAPID: la app arranca, el panel funciona y la activación explica qué falta (no revienta).
- Con VAPID en local: suscribir el navegador, disparar `/api/cron/notifications` a mano y ver la notificación del sistema; clic → abre la ruta correcta.
- Repetir el tick: la segunda vez **no** vuelve a notificar (dedupe).
- Baja: `DELETE /api/push` deja de recibir.

---

## Conexiones y Dependencias

### Archivos que Referencian Esta Área

- `components/layout/AppShell.tsx` (campana), `app/layout.tsx` (registro del SW), los tres crons existentes.

### Actualizaciones Necesarias para Consistencia

- `Estado de el sistema.md`: quitar "Sin notificaciones / alertas" de las limitaciones cuando esté desplegado.
- `CLAUDE.md`, `README.md`, `DEPLOY.md`: variables nuevas, segundo cron y los límites reales de sonido/iOS.

### Impacto en Flujos de Trabajo Existentes

- Ninguno rompe: sin VAPID el comportamiento actual se mantiene íntegro. El único cambio visible sin configurar nada es que el panel deja de mostrar avisos falsos.

---

## Lista de Validación

- [ ] `npx tsc --noEmit` y `npm run build` limpios.
- [ ] Sin claves VAPID la app funciona y lo explica.
- [ ] Con la PWA instalada, llega la notificación a la bandeja del teléfono con el sonido del sistema.
- [ ] El clic abre la pantalla correcta (calendario, reportes o conexión según el tipo).
- [ ] Un recordatorio no se repite entre ticks del cron.
- [ ] Las horas de silencio bloquean el envío pero no el historial.
- [ ] Una suscripción caducada se borra sola al fallar.
- [ ] El badge de no leídas cuadra con el panel.

---

## Criterios de Éxito

1. Con la PWA instalada en el teléfono y las claves configuradas, una pieza programada dispara una notificación en la bandeja del sistema, con sonido y vibración del dispositivo, con la app cerrada.
2. El panel de notificaciones muestra hechos reales de la cuenta, no maqueta.
3. Los tres orígenes (calendario, agente, sistema) emiten por el mismo camino y respetan las preferencias del usuario.
4. Nada de esto rompe la app cuando el push no está configurado.
5. La documentación dice con precisión qué se puede y qué no (tono propio en background: no; tono del sistema: sí).

---

## Resultado de la validación (2026-09-01)

`npx tsc --noEmit` y `npm run build` limpios, con `/api/push`,
`/api/notifications`, `/api/notifications/preferences` y
`/api/cron/notifications` compilados. 13 comprobaciones directas:

- **Sin claves VAPID**: `isPushConfigured()` es false, la app no revienta y el
  aviso queda igual en el historial con el motivo (`sin claves VAPID`).
- **Deduplicación**: la misma `dedupe_key` no se reenvía; cambiar la antelación
  (`…:120m` → `…:240m`) sí produce un aviso nuevo, que era el punto.
- **Preferencias**: desactivar un tipo se persiste y ese tipo pasa a "solo
  historial"; las horas de silencio bloquean el envío pero no el registro.
- **Bandeja**: el contador de no leídas cuadra y "marcar todas" lo deja en 0.
- **Suscripciones**: re-suscribir el mismo endpoint actualiza en vez de
  duplicar; la baja lo elimina.
- **Envío real contra FCM** (con un par VAPID generado para la prueba): un
  endpoint caducado devuelve **HTTP 410** de verdad y la suscripción muerta se
  purga sola (`{sent:0, removed:1, failed:0}`), sin lanzar.

Pendiente de comprobar en el dispositivo real, ya en producción: la llegada del
push a la bandeja del teléfono con la PWA instalada. Requiere las claves VAPID
en el servicio web y el servicio de cron `*/15` creado en Railway.

**Hallazgo durante la validación:** la primera prueba de purga daba un falso
negativo porque usaba una `p256dh` de ejemplo inválida para la curva P-256:
`web-push` fallaba en local, antes de salir a la red, con un error sin
`statusCode`. Con un par generado con `crypto.createECDH('prime256v1')` —como el
que produce el navegador— la petición sí llega a FCM y devuelve el 410 esperado.
El código no tenía el fallo; lo tenía la prueba.

## Notas

El tono propio en primer plano usa un archivo corto en `public/sounds/`. Requiere una interacción previa del usuario en la página (política de autoplay), que en la práctica siempre existe porque la activación del push ya fue un clic.
