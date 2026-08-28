// Qué modos de login están activos, leído solo del entorno.
//
// Vive aparte y SIN imports a propósito: lo necesita el middleware, que corre
// en el runtime Edge, donde no se puede cargar `pg` ni nada de lib/users.ts.

// Google es opcional: si no hay credenciales, el botón no aparece.
export function isGoogleEnabled(): boolean {
  return Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
}

// El login por usuario/contraseña solo necesita poder firmar la cookie.
export function isPasswordEnabled(): boolean {
  return Boolean(process.env.AUTH_SECRET);
}

// Con cualquiera de los dos, la app deja de estar abierta. Sin ninguno corre
// en modo demo local, con un usuario fijo (ver lib/auth.ts).
export function isAuthEnabled(): boolean {
  return isGoogleEnabled() || isPasswordEnabled();
}
