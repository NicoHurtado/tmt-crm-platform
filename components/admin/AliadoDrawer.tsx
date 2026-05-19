'use client';

import { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

const TIPO_COLORS: Record<string, string> = {
  HOTEL: 'bg-blue-100 text-blue-700',
  AGENCIA: 'bg-green-100 text-green-700',
  AIRBNB: 'bg-pink-100 text-pink-700',
};

const ESTADO_COLORS: Record<string, string> = {
  CONFIRMED_UNASSIGNED: 'bg-yellow-100 text-yellow-700',
  CONFIRMED_ASSIGNED: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-purple-100 text-purple-700',
  COMPLETED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
  PENDING_PAYMENT: 'bg-gray-100 text-gray-600',
  PAYMENT_FAILED: 'bg-red-100 text-red-700',
};

const ESTADO_LABELS: Record<string, string> = {
  CONFIRMED_UNASSIGNED: 'Confirmada',
  CONFIRMED_ASSIGNED: 'Asignada',
  IN_PROGRESS: 'En curso',
  COMPLETED: 'Completada',
  CANCELLED: 'Cancelada',
  PENDING_PAYMENT: 'Pend. pago',
  PAYMENT_FAILED: 'Pago fallido',
};

type ReservaRow = {
  id: string;
  codigo: string;
  fecha: string;
  estado: string;
  precioTotal: number | string;
  comisionAliado: number | string | null;
  servicio?: { nombre: unknown };
};

interface AliadoDrawerProps {
  aliadoId: string | null;
  aliadoNombre: string;
  aliadoTipo: string;
  open: boolean;
  onClose: () => void;
}

function getServicioNombre(nombre: unknown): string {
  if (!nombre) return 'Sin servicio';
  if (typeof nombre === 'object') {
    const n = nombre as Record<string, string>;
    return n.es || n.en || 'Sin nombre';
  }
  return String(nombre);
}

export function AliadoDrawer({
  aliadoId,
  aliadoNombre,
  aliadoTipo,
  open,
  onClose,
}: AliadoDrawerProps) {
  const [reservas, setReservas] = useState<ReservaRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;

  const fetchReservas = async (signal: AbortSignal) => {
    if (!aliadoId) return;
    setLoading(true);
    setError(null);
    setReservas([]);
    try {
      const res = await fetch(`/api/aliados/${aliadoId}/reservas`, { signal });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data = await res.json();
      setReservas(data.reservas ?? data ?? []);
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setError('No se pudieron cargar las reservas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open || !aliadoId) return;
    setPage(0);
    const controller = new AbortController();
    fetchReservas(controller.signal);
    return () => controller.abort();
  }, [open, aliadoId]);

  const totalIngresos = reservas.reduce(
    (s, r) => s + Number(r.precioTotal || 0),
    0,
  );
  const totalComision = reservas.reduce(
    (s, r) => s + Number(r.comisionAliado || 0),
    0,
  );

  const paged = reservas.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(reservas.length / PAGE_SIZE);

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="mb-4">
          <div className="flex items-center gap-3">
            <SheetTitle className="text-xl">{aliadoNombre}</SheetTitle>
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                TIPO_COLORS[aliadoTipo] ?? 'bg-gray-100 text-gray-600'
              }`}
            >
              {aliadoTipo}
            </span>
          </div>
        </SheetHeader>

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: 'Reservas', value: reservas.length.toString() },
            {
              label: 'Ingresos',
              value: `$${totalIngresos.toLocaleString('es-CO')}`,
            },
            {
              label: 'Comisión',
              value: `$${totalComision.toLocaleString('es-CO')}`,
            },
          ].map((kpi) => (
            <div
              key={kpi.label}
              className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center"
            >
              <p className="text-xs text-gray-500 mb-1">{kpi.label}</p>
              <p className="text-lg font-bold text-gray-900">{kpi.value}</p>
            </div>
          ))}
        </div>

        {/* Reservas table */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#D6A75D]" />
          </div>
        ) : error ? (
          <p className="text-center text-red-500 py-12">{error}</p>
        ) : reservas.length === 0 ? (
          <p className="text-center text-gray-500 py-12">Sin reservas registradas</p>
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {['Código', 'Fecha', 'Servicio', 'Precio', 'Comisión', 'Estado'].map(
                      (h) => (
                        <th
                          key={h}
                          className="text-left px-3 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wide"
                        >
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paged.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-mono text-xs text-gray-600">
                        {r.codigo}
                      </td>
                      <td className="px-3 py-2 text-gray-700">
                        {new Date(r.fecha).toLocaleDateString('es-CO')}
                      </td>
                      <td className="px-3 py-2 text-gray-700 max-w-[140px] truncate">
                        {getServicioNombre(r.servicio?.nombre)}
                      </td>
                      <td className="px-3 py-2 text-gray-900 font-medium">
                        ${Number(r.precioTotal).toLocaleString('es-CO')}
                      </td>
                      <td className="px-3 py-2 text-gray-700">
                        ${Number(r.comisionAliado || 0).toLocaleString('es-CO')}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            ESTADO_COLORS[r.estado] ?? 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {ESTADO_LABELS[r.estado] ?? r.estado}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-3 text-sm text-gray-600">
                <span>
                  Página {page + 1} de {totalPages}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="px-3 py-1 border rounded disabled:opacity-40"
                  >
                    ← Ant
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                    className="px-3 py-1 border rounded disabled:opacity-40"
                  >
                    Sig →
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
