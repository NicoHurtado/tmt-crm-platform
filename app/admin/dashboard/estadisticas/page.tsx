'use client';

import { useState, useEffect, useMemo } from 'react';
import { AliadoDrawer } from '@/components/admin/AliadoDrawer';
import { SociosStatsPanel } from '@/components/admin/SociosStatsPanel';
import {
  FiCalendar,
  FiDollarSign,
  FiUsers,
  FiCreditCard,
  FiTrendingUp,
  FiBarChart2,
  FiGrid,
  FiLink,
} from 'react-icons/fi';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const COLORS = ['#D6A75D', '#64748B', '#10B981', '#6366F1', '#EF4444', '#8B5CF6'];

const TIPO_SERVICIO_LABELS: Record<string, string> = {
  TRANSPORTE_AEROPUERTO: 'Aeropuerto',
  CITY_TOUR: 'City Tour',
  TOUR_GUATAPE: 'Guatapé',
  TOUR_COMPARTIDO: 'Tour Compartido',
  TRANSPORTE_MUNICIPAL: 'Municipal',
  TRANSPORTE_POR_HORAS: 'Por horas',
  TRASLADO: 'Traslado',
  OTRO: 'Otro',
};

const TIPO_ALIADO_COLORS: Record<string, string> = {
  HOTEL: 'bg-blue-100 text-blue-700',
  AGENCIA: 'bg-green-100 text-green-700',
  AIRBNB: 'bg-pink-100 text-pink-700',
};

type MonthPoint = { mes: string; cantidad?: number; ingresos?: number };
type MesPersonas = { mes: string; personas: number };
type MesComision = { mes: string; comision: number };
type ServicePoint = { nombre: string; cantidad: number };
type TipoPoint = { tipo: string; cantidad: number };
type CapacidadPoint = { capacidad: string; reservas: number; personas: number };
type AliadoStat = {
  id: string;
  nombre: string;
  tipo: string;
  reservas: number;
  ingresos: number;
  comision: number;
};

type StatsData = {
  totalReservas: number;
  personasTransportadas: number;
  ingresosTotales: number;
  comisionTotalGeneral: number;
  reservasPorMes: MonthPoint[];
  reservasTarjeta: number;
  reservasEfectivo: number;
  reservasPorServicio: ServicePoint[];
  reservasPorTipo: TipoPoint[];
  personasPorCapacidad: CapacidadPoint[];
  pagosBold: number;
  pagosEfectivo: number;
  comisionesHotel: number;
  comisionesAirbnb: number;
  clientePagaCount: number;
  clienteNoPagaCount: number;
  ingresosPorMes: MonthPoint[];
  personasPorMes: MesPersonas[];
  comisionPorMes: MesComision[];
  aliadosStats: AliadoStat[];
};

const TABS = [
  { name: 'Resumen',    icon: FiGrid       },
  { name: 'Servicios',  icon: FiBarChart2  },
  { name: 'Financiero', icon: FiDollarSign },
  { name: 'Aliados',    icon: FiUsers      },
  { name: 'Socios API', icon: FiLink       },
] as const;
type TabName = (typeof TABS)[number]['name'];

function truncate(str: string, max = 22): string {
  return str.length > max ? str.slice(0, max) + '…' : str;
}

interface TickProps {
  x?: number;
  y?: number;
  payload?: { value: string };
}

function TruncatedTick({ x = 0, y = 0, payload }: TickProps) {
  if (!payload) return null;
  return (
    <text x={x} y={y} dy={4} textAnchor="end" fill="#6b7280" fontSize={11}>
      {truncate(payload.value)}
    </text>
  );
}

function formatMes(mes: string): string {
  const [year, mon] = mes.split('-');
  const d = new Date(Number(year), Number(mon) - 1, 1);
  return d.toLocaleDateString('es-CO', { month: 'short', year: '2-digit' });
}

function formatCOP(value: number): string {
  return `$${Math.round(value).toLocaleString('es-CO')}`;
}

function KpiCard({
  label,
  value,
  sparklineData,
  sparklineKey,
}: {
  label: string;
  value: string;
  sparklineData: Array<Record<string, unknown>>;
  sparklineKey: string;
}) {
  const last = sparklineData.length;
  const prev = last >= 2 ? Number(sparklineData[last - 2][sparklineKey] ?? 0) : 0;
  const curr = last >= 1 ? Number(sparklineData[last - 1][sparklineKey] ?? 0) : 0;
  const trend = prev > 0 ? Math.round(((curr - prev) / prev) * 100) : null;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center justify-between gap-4">
      <div className="flex flex-col gap-2 min-w-0">
        <p className="text-xs font-medium text-gray-400 leading-none">{label}</p>
        <p className="text-2xl font-bold text-gray-900 tracking-tight leading-none">{value}</p>
        {trend !== null && (
          <span
            className={`text-xs font-semibold px-2 py-0.5 rounded-full w-fit ${
              trend >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'
            }`}
          >
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div className="flex-shrink-0 w-[110px] h-[60px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={sparklineData} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
            <defs>
              <linearGradient id={`grad-${sparklineKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#D6A75D" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#D6A75D" stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey={sparklineKey}
              stroke="#D6A75D"
              strokeWidth={2}
              fill={`url(#grad-${sparklineKey})`}
              dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function CapacidadSection({ data }: { data: CapacidadPoint[] }) {
  const totalPersonas = data.reduce((s, d) => s + d.personas, 0) || 1;

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="px-0 pt-0 pb-3">
          <h3 className="text-sm font-semibold text-gray-700">
            Personas transportadas por capacidad de vehículo
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">Acumulado del período seleccionado</p>
        </div>
        <p className="text-sm text-gray-400 text-center py-4">
          No hay reservas con vehículo asignado en este período
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-6 pt-5 pb-3 border-b border-gray-50">
        <h3 className="text-sm font-semibold text-gray-700">
          Personas transportadas por capacidad de vehículo
        </h3>
        <p className="text-xs text-gray-400 mt-0.5">Acumulado del período seleccionado</p>
      </div>
      <div className="divide-y divide-gray-50">
        {data.map((row) => {
          const pct = Math.round((row.personas / totalPersonas) * 100);
          return (
            <div key={row.capacidad} className="px-6 py-4 flex items-center gap-4">
              <span className="bg-amber-50 text-[#D6A75D] rounded-full px-3 py-1 text-xs font-semibold w-24 text-center flex-shrink-0">
                {row.capacidad}
              </span>
              <div className="flex items-center gap-5 text-sm flex-shrink-0">
                <span className="flex items-center gap-1.5 text-gray-500">
                  <FiCalendar size={12} className="text-gray-400" />
                  <span className="font-semibold text-gray-700">
                    {row.reservas.toLocaleString('es-CO')}
                  </span>
                  <span className="text-xs text-gray-400">reservas</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <FiUsers size={12} className="text-[#D6A75D]" />
                  <span className="font-bold text-gray-900">
                    {row.personas.toLocaleString('es-CO')}
                  </span>
                  <span className="text-xs text-gray-400">personas</span>
                </span>
              </div>
              <div className="flex-1 flex items-center gap-2">
                <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                  <div
                    className="h-1.5 rounded-full bg-[#D6A75D] transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-xs text-gray-400 w-8 text-right flex-shrink-0">{pct}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ChartCard({
  title,
  children,
  className = '',
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden ${className}`}>
      <div className="px-6 pt-5 pb-3">
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
      </div>
      <div className="px-4 pb-5">{children}</div>
    </div>
  );
}

export default function EstadisticasPage() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<TabName>('Resumen');
  const [drawerAliado, setDrawerAliado] = useState<{
    id: string;
    nombre: string;
    tipo: string;
  } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const qs = selectedMonth !== 'all' ? `?month=${selectedMonth}` : '';
        const res = await fetch(`/api/admin/estadisticas${qs}`, { signal: controller.signal });
        if (!res.ok) throw new Error(`Error ${res.status}`);
        setStats(await res.json());
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
        setError('No se pudieron cargar las estadísticas');
      } finally {
        setLoading(false);
      }
    };
    load();
    return () => controller.abort();
  }, [selectedMonth]);

  const monthOptions = useMemo(() => {
    const options = [{ value: 'all', label: 'Histórico (Todos los meses)' }];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const label = date.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
      options.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) });
    }
    return options;
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#D6A75D] mx-auto" />
          <p className="mt-4 text-gray-600">Cargando estadísticas...</p>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-red-500">{error ?? 'Sin datos'}</p>
      </div>
    );
  }

  const reservasPorMesFormatted = stats.reservasPorMes.map((p) => ({
    ...p,
    mes: formatMes(p.mes),
  }));

  const ingresosPorMesFormatted = stats.ingresosPorMes.map((p) => ({
    ...p,
    mes: formatMes(p.mes),
  }));

  const pieData = [
    { name: 'Tarjeta', value: stats.reservasTarjeta },
    { name: 'Efectivo', value: stats.reservasEfectivo },
  ];

  const reservasPorTipoFormatted = stats.reservasPorTipo.map((p) => ({
    tipo: TIPO_SERVICIO_LABELS[p.tipo] ?? p.tipo,
    cantidad: p.cantidad,
  }));

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="px-6 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Estadísticas</h1>
              <p className="text-xs text-gray-400 mt-0.5">Análisis y métricas del negocio</p>
            </div>
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
              <FiCalendar className="text-[#D6A75D] flex-shrink-0" size={15} />
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-transparent text-sm text-gray-700 focus:outline-none cursor-pointer"
              >
                {monthOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </header>

      {/* Tab nav */}
      <div className="bg-white border-b border-gray-200 px-6">
        <div className="flex gap-0 overflow-x-auto">
          {TABS.map(({ name, icon: Icon }) => (
            <button
              key={name}
              type="button"
              onClick={() => setActiveTab(name)}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm border-b-2 whitespace-nowrap transition-colors ${
                activeTab === name
                  ? 'border-[#D6A75D] text-[#D6A75D] font-semibold'
                  : 'border-transparent text-gray-400 font-medium hover:text-gray-600 hover:border-gray-200'
              }`}
            >
              <Icon size={14} />
              {name}
            </button>
          ))}
        </div>
      </div>

      <main className="px-6 py-6 space-y-5">
        {/* ── TAB: RESUMEN ─────────────────────────────────── */}
        {activeTab === 'Resumen' && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard
                label="Reservas Totales"
                value={stats.totalReservas.toLocaleString('es-CO')}
                sparklineData={stats.reservasPorMes as Array<Record<string, unknown>>}
                sparklineKey="cantidad"
              />
              <KpiCard
                label="Personas Transportadas"
                value={stats.personasTransportadas.toLocaleString('es-CO')}
                sparklineData={stats.personasPorMes as Array<Record<string, unknown>>}
                sparklineKey="personas"
              />
              <KpiCard
                label="Ingresos Totales"
                value={formatCOP(stats.ingresosTotales)}
                sparklineData={stats.ingresosPorMes as Array<Record<string, unknown>>}
                sparklineKey="ingresos"
              />
              <KpiCard
                label="Comisión Total"
                value={formatCOP(stats.comisionTotalGeneral)}
                sparklineData={stats.comisionPorMes as Array<Record<string, unknown>>}
                sparklineKey="comision"
              />
            </div>

            <CapacidadSection data={stats.personasPorCapacidad} />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <ChartCard title="Reservas por mes (histórico)">
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={reservasPorMesFormatted}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="mes"
                      tick={{ fontSize: 11, fill: '#9ca3af' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#9ca3af' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: 12 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="cantidad"
                      stroke="#D6A75D"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: '#D6A75D' }}
                      activeDot={{ r: 5 }}
                      name="Reservas"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Método de pago">
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="46%"
                      outerRadius={85}
                      innerRadius={45}
                      dataKey="value"
                      paddingAngle={3}
                    >
                      {pieData.map((entry, i) => (
                        <Cell key={entry.name} fill={i === 0 ? '#D6A75D' : '#64748B'} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: 12 }}
                      formatter={(v: number) => [v, '']}
                    />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>
          </>
        )}

        {/* ── TAB: SERVICIOS ───────────────────────────────── */}
        {activeTab === 'Servicios' && (
          <>
            {stats.reservasPorServicio[0] && (
              <div className="flex items-center gap-3 bg-amber-50 border border-amber-100 rounded-xl px-5 py-3.5">
                <div className="p-1.5 bg-amber-100 rounded-lg">
                  <FiBarChart2 className="text-[#D6A75D]" size={16} />
                </div>
                <p className="text-sm text-gray-600">
                  Servicio más solicitado:{' '}
                  <span className="font-semibold text-gray-900">
                    {stats.reservasPorServicio[0].nombre}
                  </span>
                  <span className="ml-2 text-xs bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full font-medium">
                    {stats.reservasPorServicio[0].cantidad} reservas
                  </span>
                </p>
              </div>
            )}

            {/* Full-width: Reservas por servicio — dynamic height so all rows fit */}
            <ChartCard title="Reservas por servicio">
              <ResponsiveContainer
                width="100%"
                height={Math.max(260, stats.reservasPorServicio.length * 34 + 20)}
              >
                <BarChart
                  data={stats.reservasPorServicio}
                  layout="vertical"
                  margin={{ top: 0, right: 60, bottom: 0, left: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: '#9ca3af' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    dataKey="nombre"
                    type="category"
                    width={168}
                    tick={<TruncatedTick />}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: 12 }}
                    formatter={(v: number) => [v.toLocaleString('es-CO'), 'Reservas']}
                  />
                  <Bar dataKey="cantidad" name="Reservas" radius={[0, 6, 6, 0]} barSize={18}>
                    {stats.reservasPorServicio.map((_, i) => (
                      <Cell key={i} fill={i === 0 ? '#D6A75D' : '#E8C98A'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* Two-col: tipo (horizontal) + capacidad (grouped) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Reservas por tipo — horizontal bars, one color per tipo */}
              <ChartCard title="Reservas por tipo de servicio">
                <ResponsiveContainer
                  width="100%"
                  height={Math.max(220, reservasPorTipoFormatted.length * 48 + 20)}
                >
                  <BarChart
                    data={reservasPorTipoFormatted}
                    layout="vertical"
                    margin={{ top: 0, right: 48, bottom: 0, left: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 11, fill: '#9ca3af' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      dataKey="tipo"
                      type="category"
                      width={90}
                      tick={{ fontSize: 12, fill: '#374151' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: 12 }}
                      formatter={(v: number) => [v.toLocaleString('es-CO'), 'Reservas']}
                    />
                    <Bar dataKey="cantidad" name="Reservas" radius={[0, 6, 6, 0]} barSize={22}>
                      {reservasPorTipoFormatted.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              {/* Reservas por capacidad — grouped: reservas + personas */}
              <ChartCard title="Reservas y personas por capacidad">
                {stats.personasPorCapacidad.length === 0 ? (
                  <p className="text-gray-400 text-sm py-8 text-center">
                    No hay reservas con vehículo asignado en este período
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height={Math.max(220, stats.personasPorCapacidad.length * 48 + 60)}>
                    <BarChart
                      data={stats.personasPorCapacidad}
                      margin={{ top: 0, right: 8, bottom: 0, left: 0 }}
                      barCategoryGap="30%"
                      barGap={3}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                      <XAxis
                        dataKey="capacidad"
                        tick={{ fontSize: 12, fill: '#374151', fontWeight: 500 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: '#9ca3af' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: 12 }}
                        formatter={(v: number, name: string) => [
                          v.toLocaleString('es-CO'),
                          name,
                        ]}
                      />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="reservas" name="Reservas" fill="#D6A75D" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="personas" name="Personas" fill="#6366F1" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>
            </div>
          </>
        )}

        {/* ── TAB: FINANCIERO ──────────────────────────────── */}
        {activeTab === 'Financiero' && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard
                label="Pagos Bold (online)"
                value={formatCOP(stats.pagosBold)}
                sparklineData={stats.ingresosPorMes as Array<Record<string, unknown>>}
                sparklineKey="ingresos"
              />
              <KpiCard
                label="Pagos Efectivo"
                value={formatCOP(stats.pagosEfectivo)}
                sparklineData={stats.ingresosPorMes as Array<Record<string, unknown>>}
                sparklineKey="ingresos"
              />
              <KpiCard
                label="Reservas Tarjeta"
                value={stats.reservasTarjeta.toLocaleString('es-CO')}
                sparklineData={stats.reservasPorMes as Array<Record<string, unknown>>}
                sparklineKey="cantidad"
              />
              <KpiCard
                label="Reservas Efectivo"
                value={stats.reservasEfectivo.toLocaleString('es-CO')}
                sparklineData={stats.reservasPorMes as Array<Record<string, unknown>>}
                sparklineKey="cantidad"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <KpiCard
                label="Cliente Paga"
                value={stats.clientePagaCount.toLocaleString('es-CO')}
                sparklineData={stats.reservasPorMes as Array<Record<string, unknown>>}
                sparklineKey="cantidad"
              />
              <KpiCard
                label="Cliente No Paga"
                value={stats.clienteNoPagaCount.toLocaleString('es-CO')}
                sparklineData={stats.reservasPorMes as Array<Record<string, unknown>>}
                sparklineKey="cantidad"
              />
              <KpiCard
                label="Total vía Aliados"
                value={(stats.clientePagaCount + stats.clienteNoPagaCount).toLocaleString('es-CO')}
                sparklineData={stats.reservasPorMes as Array<Record<string, unknown>>}
                sparklineKey="cantidad"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <ChartCard title="Ingresos por mes (histórico)">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={ingresosPorMesFormatted}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis
                      dataKey="mes"
                      tick={{ fontSize: 11, fill: '#9ca3af' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#9ca3af' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v: number) => `$${(v / 1000000).toFixed(0)}M`}
                    />
                    <Tooltip
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: 12 }}
                      formatter={(v: number) => [formatCOP(v), 'Ingresos']}
                    />
                    <Bar dataKey="ingresos" fill="#D6A75D" name="Ingresos" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Comisiones por tipo de aliado">
                <div className="space-y-3 pt-1">
                  {[
                    {
                      label: 'Hoteles / Agencias',
                      value: stats.comisionesHotel,
                      dot: 'bg-blue-400',
                      bar: 'bg-blue-50',
                    },
                    {
                      label: 'Airbnb',
                      value: stats.comisionesAirbnb,
                      dot: 'bg-pink-400',
                      bar: 'bg-pink-50',
                    },
                    {
                      label: 'Total comisiones',
                      value: stats.comisionesHotel + stats.comisionesAirbnb,
                      dot: 'bg-[#D6A75D]',
                      bar: 'bg-amber-50',
                    },
                  ].map((item) => {
                    const total = stats.comisionesHotel + stats.comisionesAirbnb || 1;
                    const pct =
                      item.label === 'Total comisiones'
                        ? 100
                        : Math.round((item.value / total) * 100);
                    return (
                      <div key={item.label} className={`p-4 rounded-xl ${item.bar}`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${item.dot}`} />
                            <span className="text-sm font-medium text-gray-700">{item.label}</span>
                          </div>
                          <span className="text-base font-bold text-gray-900">
                            {formatCOP(item.value)}
                          </span>
                        </div>
                        {item.label !== 'Total comisiones' && (
                          <div className="w-full bg-white/60 rounded-full h-1.5">
                            <div
                              className={`h-1.5 rounded-full ${item.dot}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ChartCard>
            </div>
          </>
        )}

        {/* ── TAB: ALIADOS ─────────────────────────────────── */}
        {activeTab === 'Aliados' && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">Rendimiento por aliado</h3>
              <span className="text-xs text-gray-400">{stats.aliadosStats.length} aliados</span>
            </div>
            {stats.aliadosStats.length === 0 ? (
              <p className="text-gray-400 text-sm py-12 text-center">
                No hay reservas de aliados en este período
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {['Aliado', 'Tipo', 'Reservas', 'Ingresos', 'Comisión', ''].map((h) => (
                        <th
                          key={h}
                          className="text-left px-5 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {stats.aliadosStats.map((a, idx) => (
                      <tr
                        key={a.id}
                        className={`hover:bg-amber-50/30 transition-colors ${
                          idx % 2 === 0 ? '' : 'bg-gray-50/30'
                        }`}
                      >
                        <td className="px-5 py-3.5 font-semibold text-gray-800">{a.nombre}</td>
                        <td className="px-5 py-3.5">
                          <span
                            className={`text-[11px] px-2.5 py-1 rounded-full font-semibold ${
                              TIPO_ALIADO_COLORS[a.tipo] ?? 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {a.tipo}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-gray-700 font-semibold">{a.reservas}</td>
                        <td className="px-5 py-3.5 font-semibold text-gray-900">
                          {formatCOP(a.ingresos)}
                        </td>
                        <td className="px-5 py-3.5 text-gray-500 font-medium">
                          {formatCOP(a.comision)}
                        </td>
                        <td className="px-5 py-3.5">
                          <button
                            type="button"
                            onClick={() =>
                              setDrawerAliado({ id: a.id, nombre: a.nombre, tipo: a.tipo })
                            }
                            className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:border-[#D6A75D] hover:text-[#D6A75D] font-medium transition-colors"
                          >
                            Ver reservas →
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
        {activeTab === 'Socios API' && <SociosStatsPanel />}
      </main>

      <AliadoDrawer
        aliadoId={drawerAliado?.id ?? null}
        aliadoNombre={drawerAliado?.nombre ?? ''}
        aliadoTipo={drawerAliado?.tipo ?? ''}
        open={drawerAliado !== null}
        onClose={() => setDrawerAliado(null)}
      />
    </div>
  );
}
