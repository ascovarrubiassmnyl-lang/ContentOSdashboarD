# Plan: Subir videos a ContentOS y publicarlos solos en Instagram/Facebook

**Creado:** 2026-09-06
**Estado:** implementado (2026-09-06) — ver "Resultado de la validación" al final
**Pedido:** «necesito que podamos subir los videos a ContentOS para poder programarlos y subirlos de manera autónoma».

**Depende de:** la integración de cuentas de Zernio ya desplegada (commit `5c7a9af`) y del calendario editorial (Fase 4).

---

## Descripción General

### Qué Logra Este Plan

El calendario deja de ser una lista de intenciones. El usuario sube el video (o la imagen) a la pieza del calendario, escribe el pie de foto, marca "publicar automáticamente" y ContentOS se encarga del resto: a la hora programada el contenido sale publicado en la cuenta de Instagram o en la Página de Facebook, sin que nadie abra la app ni pulse nada. Cuando sale, la pieza pasa a `publicado` con el enlace real de la publicación.

### Por Qué Importa

Hoy ContentOS solo lee de Zernio (`/v1/accounts`, `/v1/analytics`). Zernio publica desde la misma API key que ya está guardada y cifrada en la app, así que la mitad de la integración está pagada y sin usar: el usuario planifica en ContentOS y luego publica a mano en otro sitio. Cerrar el ciclo —planificar, producir, publicar, medir— es lo que convierte el calendario en operación real.

---

## Estado Actual

### Estructura Existente Relevante

- `lib/zernio.ts` — cliente de Zernio, **solo lectura**. `zernioGet()` es privada y concentra el manejo de errores (402 plan antiguo, 401/403 key inválida).
- `lib/accounts.ts` — workspaces, claves con namespace (`readFor`/`writeFor`), `getZernioKey(ws)` descifra la key de cada cuenta, `ws.zernio_account_id` es el id de la cuenta dentro de Zernio.
- `lib/db.ts` — almacén key-value dual: `data/*.json` en local, tabla `app_store` (jsonb) en Postgres. **No sabe guardar binarios.**
- `lib/pg.ts` — `ensureSchema()` crea `app_store` sola; es idempotente.
- `app/api/calendar/route.ts` y `app/api/calendar/[id]/route.ts` — CRUD de `CalendarItem` (título, formato, nivel, fecha, estado, notas).
- `lib/maintenance.ts` — `filterExpired()` borra las piezas 24 h después de su hora programada.
- `app/api/cron/notifications/route.ts` + `scripts/railway-cron-notify.mjs` — tick cada 15 minutos ya desplegado en Railway.
- `app/calendario/page.tsx` — vista mes/semana y modal de crear/editar pieza.

### Lo que ofrece Zernio y no se estaba usando

| Endpoint | Para qué |
|---|---|
| `POST /v1/media/presign` | Devuelve `uploadUrl` (PUT directo, sin auth) y `publicUrl`. Hasta 5 GB. |
| `POST /v1/posts` | Crea el post. Con `scheduledFor` + `timezone` publica solo; con `publishNow: true` sale al momento. |
| `GET /v1/posts/{id}` | Estado (`draft, scheduled, sending, completed, failed, cancelled`) y `platformPostUrl` por plataforma. |
| `DELETE /v1/posts/{id}` | Cancela un post programado (no publicado). |

### Restricciones reales que condicionan el diseño

1. **El archivo subido a Zernio caduca a los 7 días** si el post no se ha publicado. La propia guía de Zernio lo dice: si se programa con semanas de antelación, hay que guardar el archivo del lado propio y subirlo cerca de la hora de publicación. → **ContentOS es el dueño del archivo**; Zernio lo recibe como muy pronto 6 días antes.
2. **Instagram exige medio** (no hay posts de solo texto) y cuenta Business/Creator. Video ≤ 300 MB feed/reels, ≤ 100 MB historias; reel ≤ 90 s.
3. **Un solo video publica como Reel automáticamente**; `contentType: "story"` para historias. El carrusel necesita varias imágenes.
4. **Dedupe de contenido de 24 h** en Zernio: el mismo texto + medio en la misma cuenta devuelve 409. Es una red de seguridad contra publicar dos veces, no un error a ocultar.
5. No existe almacenamiento de objetos en el proyecto (ni S3 ni volumen en Railway): el binario tiene que caber en los dos backends que ya hay.

---

## Cambios Propuestos

### Resumen

- **Almacén de binarios propio** (`lib/media/store.ts`) con los mismos dos backends que `lib/db.ts`: archivos en `data/media/` en local, tabla `app_media` (bytea) en Postgres. Se crea sola, como `app_store`.
- **La pieza del calendario gana medio y estado de publicación** (`media`, `caption`, `publish`), todos opcionales: las piezas existentes no necesitan migración.
- **Motor de publicación** (`lib/publish.ts`): sube el archivo a Zernio con presign, crea el post programado, consulta su estado y lo refleja en la pieza. Un solo módulo que usan la app y el cron.
- **El empuje a Zernio ocurre dentro de una ventana** (`PUBLISH_LEAD_DAYS`, 6 por defecto) para no chocar con la caducidad de 7 días. Fuera de la ventana la pieza queda `pendiente` y el cron la empuja cuando entra.
- **El tick de 15 minutos que ya existe** hace también el trabajo de publicación: empujar lo que toca, refrescar estados y borrar los binarios que ya no hacen falta. No hace falta un servicio nuevo en Railway.
- **La cuota de disco se controla sola**: el binario se borra cuando el post se publica, cuando se quita el medio, cuando se borra la pieza y cuando la pieza caduca.

### Nuevos Archivos

| Ruta | Propósito |
|---|---|
| `lib/media/store.ts` | Guardar/leer/borrar binarios en los dos backends, con metadatos (nombre, mime, tamaño). |
| `lib/publish.ts` | Presign + subida + creación del post + refresco de estado + selección de piezas que toca empujar. |
| `app/api/calendar/[id]/media/route.ts` | `POST` sube el archivo, `GET` lo devuelve (con soporte de `Range`, que Safari exige para video), `DELETE` lo quita. |
| `app/api/calendar/[id]/publish/route.ts` | `POST` activa la publicación automática, publica ya, o la cancela. |
| `app/api/cron/publish/route.ts` | Tick de publicación protegido con `CRON_SECRET`. |

### Archivos a Modificar

| Ruta | Cambio |
|---|---|
| `lib/zernio.ts` | Extraer `zernioRequest()` (método + cuerpo) y exportarla, para que publicar herede el mismo manejo de errores. |
| `lib/pg.ts` | `ensureSchema()` crea también `app_media`. |
| `types/index.ts` | `CalendarMedia`, `CalendarPublish`, `PublishState`; `CalendarItem` gana `caption?`, `media?`, `publish?`. |
| `app/api/calendar/route.ts` | Acepta `caption`; conserva los campos nuevos. |
| `app/api/calendar/[id]/route.ts` | `PATCH` acepta `caption`; `DELETE` borra el binario y cancela el post programado. |
| `lib/maintenance.ts` | Al purgar piezas caducadas, borra sus binarios. |
| `app/calendario/page.tsx` | Bloque "Publicación automática" en el modal: archivo, pie de foto, interruptor, estado y enlace; distintivo en la cuadrícula. |
| `scripts/railway-cron-notify.mjs` | Llama también a `/api/cron/publish` en el mismo tick. |
| `.env.example`, `README.md` | Variables nuevas y explicación del ciclo. |

### Estados de publicación

| Estado | Significado |
|---|---|
| `off` | La pieza es solo planificación (comportamiento de siempre). |
| `pendiente` | Automática activada, todavía fuera de la ventana de 6 días. El cron la empujará. |
| `programado` | Ya creada en Zernio con su hora. `zernio_post_id` guardado. |
| `publicado` | Zernio confirma que salió. Se guarda el `permalink`. |
| `error` | El último intento falló, con el mensaje de Zernio a la vista. El cron reintenta. |

---

## Fuera de Alcance (declarado)

- **Carruseles de varias imágenes**: la subida es de un archivo por pieza. Un carrusel de 10 imágenes necesita otra interfaz.
- **Ads**: el formato `ad` no se publica; los anuncios son otra superficie de la API de Zernio (Meta Ads) y otro consentimiento.
- **Edición del post ya programado en Zernio** (`PUT /v1/posts/{id}`): cambiar la hora en ContentOS cancela y vuelve a crear, que es más simple y no deja estados a medias.
- **Audio de catálogo, colaboradores, etiquetas de producto**: Zernio los soporta, pero no hay dónde declararlos en el calendario todavía.

## Validación

1. `npx tsc --noEmit` y `npx next build` limpios.
2. Con el servidor de desarrollo: crear pieza con video, comprobar que el archivo se guarda y se sirve con `Range`, y que la pieza queda `pendiente`/`programado` según la fecha.
3. Comprobar que borrar la pieza borra el binario y cancela el post en Zernio.
4. El tick del cron responde con el resumen de empujados/refrescados/purgados.

---

## Resultado de la validación (2026-09-06)

`npx tsc --noEmit` y `npx next build` limpios; las tres rutas nuevas aparecen en el
manifiesto. Probado en vivo contra un servidor de desarrollo (puerto 3399, sin login), con
copia de seguridad de `data/` antes y comprobación de que queda idéntica después.

| Comprobación | Resultado |
|---|---|
| Subir un video de 2,9 MB a una pieza | Guardado en `data/media/`, la pieza lo referencia |
| Descargar el archivo entero | 200, bytes idénticos al original |
| Descargar con `Range: bytes=0-1023` | 206 con `content-range` correcto (lo que Safari exige) |
| `Range` fuera de rango | 416 |
| Tipo no soportado (`text/plain`) | 415 con el motivo |
| Automática en cuenta sin id de Zernio | 409, sin dejar la pieza en un estado raro |
| Automática a 30 días vista | `pendiente`, sin tocar Zernio (respeta la caducidad de 7 días) |
| Automática a 1 día vista, sin API key | `error` con el mensaje de Zernio, HTTP 502 |
| Cron sin secreto / con secreto | 401 / resumen JSON correcto |
| Borrar la pieza | El binario desaparece del almacén |
| Quitar el archivo de una pieza | `media: null`, sigue en automática y avisa de que falta el archivo |
| Purga de huérfanos | Borra el de 3 h, respeta el de hace un minuto |
| Las cinco pantallas principales | 200, sin errores en el log |

### Validación contra la API real de Zernio (2026-09-06)

Ejecutada con una API key real en `.env.local` (nunca en git ni en la conversación), con el
servidor local apuntando a las cuentas reales del usuario. Todo lo creado se borró al
terminar.

**Publicación programada — Instagram `@ascovarrubias.smnyl` — 13/13:**

| Comprobación | Resultado |
|---|---|
| `POST /v1/media/presign` + `PUT` del video (3,3 MB, 1080×1920 H.264) | Subido |
| `POST /v1/posts` con `scheduledFor` | Post creado, `status: "scheduled"` |
| La hora en Zernio coincide con la de ContentOS | Exacta al segundo |
| El video llega adjunto al post | `mediaItems[0].url` en `media.zernio.com` |
| Plataforma y cuenta correctas | `instagram` / cuenta correcta |
| Tick del cron refresca el estado | `refreshed: 1` |
| Cambiar la hora reprograma | Post nuevo creado, el anterior → 404 en Zernio |
| Pieza a 30 días | `pendiente`, sin tocar Zernio |
| Borrar la pieza | Post cancelado en Zernio (404) y binario borrado |

**Publicación inmediata — Página de Facebook — 8/8** (autorizada por el usuario):
publicación real, `publishing → published` en ~20 s, ContentOS la marcó `publicado`, guardó
el permalink (`facebook.com/reel/...`, HTTP 200), pasó la pieza a `publicado` y soltó el
binario. Borrada después con `POST /v1/posts/{id}/unpublish` → `success: true`.

**Publicación autónoma — Página de Facebook — 3/3:** pieza programada a 4 minutos vista,
sin que nadie pulsara nada. `scheduled` hasta su hora → `publishing` a T+0,6 min →
`published` a T+1,3 min, y ContentOS la marcó `publicado` con su enlace real en el mismo
ciclo del cron. Borrada después.

Estado final en Zernio: los dos posts de prueba quedan como `cancelled`; ninguno vivo.

### Fallos encontrados y corregidos durante esta validación

1. **Doble publicación al pulsar "Publicar ahora"** sobre una pieza ya programada: se creaba
   un segundo post sin cancelar el primero. Ahora se cancela el anterior antes de crear nada.
2. **La idempotencia bloqueaba "Publicar ahora"**: el `x-request-id` era el mismo para
   programar y para publicar ya, así que Zernio devolvía el post programado como si fuera un
   reintento y no publicaba nada. El modo entra ahora en la huella.
3. **Una pieza en error no se podía reintentar** desde la interfaz: al tener ya un
   `zernio_post_id` solo se releía su estado. Ahora el reintento explícito vuelve a empujar,
   y hay un botón "Reintentar ahora".
4. **Hora ya pasada**: si el cron estaba caído cuando llegó la hora, se intentaba programar
   en el pasado (Zernio solo acepta instantes futuros) y fallaba. Ahora, dentro de la
   tolerancia de 6 h, se publica en el acto; pasada esa tolerancia se marca en error en vez
   de publicar tarde.

**Nota sobre `scheduledFor`:** la documentación de Zernio confirma que con sufijo `Z` el
campo `timezone` se ignora, así que se manda el instante UTC absoluto y se dejó de mandar
`timezone`, que solo añadía ruido.
