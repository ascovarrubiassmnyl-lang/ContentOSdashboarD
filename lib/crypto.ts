// Cifrado de secretos en reposo (las API keys de Zernio de cada cuenta).
//
// Usa WebCrypto (AES-256-GCM) en lugar de node:crypto para que funcione igual
// en Node 18 local y en Cloudflare Workers, donde node:crypto es parcial.
//
// Formato del blob: base64(iv) + '.' + base64(ciphertext+tag)
// La clave sale de ENCRYPTION_KEY: 64 caracteres hex (32 bytes).
//   Generarla con:  openssl rand -hex 32

const IV_BYTES = 12; // recomendado para GCM

export function hasEncryptionKey(): boolean {
  return isValidKey(process.env.ENCRYPTION_KEY);
}

function isValidKey(raw?: string): boolean {
  return typeof raw === 'string' && /^[0-9a-fA-F]{64}$/.test(raw.trim());
}

function keyBytes(): Uint8Array<ArrayBuffer> {
  const raw = process.env.ENCRYPTION_KEY?.trim();
  if (!isValidKey(raw)) {
    throw new Error(
      'ENCRYPTION_KEY ausente o inválida: se esperan 64 caracteres hex (openssl rand -hex 32).'
    );
  }
  const bytes = new Uint8Array(new ArrayBuffer(32));
  for (let i = 0; i < 32; i++) bytes[i] = parseInt(raw!.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

async function importKey(usage: KeyUsage): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', keyBytes(), { name: 'AES-GCM' }, false, [usage]);
}

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

export async function encryptSecret(plain: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(IV_BYTES)));
  const key = await importKey('encrypt');
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plain)
  );
  return `${toBase64(iv)}.${toBase64(new Uint8Array(cipher))}`;
}

export async function decryptSecret(blob: string): Promise<string> {
  const [ivB64, dataB64] = blob.split('.');
  if (!ivB64 || !dataB64) throw new Error('Secreto con formato inválido.');
  const key = await importKey('decrypt');
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(ivB64) },
    key,
    fromBase64(dataB64)
  );
  return new TextDecoder().decode(plain);
}

// Para mostrar en la UI sin revelar el secreto: sk_live_abc…wxyz
export function maskSecret(secret: string): string {
  if (secret.length <= 12) return '••••••••';
  return `${secret.slice(0, 6)}…${secret.slice(-4)}`;
}
