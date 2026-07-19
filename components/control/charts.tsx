'use client';

import { useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, Tabs } from '@/components/ui';
import { MetricsResponse } from '@/types';
import { fmtInt, fmtPct } from '@/lib/utils';

const tooltipStyle = {
  backgroundColor: '#161622',
  border: '1px solid #2A2A42',
  borderRadius: 12,
  fontSize: 12,
  color: '#E8E8F2',
};

// ── 📈 Evolución diaria de seguidores ─────────────────────────
export function FollowersChart({ data }: { data: MetricsResponse['followersSeries'] }) {
  const [mode, setMode] = useState('total');
  const [range, setRange] = useState('30');

  const sliced = data.slice(-parseInt(range, 10));
  const key =
    mode === 'total' ? 'total' : mode === 'gained' ? 'gained' : mode === 'lost' ? 'lost' : 'net';
  const color = mode === 'lost' ? '#F0625D' : mode === 'gained' ? '#3DDC97' : '#7C7CF5';

  return (
    <Card className="col-span-12 xl:col-span-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <p className="accent-label mb-1">Crecimiento</p>
          <h3 className="font-extrabold">📈 Evolución diaria de seguidores</h3>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Tabs
            size="sm"
            tabs={[
              { value: 'total', label: 'Totales' },
              { value: 'gained', label: 'Ganados' },
              { value: 'lost', label: 'Perdidos' },
              { value: 'net', label: 'Netos' },
            ]}
            active={mode}
            onChange={setMode}
          />
          <Tabs
            size="sm"
            tabs={[
              { value: '7', label: '7d' },
              { value: '14', label: '14d' },
              { value: '30', label: '30d' },
              { value: '60', label: '60d' },
            ]}
            active={range}
            onChange={setRange}
          />
        </div>
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={sliced}>
          <defs>
            <linearGradient id="followersFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#1E1E2E" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: '#8B8B9E', fontSize: 11 }}
            tickFormatter={(d: string) => d.slice(5)}
            axisLine={false}
            tickLine={false}
            minTickGap={30}
          />
          <YAxis
            tick={{ fill: '#8B8B9E', fontSize: 11 }}
            tickFormatter={(v: number) => fmtInt(v)}
            axisLine={false}
            tickLine={false}
            width={52}
            domain={mode === 'total' ? ['dataMin - 100', 'dataMax + 100'] : undefined}
          />
          <Tooltip contentStyle={tooltipStyle} />
          <Area
            type="monotone"
            dataKey={key}
            stroke={color}
            strokeWidth={2.5}
            fill="url(#followersFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </Card>
  );
}

// ── 🍩 Qué genera reacciones ──────────────────────────────────
export function ReactionsDonut({
  data,
  er,
}: {
  data: MetricsResponse['reactions'];
  er: number;
}) {
  const total = data.reduce((a, d) => a + d.value, 0);
  return (
    <Card className="col-span-12 md:col-span-6 xl:col-span-4">
      <p className="accent-label mb-1">Interacción</p>
      <h3 className="font-extrabold mb-2">🍩 Qué genera reacciones</h3>
      <div className="relative">
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={62}
              outerRadius={88}
              paddingAngle={3}
              strokeWidth={0}
            >
              {data.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(v: number, name: string) => [
                `${fmtInt(v)} (${((v / total) * 100).toFixed(1)}%)`,
                name,
              ]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-2xl font-extrabold">{fmtPct(er)}</span>
          <span className="text-[10px] uppercase tracking-wider text-muted">ER</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-2">
        {data.map((d) => (
          <div key={d.name} className="flex items-center gap-2 text-xs">
            <span className="h-2 w-2 rounded-full" style={{ background: d.color }} />
            <span className="text-muted">{d.name}</span>
            <span className="ml-auto font-semibold">
              {total ? ((d.value / total) * 100).toFixed(0) : 0}%
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── 📊 Alcance por formato ────────────────────────────────────
export function FormatBar({ data }: { data: MetricsResponse['reachByFormat'] }) {
  const colors = ['#7C7CF5', '#EC5B9A', '#F59E4B', '#3DDC97'];
  return (
    <Card className="col-span-12 md:col-span-6 xl:col-span-4">
      <p className="accent-label mb-1">Formatos</p>
      <h3 className="font-extrabold mb-4">📊 Alcance por formato</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} layout="vertical" margin={{ left: 8 }}>
          <CartesianGrid stroke="#1E1E2E" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fill: '#8B8B9E', fontSize: 11 }}
            tickFormatter={(v: number) => fmtInt(v)}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="format"
            tick={{ fill: '#C7C7D6', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={80}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(v: number) => [fmtInt(v), 'Alcance']}
            cursor={{ fill: 'rgba(124,124,245,0.06)' }}
          />
          <Bar dataKey="reach" radius={[0, 8, 8, 0]} barSize={22}>
            {data.map((_, i) => (
              <Cell key={i} fill={colors[i % colors.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}
