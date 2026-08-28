// Hash de contraseñas — PBKDF2-SHA256 sobre WebCrypto.
//
// PBKDF2 y no bcrypt/argon2 porque WebCrypto ya lo trae: cero dependencias
// nuevas y el mismo código sirve en Node y en cualquier runtime moderno, igual
// que lib/crypto.ts. 210.000 iteraciones es lo que recomienda OWASP para
// PBKDF2-SHA256.
//
// Formato guardado:  pbkdf2$<iteraciones>$<base64(sal)>$<base64(hash)>

const ITERATIONS = 210_000;
const SALT_BYTES = 16;
const HASH_BITS = 256;

export const MIN_PASSWORD_LENGTH = 8;

function toBase64(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function fromBase64(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function derive(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    key,
    HASH_BITS
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(SALT_BYTES)));
  const hash = await derive(password, salt, ITERATIONS);
  return `pbkdf2$${ITERATIONS}$${toBase64(salt)}$${toBase64(hash)}`;
}

// Comparación en tiempo constante: salir en la primera diferencia filtraría,
// por el tiempo de respuesta, cuánto del hash se acertó.
function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, rawIter, saltB64, hashB64] = stored.split('$');
  if (scheme !== 'pbkdf2' || !rawIter || !saltB64 || !hashB64) return false;
  const iterations = Number(rawIter);
  if (!Number.isFinite(iterations) || iterations <= 0) return false;
  try {
    const hash = await derive(password, fromBase64(saltB64), iterations);
    return equalBytes(hash, fromBase64(hashB64));
  } catch {
    return false;
  }
}
