'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { getLocalizedText } from '@/types/multi-language';
import { FiChevronDown, FiChevronUp } from 'react-icons/fi';

// ─── Types ────────────────────────────────────────────────────────────────────

type TipoComision = 'PORCENTAJE' | 'FIJO';

interface VehiculoConfig {
  vehiculoId: string;
  nombre: string;
  capacidadMinima: number;
  capacidadMaxima: number;
  precioServicio: number;        // PrecioVehiculoAliado.precioBase (precio base configurable por aliado)
  activo: boolean;
  tipoComision: TipoComision;
  comisionValor: number;
}

interface ServicioConfig {
  servicioId: string;
  nombre: any;
  esCompartido: boolean;
  esMunicipal: boolean;
  activo: boolean;
  vehiculos: VehiculoConfig[];
}

interface ConfiguracionPreciosProps {
  aliadoId: string;
  onClose: () => void;
  onSave: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return `$${Number(n).toLocaleString('es-CO')}`;
}

function calcComisionMonto(base: number, tipo: TipoComision, valor: number): number {
  if (tipo === 'PORCENTAJE') return Math.round(base * (valor / 100));
  return Math.round(valor);
}

function snapshotOf(s: ServicioConfig): string {
  return JSON.stringify({
    activo: s.activo,
    vehiculos: s.vehiculos.map(v => ({
      vehiculoId: v.vehiculoId,
      activo: v.activo,
      precioServicio: v.precioServicio,
      tipoComision: v.tipoComision,
      comisionValor: v.comisionValor,
    })),
  });
}

// ─── Shared table header ──────────────────────────────────────────────────────

function TableHeader({ isGreen = false }: { isGreen?: boolean }) {
  const th = `text-xs font-semibold px-4 py-3 text-left ${isGreen ? 'text-green-800' : 'text-neutral-500'}`;
  return (
    <thead>
      <tr className={`border-b ${isGreen ? 'border-green-200 bg-green-50' : 'border-neutral-200 bg-neutral-50'}`}>
        <th className={`${th} w-[32%]`}>Servicio / Vehículo</th>
        <th className={`${th} w-16 text-center`}>Activo</th>
        <th className={`${th} w-32`}>Tipo comisión</th>
        <th className={`${th} w-28`}>Valor comisión</th>
        <th className={`${th} w-32 text-right`}>Precio servicio</th>
        <th className={`${th} w-28 text-right`}>Comisión</th>
        <th className={`${th} text-right`}>Precio final</th>
      </tr>
    </thead>
  );
}

// ─── Vehicle checkbox ─────────────────────────────────────────────────────────

function VehicleCheckbox({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all
        ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:border-amber-400 hover:bg-amber-50'}
        ${checked && !disabled ? 'bg-amber-500 border-amber-500' : 'bg-white border-neutral-400 shadow-sm'}
      `}
    >
      {checked && (
        <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
          <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ConfiguracionPrecios({ aliadoId, onClose, onSave }: ConfiguracionPreciosProps) {
  const [servicios, setServicios] = useState<ServicioConfig[]>([]);
  const [municipalSectionExpanded, setMunicipalSectionExpanded] = useState(false);
  const [expandedServices, setExpandedServices] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const initialRef = useRef<Map<string, string>>(new Map());

  const fetchData = useCallback(async () => {
    try {
      const resServicios = await fetch(`/api/aliados/${aliadoId}/servicios`);
      const dataServicios = await resServicios.json();
      const rawList: any[] = Array.isArray(dataServicios)
        ? dataServicios
        : dataServicios.data || [];

      const mapped: ServicioConfig[] = rawList.map((s: any) => ({
        servicioId: s.servicioId,
        nombre: s.nombre,
        esCompartido: s.esCompartido ?? false,
        esMunicipal: s.esMunicipal ?? false,
        activo: s.activo ?? false,
        vehiculos: [...(s.vehiculos || [])].sort(
          (a: any, b: any) => (a.capacidadMinima ?? 0) - (b.capacidadMinima ?? 0)
        ).map((v: any) => ({
          vehiculoId: v.vehiculoId,
          nombre: v.nombre,
          capacidadMinima: v.capacidadMinima ?? 0,
          capacidadMaxima: v.capacidadMaxima ?? 0,
          precioServicio: Number(v.precioServicio ?? 0),
          activo: v.activo ?? false,
          tipoComision: (v.tipoComision as TipoComision) || 'PORCENTAJE',
          comisionValor: Number(v.comisionValor ?? 0),
        })),
      }));
      setServicios(mapped);
      setExpandedServices(new Set());
      const snapshot = new Map<string, string>();
      mapped.forEach(s => snapshot.set(s.servicioId, snapshotOf(s)));
      initialRef.current = snapshot;
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, [aliadoId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const updateServicio = (servicioId: string, patch: Partial<ServicioConfig>) =>
    setServicios(prev => prev.map(s => s.servicioId === servicioId ? { ...s, ...patch } : s));

  const updateVehiculo = (servicioId: string, vehiculoId: string, patch: Partial<VehiculoConfig>) =>
    setServicios(prev =>
      prev.map(s => s.servicioId !== servicioId ? s : {
        ...s,
        vehiculos: s.vehiculos.map(v => v.vehiculoId === vehiculoId ? { ...v, ...patch } : v),
      })
    );

  const toggleExpanded = (servicioId: string) =>
    setExpandedServices(prev => {
      const next = new Set(prev);
      next.has(servicioId) ? next.delete(servicioId) : next.add(servicioId);
      return next;
    });

  const handleSave = async () => {
    const changed = servicios.filter(s => initialRef.current.get(s.servicioId) !== snapshotOf(s));

    if (changed.length === 0) {
      onClose();
      return;
    }

    setSaving(true);
    try {
      const results = await Promise.allSettled(changed.map(s =>
        fetch(`/api/aliados/${aliadoId}/servicios`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            servicioId: s.servicioId,
            activo: s.activo,
            vehiculos: s.vehiculos.map(v => ({
              vehiculoId: v.vehiculoId,
              activo: v.activo,
              precioBase: v.precioServicio,
              tipoComision: v.tipoComision,
              comisionValor: v.comisionValor,
            })),
          }),
        })
      ));

      const failed = results.filter(r => r.status === 'rejected');
      if (failed.length > 0) {
        console.error('Error saving some servicios:', failed);
        alert(`Error al guardar ${failed.length} servicio(s). Por favor intenta de nuevo.`);
        await fetchData();
        return;
      }

      const newSnapshot = new Map<string, string>();
      servicios.forEach(s => newSnapshot.set(s.servicioId, snapshotOf(s)));
      initialRef.current = newSnapshot;

      onSave();
      onClose();
    } catch (error) {
      console.error('Error saving:', error);
      alert('Error al guardar la configuración');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-500" />
      </div>
    );
  }

  const regularServicios = servicios.filter(s => !s.esMunicipal);
  const municipalServicios = servicios.filter(s => s.esMunicipal);
  const activeMunicipalCount = municipalServicios.filter(s => s.activo).length;

  const renderServicioRows = (list: ServicioConfig[], isGreen = false) =>
    list.map(s => {
      const nombreStr = typeof s.nombre === 'string' ? s.nombre : getLocalizedText(s.nombre, 'ES');
      const dimCls = !s.activo ? 'opacity-40' : '';
      const isExpanded = expandedServices.has(s.servicioId);
      const hasVehicles = s.vehiculos.length > 0;

      return [
        /* ── Service row ─────────────────────────────────────────────────── */
        <tr
          key={`svc-${s.servicioId}`}
          className={`border-b ${isGreen ? 'border-green-100 bg-white' : 'border-neutral-100 bg-white'} ${dimCls}`}
        >
          <td className="px-4 py-3">
            <div className="flex items-center gap-2">
              {hasVehicles && (
                <button
                  type="button"
                  onClick={() => toggleExpanded(s.servicioId)}
                  className={`w-6 h-6 rounded flex items-center justify-center transition-colors shrink-0
                    ${isGreen ? 'text-green-600 hover:bg-green-100' : 'text-neutral-400 hover:bg-neutral-100'}`}
                  title={isExpanded ? 'Minimizar vehículos' : 'Ver vehículos'}
                >
                  {isExpanded ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />}
                </button>
              )}
              {!hasVehicles && <div className="w-6 shrink-0" />}
              <span className="font-semibold text-neutral-800 text-sm">{nombreStr}</span>
              {s.esCompartido && (
                <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5 font-medium">
                  Compartido
                </span>
              )}
              {hasVehicles && (
                <span className={`text-[10px] rounded-full px-2 py-0.5 font-medium tabular-nums
                  ${isGreen ? 'bg-green-50 text-green-700' : 'bg-neutral-100 text-neutral-500'}`}>
                  {s.vehiculos.filter(v => v.activo).length}/{s.vehiculos.length} veh.
                </span>
              )}
            </div>
          </td>

          <td className="px-4 py-3 text-center">
            <Switch
              checked={s.activo}
              onCheckedChange={v => updateServicio(s.servicioId, { activo: v })}
              className="scale-90"
            />
          </td>

          {/* Tipo / valor / precio / comisión / total se configuran por vehículo */}
          <td className="px-4 py-3 text-center text-[11px] text-neutral-300">—</td>
          <td className="px-4 py-3 text-center text-[11px] text-neutral-300">—</td>
          <td className="px-4 py-3 text-right text-[11px] text-neutral-300">↓ por vehículo</td>
          <td className="px-4 py-3 text-right text-[11px] text-neutral-300">—</td>
          <td className="px-4 py-3 text-right text-[11px] text-neutral-300">—</td>
        </tr>,

        /* ── Vehicle sub-rows (collapsible) ───────────────────────────────── */
        ...(isExpanded
          ? s.vehiculos.map(v => {
              const svcOff = !s.activo;
              const vehOff = !v.activo;
              const showTotals = !svcOff && !vehOff;

              const comisionMonto = calcComisionMonto(v.precioServicio, v.tipoComision, v.comisionValor);
              const precioFinal = v.precioServicio + comisionMonto;

              return (
                <tr
                  key={`veh-${s.servicioId}-${v.vehiculoId}`}
                  className={`border-b border-neutral-100 transition-colors
                    ${svcOff ? 'opacity-40 bg-neutral-50' : vehOff ? 'bg-white hover:bg-neutral-50/60' : 'bg-amber-50/20 hover:bg-amber-50/40'}
                  `}
                >
                  <td className="px-4 py-3 pl-12">
                    <div className="flex items-center gap-2">
                      <span className="text-neutral-300 text-xs shrink-0">↳</span>
                      <span className={`text-xs font-semibold ${vehOff && !svcOff ? 'text-neutral-500' : 'text-neutral-800'}`}>
                        {v.nombre}
                      </span>
                      <span className={`text-[11px] rounded-full px-2 py-0.5 font-medium
                        ${showTotals ? 'bg-amber-100 text-amber-700' : 'bg-neutral-100 text-neutral-500'}`}>
                        {v.capacidadMinima}–{v.capacidadMaxima} pax
                      </span>
                    </div>
                  </td>

                  <td className="px-4 py-3 text-center">
                    <div className="flex justify-center">
                      <VehicleCheckbox
                        checked={v.activo}
                        onChange={val => updateVehiculo(s.servicioId, v.vehiculoId, { activo: val })}
                        disabled={svcOff}
                      />
                    </div>
                  </td>

                  {/* Tipo comisión por vehículo */}
                  <td className="px-4 py-3">
                    <div className={`flex rounded-lg border overflow-hidden text-xs font-medium ${svcOff || vehOff ? 'opacity-50 pointer-events-none' : ''} ${isGreen ? 'border-green-200' : 'border-neutral-200'}`}>
                      {(['PORCENTAJE', 'FIJO'] as TipoComision[]).map(tipo => (
                        <button
                          key={tipo}
                          type="button"
                          onClick={() => updateVehiculo(s.servicioId, v.vehiculoId, { tipoComision: tipo })}
                          className={`flex-1 py-1 px-1.5 transition-colors whitespace-nowrap
                            ${v.tipoComision === tipo
                              ? 'bg-neutral-800 text-white'
                              : 'bg-white text-neutral-500 hover:bg-neutral-50'
                            }`}
                        >
                          {tipo === 'PORCENTAJE' ? '%' : '$'}
                        </button>
                      ))}
                    </div>
                  </td>

                  {/* Valor comisión por vehículo */}
                  <td className="px-4 py-3">
                    <div className={`flex items-center gap-1.5 border rounded-lg px-2 py-1 bg-white
                      ${svcOff || vehOff ? 'opacity-50' : ''}
                      ${isGreen ? 'border-green-200 focus-within:ring-1 focus-within:ring-green-400' : 'border-neutral-200 focus-within:ring-1 focus-within:ring-amber-400'}`}>
                      <span className={`text-xs font-semibold shrink-0 ${isGreen ? 'text-green-600' : 'text-amber-500'}`}>
                        {v.tipoComision === 'PORCENTAJE' ? '%' : '$'}
                      </span>
                      <input
                        type="number"
                        min={0}
                        max={v.tipoComision === 'PORCENTAJE' ? 100 : undefined}
                        value={v.comisionValor === 0 ? '' : v.comisionValor}
                        placeholder="0"
                        onChange={e => updateVehiculo(s.servicioId, v.vehiculoId, { comisionValor: parseFloat(e.target.value) || 0 })}
                        onFocus={e => e.target.select()}
                        disabled={svcOff || vehOff}
                        className="w-full text-xs bg-transparent outline-none text-neutral-800 placeholder-neutral-300 disabled:cursor-not-allowed [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>
                  </td>

                  {/* Precio servicio (editable — precio base por aliado) */}
                  <td className="px-4 py-3 text-right">
                    <div className={`flex items-center gap-1.5 border rounded-lg px-2 py-1 bg-white
                      ${svcOff || vehOff ? 'opacity-50' : ''}
                      ${isGreen ? 'border-green-200 focus-within:ring-1 focus-within:ring-green-400' : 'border-neutral-200 focus-within:ring-1 focus-within:ring-amber-400'}`}>
                      <span className={`text-xs font-semibold shrink-0 ${isGreen ? 'text-green-600' : 'text-neutral-500'}`}>
                        $
                      </span>
                      <input
                        type="number"
                        min={0}
                        value={v.precioServicio === 0 ? '' : v.precioServicio}
                        placeholder="0"
                        onChange={e => updateVehiculo(s.servicioId, v.vehiculoId, { precioServicio: parseFloat(e.target.value) || 0 })}
                        onFocus={e => e.target.select()}
                        disabled={svcOff || vehOff}
                        className="w-full text-xs bg-transparent outline-none text-neutral-800 placeholder-neutral-300 disabled:cursor-not-allowed text-right font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>
                  </td>

                  {/* Comisión calculada */}
                  <td className="px-4 py-3 text-right">
                    {showTotals ? (
                      <span className="text-xs font-mono text-amber-600 font-semibold">{fmt(comisionMonto)}</span>
                    ) : (
                      <span className="text-xs text-neutral-300">—</span>
                    )}
                  </td>

                  {/* Precio final del servicio (lo que ve el cliente) */}
                  <td className="px-4 py-3 text-right">
                    {showTotals ? (
                      <span className="text-sm font-bold text-neutral-900 font-mono">{fmt(precioFinal)}</span>
                    ) : (
                      <span className="text-xs text-neutral-400">—</span>
                    )}
                  </td>
                </tr>
              );
            })
          : []),
      ];
    });

  return (
    <div className="space-y-8">

      <div className="flex items-center gap-6 text-xs text-neutral-500">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-neutral-400" />
          Precio servicio
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-amber-500" />
          Comisión aliado
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-neutral-900" />
          Precio final
        </div>
        <span className="ml-4 text-neutral-400">Filas en gris = inactivo</span>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-neutral-900 mb-1">Servicios y vehículos</h3>
        <p className="text-xs text-neutral-400 mb-4">
          Activa servicios y configura el <strong>precio</strong> y la <strong>comisión</strong> de cada vehículo para este aliado.
          Estos precios aplican <strong>solo</strong> a reservas que lleguen por código o link de este aliado — son independientes del precio público del servicio.
          El precio final que ve el cliente = precio + comisión.
        </p>

        <div className="border border-neutral-200 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <TableHeader />
            <tbody>
              {regularServicios.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-xs text-neutral-400">
                    No hay servicios disponibles
                  </td>
                </tr>
              ) : renderServicioRows(regularServicios)}
            </tbody>
          </table>
        </div>
      </div>

      {municipalServicios.length > 0 && (
        <div>
          <div className="border border-neutral-200 rounded-xl overflow-hidden shadow-sm">
            <button
              type="button"
              className="w-full px-6 py-4 bg-neutral-50 hover:bg-neutral-100 transition-colors text-left"
              onClick={() => setMunicipalSectionExpanded(v => !v)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-neutral-800">Transportes Municipales</p>
                  <p className="text-xs text-neutral-500">
                    {activeMunicipalCount} de {municipalServicios.length} activos
                  </p>
                </div>
                {municipalSectionExpanded
                  ? <FiChevronUp className="text-neutral-400" size={18} />
                  : <FiChevronDown className="text-neutral-400" size={18} />}
              </div>
            </button>

            {municipalSectionExpanded && (
              <table className="w-full text-sm">
                <TableHeader />
                <tbody>
                  {renderServicioRows(municipalServicios)}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      <div className="flex justify-end gap-3 pt-4 border-t border-neutral-200">
        <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>
          Cancelar
        </Button>
        <Button size="sm" onClick={handleSave} disabled={saving} className="min-w-[160px]">
          {saving ? 'Guardando...' : 'Guardar configuración'}
        </Button>
      </div>
    </div>
  );
}
