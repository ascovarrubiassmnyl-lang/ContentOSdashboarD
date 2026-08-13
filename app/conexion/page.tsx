'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  KeyRound,
  Pencil,
  Plug,
  PlugZap,
  Plus,
  RefreshCw,
  ShieldX,
  Trash2,
  Unplug,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import { Button, Card, Input, Modal, Spinner } from '@/components/ui';
import { AccountAvatar, AccountRow } from '@/components/layout/AccountSwitcher';
import { ConnectionResponse } from '@/types';
import { fmtInt, relativeTime } from '@/lib/utils';

interface ZernioOption {
  id: string;
  username: string;
  displayName: string;
  followers: number;
  avatarUrl: string | null;
  alreadyAdded: boolean;
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

const FLOW_STEPS = [
  {
    n: 1,
    title: 'Cuenta profesional',
    desc: 'La cuenta de Instagram debe ser Creator o Business — requisito para que Instagram entregue métricas.',
  },
  {
    n: 2,
    title: 'Conexión en Zernio',
    desc: 'La cuenta se autoriza en zernio.com con "Instagram Login for Business" — sin cuenta de Facebook ni app de Meta propia.',
  },
  {
    n: 3,
    title: 'API key segura',
    desc: 'Cada cuenta de aquí guarda su propia API key de Zernio, cifrada en el servidor. Nunca llega al navegador ni se puede volver a leer.',
  },
  {
    n: 4,
    title: 'Sincronización',
    desc: 'Cada sync trae perfil, seguidores y todos los posts con sus métricas reales (alcance, vistas, guardados, watch time de reels).',
  },
  {
    n: 5,
    title: 'Datos separados',
    desc: 'Cada cuenta tiene sus propias métricas, fuentes, ideas, calendario, guiones y reportes. Cambiar de cuenta cambia todo el dashboard.',
  },
];

export default function ConexionPage() {
  const qc = useQueryClient();
  const router = useRouter();
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncOk, setSyncOk] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<AccountRow | null>(null);

  const { data, isLoading } = useQuery<ConnectionResponse>({
    queryKey: ['connection'],
    queryFn: async () => (await fetch('/api/connection')).json(),
  });

  const accountsQuery = useQuery<{ accounts: AccountRow[]; activeId: string }>({
    queryKey: ['accounts'],
    queryFn: async () => (await fetch('/api/accounts')).json(),
  });
  const accounts = accountsQuery.data?.accounts ?? [];

  const refreshEverything = () => {
    qc.clear();
    router.refresh();
  };

  const sync = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/connection', { method: 'POST' });
      const json = await res.json();
      if (!res.ok || json.ok === false) throw new Error(json.error ?? 'Error sincronizando');
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
      qc.invalidateQueries({ queryKey: ['accounts'] });
      qc.invalidateQueries({ queryKey: ['metrics'] });
    },
    onError: (err) => {
      setSyncOk(null);
      setSyncError((err as Error).message);
    },
  });

  const switchTo = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch('/api/accounts/active', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'No se pudo cambiar');
    },
    onSuccess: refreshEverything,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/accounts/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error ?? 'No se pudo eliminar');
    },
    onSuccess: refreshEverything,
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
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="accent-label mb-1">Datos reales de Instagram</p>
          <h1 className="text-xl font-extrabold">Conexión de API ⭐</h1>
          <p className="text-sm text-muted mt-1">
            Cada cuenta se conecta con su propia API key de Zernio y tiene sus datos aparte.
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus size={15} className="inline mr-1.5 -mt-0.5" />
          Añadir cuenta
        </Button>
      </div>

      {/* Conectada en Zernio pero SIN datos: casi siempre es un problema de
          plan/permisos en Zernio, no de la app. Hay que decirlo con claridad. */}
      {data?.realConnected && !data.hasData && (
        <div className="card border-negative/40 bg-negative/5 p-4 mb-6 flex items-start gap-3">
          <AlertTriangle size={18} className="text-negative shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-negative">
              {data.workspace?.label}: la API key funciona, pero Zernio no está entregando
              métricas
            </p>
            <p className="text-xs text-muted mt-1 leading-relaxed">
              {data.syncError ??
                'Todavía no ha entrado ninguna sincronización para esta cuenta.'}
            </p>
            <p className="text-xs text-muted mt-2">
              El resto del dashboard (fuentes, ideas, calendario y generador) sí funciona
              para esta cuenta: solo faltan los números de Instagram.
            </p>
          </div>
        </div>
      )}

      {data?.source === 'zernio' && data.hasData && (
        <div className="card border-positive/40 bg-positive/5 p-4 mb-6 flex items-start gap-3">
          <PlugZap size={18} className="text-positive shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-positive">
              {data.workspace?.label} está conectada vía Zernio
            </p>
            <p className="text-xs text-muted mt-0.5">
              Sus métricas reales entran a través de Zernio, sin app de Meta ni Página de
              Facebook. Pulsa <strong>Sincronizar ahora</strong> para traer lo más reciente.
            </p>
          </div>
        </div>
      )}

      {data?.demoMode && (
        <div className="card border-orange/40 bg-orange/5 p-4 mb-6 flex items-start gap-3">
          <AlertTriangle size={18} className="text-orange shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-orange">Modo demo en esta cuenta</p>
            <p className="text-xs text-muted mt-0.5">
              {data.workspace?.label} no tiene API key de Zernio, así que ves datos de
              demostración. Añádela con el botón <strong>Cambiar API key</strong> de abajo.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-12 gap-5">
        {/* ── Cuentas conectadas ── */}
        <Card className="col-span-12" glow={false}>
          <div className="flex items-center justify-between mb-4">
            <p className="section-label">Cuentas conectadas</p>
            <span className="text-[11px] text-muted">
              {accounts.length} {accounts.length === 1 ? 'cuenta' : 'cuentas'}
            </span>
          </div>

          {accountsQuery.isLoading ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : (
            <div className="space-y-2.5">
              {accounts.map((a) => (
                <div
                  key={a.id}
                  className={`flex items-center gap-3 flex-wrap rounded-xl border px-3.5 py-3 transition-all ${
                    a.active ? 'border-primary/40 bg-primary/5' : 'border-line bg-bg'
                  }`}
                >
                  <AccountAvatar label={a.label} color={a.color} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold truncate">
                      {a.label}
                      {a.active && (
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-primary/15 text-primary px-2 py-0.5 rounded-full ml-2">
                          Activa
                        </span>
                      )}
                    </p>
                    <p className="text-[11px] text-muted truncate">
                      {a.username ? `@${a.username}` : 'sin sincronizar'}
                      {a.followers > 0 && ` · ${fmtInt(a.followers)} seguidores`}
                      {' · '}
                      {a.keyState === 'none' ? (
                        <span className="text-orange">sin API key</span>
                      ) : a.last_sync_at ? (
                        `sync ${relativeTime(a.last_sync_at)}`
                      ) : (
                        'sin sincronizar'
                      )}
                    </p>
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    {!a.active && (
                      <Button
                        variant="secondary"
                        className="!px-3 !py-1.5 !text-xs"
                        onClick={() => switchTo.mutate(a.id)}
                        disabled={switchTo.isPending}
                      >
                        Usar
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      className="!px-2.5 !py-1.5 !text-xs"
                      onClick={() => setEditing(a)}
                    >
                      <Pencil size={13} />
                    </Button>
                    {accounts.length > 1 && (
                      <Button
                        variant="ghost"
                        className="!px-2.5 !py-1.5 !text-xs hover:!text-negative"
                        onClick={() => {
                          if (
                            confirm(
                              `¿Eliminar ${a.label}? Se borran TODOS sus datos: métricas, fuentes, ideas, calendario, guiones y reportes. No se puede deshacer.`
                            )
                          ) {
                            remove.mutate(a.id);
                          }
                        }}
                        disabled={remove.isPending}
                      >
                        <Trash2 size={13} />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          {remove.isError && (
            <p className="text-xs text-negative mt-3">{(remove.error as Error).message}</p>
          )}
        </Card>

        {/* ── Estado de la cuenta activa ── */}
        <Card className="col-span-12 lg:col-span-5" glow={false}>
          <p className="section-label mb-4">Estado de la cuenta activa</p>
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          ) : !account ? (
            <div className="py-4">
              <p className="text-sm text-muted mb-4">
                Esta cuenta todavía no tiene datos sincronizados. Si acabas de resolver el
                problema en Zernio, vuelve a intentarlo aquí.
              </p>
              <Button onClick={() => sync.mutate()} disabled={sync.isPending}>
                <RefreshCw
                  size={14}
                  className={`inline mr-1.5 -mt-0.5 ${sync.isPending ? 'animate-spin' : ''}`}
                />
                {sync.isPending ? 'Sincronizando…' : 'Reintentar sincronización'}
              </Button>
              {syncError && <p className="text-xs text-negative mt-3">{syncError}</p>}
              {syncOk && <p className="text-xs text-positive mt-3">✓ {syncOk}</p>}
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

      <AddAccountModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdded={() => {
          setAddOpen(false);
          refreshEverything();
        }}
      />
      <EditAccountModal
        account={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          qc.invalidateQueries({ queryKey: ['accounts'] });
          qc.invalidateQueries({ queryKey: ['connection'] });
        }}
      />
    </div>
  );
}

// ── Añadir cuenta: key de Zernio → elegir cuenta de Instagram → sincronizar ──
function AddAccountModal({
  open,
  onClose,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [apiKey, setApiKey] = useState('');
  const [label, setLabel] = useState('');
  const [options, setOptions] = useState<ZernioOption[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setApiKey('');
    setLabel('');
    setOptions(null);
    setError(null);
  };

  const probe = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/accounts/probe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ apiKey }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'No se pudo consultar Zernio');
      return json.options as ZernioOption[];
    },
    onSuccess: (opts) => {
      setError(null);
      setOptions(opts);
    },
    onError: (err) => setError((err as Error).message),
  });

  const create = useMutation({
    mutationFn: async (opt: ZernioOption) => {
      const res = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          apiKey,
          zernioAccountId: opt.id,
          username: opt.username,
          label: label.trim() || undefined,
          followers: opt.followers,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'No se pudo añadir la cuenta');
      return json as { syncError: string | null };
    },
    onSuccess: () => {
      reset();
      onAdded();
    },
    onError: (err) => setError((err as Error).message),
  });

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Añadir cuenta de Instagram"
    >
      {!options ? (
        <>
          <p className="text-xs text-muted mb-4 leading-relaxed">
            Pega la API key de la cuenta de Zernio donde está conectada esa cuenta de
            Instagram. Puede ser la misma key que ya usas (si tiene varias cuentas de IG) o
            la de otra cuenta de Zernio distinta. Se guarda cifrada en el servidor.
          </p>
          <Input
            label="API key de Zernio"
            value={apiKey}
            onChange={setApiKey}
            placeholder="sk_live_…"
            type="password"
          />
          {error && <p className="text-xs text-negative mb-3">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                reset();
                onClose();
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => probe.mutate()}
              disabled={apiKey.trim().length < 10 || probe.isPending}
            >
              {probe.isPending ? 'Buscando…' : 'Buscar cuentas'}
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-xs text-muted mb-4">
            Cuentas de Instagram conectadas a esa key. Elige cuál quieres añadir:
          </p>
          <div className="space-y-2 mb-4">
            {options.map((o) => (
              <button
                key={o.id}
                disabled={o.alreadyAdded || create.isPending}
                onClick={() => create.mutate(o)}
                className="w-full flex items-center gap-3 rounded-xl border border-line bg-bg px-3.5 py-3 text-left transition-all hover:border-primary/50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <AccountAvatar label={o.username} color="#7C7CF5" size={34} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold truncate">@{o.username}</p>
                  <p className="text-[11px] text-muted truncate">
                    <Users size={11} className="inline mr-1 -mt-0.5" />
                    {fmtInt(o.followers)} seguidores
                    {o.alreadyAdded && ' · ya añadida'}
                  </p>
                </div>
                {create.isPending && create.variables?.id === o.id && <Spinner />}
              </button>
            ))}
          </div>
          <Input
            label="Nombre en el menú (opcional)"
            value={label}
            onChange={setLabel}
            placeholder="Marca personal, Cliente X…"
          />
          {error && <p className="text-xs text-negative mb-3">{error}</p>}
          {create.isPending && (
            <p className="text-xs text-muted mb-3">
              Añadiendo y trayendo sus métricas… puede tardar unos segundos.
            </p>
          )}
          <div className="flex justify-end">
            <Button variant="secondary" onClick={() => setOptions(null)}>
              Volver
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}

// ── Editar cuenta: renombrar y rotar la API key ──
function EditAccountModal({
  account,
  onClose,
  onSaved,
}: {
  account: AccountRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [label, setLabel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  // Rellena el nombre al abrir con una cuenta distinta (sin useEffect: basta
  // con comparar contra la cuenta que ya cargamos).
  if (account && loadedFor !== account.id) {
    setLoadedFor(account.id);
    setLabel(account.label);
    setApiKey('');
    setError(null);
  }

  const save = useMutation({
    mutationFn: async () => {
      const body: Record<string, string> = {};
      if (label.trim() && label.trim() !== account?.label) body.label = label.trim();
      if (apiKey.trim()) body.apiKey = apiKey.trim();
      if (Object.keys(body).length === 0) return;
      const res = await fetch(`/api/accounts/${account!.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'No se pudo guardar');
    },
    onSuccess: onSaved,
    onError: (err) => setError((err as Error).message),
  });

  return (
    <Modal open={Boolean(account)} onClose={onClose} title={`Editar ${account?.label ?? ''}`}>
      <Input label="Nombre en el menú" value={label} onChange={setLabel} />
      <Input
        label="Cambiar API key de Zernio (opcional)"
        value={apiKey}
        onChange={setApiKey}
        placeholder={
          account?.keyState === 'none'
            ? 'Esta cuenta aún no tiene key — pégala aquí'
            : 'Déjalo vacío para conservar la actual'
        }
        type="password"
      />
      <p className="text-[11px] text-muted mb-4 flex items-start gap-1.5">
        <KeyRound size={12} className="shrink-0 mt-0.5" />
        {account?.keyState === 'env'
          ? 'Esta cuenta usa la key del entorno (ZERNIO_API_KEY). Si pegas una aquí, pasará a usar la suya propia, cifrada.'
          : 'La key se guarda cifrada y nunca se devuelve al navegador.'}
      </p>
      {error && <p className="text-xs text-negative mb-3">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? 'Guardando…' : 'Guardar'}
        </Button>
      </div>
    </Modal>
  );
}
