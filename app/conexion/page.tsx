'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plug,
  PlugZap,
  RefreshCw,
  ShieldX,
  Unplug,
} from 'lucide-react';
import { useState } from 'react';
import { Button, Card, Spinner } from '@/components/ui';
import { IgAccount } from '@/types';
import { relativeTime } from '@/lib/utils';

interface ConnectionResponse {
  account: IgAccount;
  source: 'zernio' | 'demo';
  demoMode: boolean;
  realConnected: boolean;
}

const ANTI_BAN_RULES = [
  'Scraping de followers o viewers de stories',
  'Automatizar DMs fríos',
  'Usar cuentas personales para funciones de negocio',
  'Pegar o guardar tokens en frontend / texto plano',
  'Pedir permisos que no se van a usar',
  'Prometer métricas que la API no entrega',
  'Publicar automáticamente sin aprobación humana',
];

// Cómo fluyen los datos con Zernio (sin app de Meta ni Página de Facebook)
const FLOW_STEPS = [
  {
    n: 1,
    title: 'Cuenta profesional',
    desc: '@scav_86 es cuenta Creator/Business — requisito para que Instagram entregue métricas.',
  },
  {
    n: 2,
    title: 'Conexión en Zernio',
    desc: 'La cuenta se autoriza en zernio.com con "Instagram Login for Business" — sin cuenta de Facebook ni app de Meta propia.',
  },
  {
    n: 3,
    title: 'API key segura',
    desc: 'El dashboard usa la API key de Zernio (guardada en el servidor, nunca en el navegador) para leer las métricas.',
  },
  {
    n: 4,
    title: 'Sincronización',
    desc: 'Cada sync trae perfil, seguidores y todos los posts con sus métricas reales (alcance, vistas, guardados, watch time de reels).',
  },
  {
    n: 5,
    title: 'Gestión',
    desc: 'Para desconectar o reconectar la cuenta de Instagram de forma definitiva, se hace desde el panel de Zernio.',
  },
];

export default function ConexionPage() {
  const qc = useQueryClient();
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncOk, setSyncOk] = useState<string | null>(null);

  const { data, isLoading } = useQuery<ConnectionResponse>({
    queryKey: ['connection'],
    queryFn: async () => (await fetch('/api/connection')).json(),
  });

  const sync = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/connection', { method: 'POST' });
      const json = await res.json();
      if (!res.ok || json.ok === false) {
        throw new Error(json.error ?? 'Error sincronizando');
      }
      return json as { result?: { postsSynced: number; followers: number } };
    },
    onSuccess: (json) => {
      setSyncError(null);
      setSyncOk(
        json.result
          ? `Sincronizado: ${json.result.postsSynced} posts · ${json.result.followers} seguidores.`
          : 'Sincronizado.'
      );
      qc.invalidateQueries({ queryKey: ['connection'] });
      qc.invalidateQueries({ queryKey: ['metrics'] });
    },
    onError: (err) => {
      setSyncOk(null);
      setSyncError((err as Error).message);
    },
  });

  const disconnect = useMutation({
    mutationFn: async () => fetch('/api/connection', { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['connection'] }),
  });

  const reconnect = useMutation({
    mutationFn: async () => fetch('/api/connection', { method: 'PATCH' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['connection'] }),
  });

  const account = data?.account;
  const connected = account?.connected ?? false;

  return (
    <div>
      <div className="mb-6">
        <p className="accent-label mb-1">Datos reales de Instagram</p>
        <h1 className="text-xl font-extrabold">Conexión de API ⭐</h1>
        <p className="text-sm text-muted mt-1">
          La fuente de datos reales del dashboard. Sin conexión, no hay métricas.
        </p>
      </div>

      {data?.source === 'zernio' && (
        <div className="card border-positive/40 bg-positive/5 p-4 mb-6 flex items-start gap-3">
          <PlugZap size={18} className="text-positive shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-positive">Conectado vía Zernio</p>
            <p className="text-xs text-muted mt-0.5">
              Tus métricas reales de Instagram entran a través de Zernio, sin necesidad de
              app de Meta ni Página de Facebook. Pulsa <strong>Sincronizar ahora</strong>{' '}
              para traer los datos más recientes.
            </p>
          </div>
        </div>
      )}

      {data?.demoMode && (
        <div className="card border-orange/40 bg-orange/5 p-4 mb-6 flex items-start gap-3">
          <AlertTriangle size={18} className="text-orange shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-orange">Modo demo activo</p>
            <p className="text-xs text-muted mt-0.5">
              No hay ZERNIO_API_KEY configurada. Los datos que ves son de demostración.
              Conecta tu Instagram en zernio.com, crea una API key y pégala en{' '}
              <code className="text-soft">.env.local</code> para ver tus métricas reales.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-12 gap-5">
        {/* ── Estado de conexión ── */}
        <Card className="col-span-12 lg:col-span-5" glow={false}>
          <p className="section-label mb-4">Estado de conexión</p>
          {isLoading || !account ? (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-4 mb-5">
                <div
                  className={`h-12 w-12 rounded-2xl flex items-center justify-center ${
                    connected ? 'bg-positive/15 text-positive' : 'bg-negative/15 text-negative'
                  }`}
                >
                  {connected ? <PlugZap size={22} /> : <Unplug size={22} />}
                </div>
                <div>
                  <p className="font-extrabold">
                    @{account.username}{' '}
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-primary/15 text-primary px-2 py-0.5 rounded-full ml-1">
                      {account.account_type}
                    </span>
                  </p>
                  <p
                    className={`text-xs font-semibold ${
                      connected ? 'text-positive' : 'text-negative'
                    }`}
                  >
                    {connected ? '● Conectada' : '○ Desconectada'}
                  </p>
                </div>
              </div>

              <div className="space-y-2.5 mb-6">
                <div className="flex items-center gap-2 text-xs text-muted">
                  <Clock size={13} />
                  Última sincronización:{' '}
                  <span className="text-soft font-semibold">
                    {relativeTime(account.last_sync_at)}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted">
                  <CheckCircle2 size={13} />
                  Fuente:{' '}
                  <span className="text-soft font-semibold">
                    {data?.source === 'zernio' ? 'Zernio · Instagram real' : 'Datos demo'}
                  </span>
                </div>
              </div>

              <div className="flex gap-2 flex-wrap">
                {connected ? (
                  <>
                    <Button onClick={() => sync.mutate()} disabled={sync.isPending}>
                      <RefreshCw
                        size={14}
                        className={`inline mr-1.5 -mt-0.5 ${
                          sync.isPending ? 'animate-spin' : ''
                        }`}
                      />
                      {sync.isPending ? 'Sincronizando…' : 'Sincronizar ahora'}
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => disconnect.mutate()}
                      disabled={disconnect.isPending}
                    >
                      <Unplug size={14} className="inline mr-1.5 -mt-0.5" />
                      Desconectar
                    </Button>
                  </>
                ) : (
                  <Button onClick={() => reconnect.mutate()} disabled={reconnect.isPending}>
                    <Plug size={14} className="inline mr-1.5 -mt-0.5" />
                    Reconectar
                  </Button>
                )}
              </div>
              {syncOk && <p className="text-xs text-positive mt-3">✓ {syncOk}</p>}
              {syncError && <p className="text-xs text-negative mt-3">{syncError}</p>}
            </>
          )}
        </Card>

        {/* ── Cómo fluyen los datos ── */}
        <Card className="col-span-12 lg:col-span-7" glow={false}>
          <p className="section-label mb-4">Cómo fluyen tus datos (vía Zernio)</p>
          <div className="space-y-4">
            {FLOW_STEPS.map((s) => (
              <div key={s.n} className="flex gap-4">
                <span className="h-7 w-7 rounded-full bg-primary/15 text-primary text-xs font-extrabold flex items-center justify-center shrink-0">
                  {s.n}
                </span>
                <div>
                  <p className="text-sm font-bold">{s.title}</p>
                  <p className="text-xs text-muted leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* ── Reglas anti-baneo ── */}
        <Card className="col-span-12 border-negative/30" glow={false}>
          <div className="flex items-center gap-2 mb-4">
            <ShieldX size={16} className="text-negative" />
            <p className="section-label !text-negative">
              Reglas anti-baneo — lo que NO hay que hacer
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {ANTI_BAN_RULES.map((rule) => (
              <div
                key={rule}
                className="flex items-start gap-2.5 bg-bg border border-line rounded-xl px-3.5 py-3"
              >
                <span className="text-negative font-extrabold text-sm leading-none mt-0.5">
                  ✕
                </span>
                <p className="text-xs text-soft leading-relaxed">{rule}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
