// Sonda la API real de Zernio para ver la forma exacta de las respuestas.
// Uso:  node scripts/probe-zernio.mjs
// Lee ZERNIO_API_KEY (y opcional ZERNIO_BASE_URL) de .env.local.
import fs from 'fs';
import path from 'path';

// Carga simple de .env.local
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const BASE = process.env.ZERNIO_BASE_URL || 'https://api.zernio.com';
const KEY = process.env.ZERNIO_API_KEY;

if (!KEY) {
  console.error('❌ Falta ZERNIO_API_KEY en .env.local');
  process.exit(1);
}

async function get(pathname, params = {}) {
  const qs = Object.keys(params).length ? '?' + new URLSearchParams(params) : '';
  const url = `${BASE}${pathname}${qs}`;
  const res = await fetch(url, {
    headers: { authorization: `Bearer ${KEY}`, accept: 'application/json' },
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, json };
}

console.log('🔎 Probando Zernio API en', BASE, '\n');

// 1) Cuentas conectadas
const accounts = await get('/v1/accounts', { platform: 'instagram' });
console.log('── GET /v1/accounts?platform=instagram ──');
console.log('status:', accounts.status);
console.log(JSON.stringify(accounts.json, null, 2).slice(0, 2000));
console.log('');

// 2) Analytics del primer account IG
const list = accounts.json?.accounts ?? accounts.json?.data ?? [];
const ig = list[0];
if (ig?._id) {
  const from = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
  const to = new Date().toISOString().slice(0, 10);
  const analytics = await get('/v1/analytics', {
    accountId: ig._id,
    platform: 'instagram',
    fromDate: from,
    toDate: to,
    limit: '3',
  });
  console.log(`── GET /v1/analytics (accountId=${ig._id}) ──`);
  console.log('status:', analytics.status);
  console.log(JSON.stringify(analytics.json, null, 2).slice(0, 3000));
} else {
  console.log('⚠️ No se encontró una cuenta IG en la respuesta de /v1/accounts.');
  console.log('   Revisa la forma real arriba para ajustar el campo.');
}
