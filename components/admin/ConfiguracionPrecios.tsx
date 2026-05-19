'use client';

import { useState, useEffect, useCallback } from 'react';
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
  precioBase: number;
  activo: boolean;
}

interface ServicioConfig {
  servicioId: string;
  nombre: any;
  precioBase: number;
  esCompartido: boolean;
  esMunicipal: boolean;
  activo: boolean;
  tipoComision: TipoComision;
  comisionValor: number;
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

function calcComision(
  base: number,
  tipoComision: TipoComision,
  comisionValor: number
): number {
  if (tipoComision === 'PORCENTAJE') return Math.round(base * (comisionValor / 100));
  return comisionValor;
}

// ─── Shared table header ──────────────────────────────────────────────────────

function TableHeader({ isGreen = false }: { isGreen?: boolean }) {
  const th = `text-xs font-semibold px-4 py-3 text-left ${isGreen ? 'text-green-800' : 'text-neutral-500'}`;
  return (
    <thead>
      <tr className={`border-b ${isGreen ? 'border-green-200 bg-green-50' : 'border-neutral-200 bg-neutral-50'}`}>
        <th className={`${th} w-[28%]`}>Servicio / Vehículo</th>
        <th className={`${th} w-16 text-center`}>Activo</th>
        <th className={`${th} w-32`}>Tipo comisión</th>
        <th className={`${th} w-28`}>Valor comisión</th>
        <th className={`${th} w-32 text-right`}>Precio servicio</th>
        <th className={`${th} w-32 text-right`}>Precio vehículo</th>
        <th className={`${th} w-28 text-right`}>Comisión</th>
        <th className={`${th} text-right`}>Total cliente</th>
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

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    try {
      const resServicios = await fetch(`/api/aliados/${aliadoId}/servicios`);

      const dataServicios = await resServicios.json();
      const rawList: any[] = Array.isArray(dataServicios)
        ? dataServicios
        : dataServicios.data || [];

      const mapped = rawList.map((s: any) => ({
        servicioId: s.servicioId,
        nombre: s.nombre,
        precioBase: s.precioBase ?? 0,
        esCompartido: s.esCompartido ?? false,
        esMunicipal: s.esMunicipal ?? false,
        activo: s.activo ?? false,
        tipoComision: (s.tipoComision as TipoComision) || 'PORCENTAJE',
        comisionValor: s.comisionValor ?? 0,
        vehiculos: [...(s.vehiculos || [])].sort(
          (a: any, b: any) => (a.capacidadMinima ?? 0) - (b.capacidadMinima ?? 0)
        ).map((v: any) => ({
          vehiculoId: v.vehiculoId,
          nombre: v.nombre,
          capacidadMinima: v.capacidadMinima ?? 0,
          capacidadMaxima: v.capacidadMaxima ?? 0,
          precioBase: v.precioBase ?? 0,
          activo: v.activo ?? false,
        })),
      }));
      setServicios(mapped);
      setExpandedServices(new Set());
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, [aliadoId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Mutators ───────────────────────────────────────────────────────────────

  const updateServicio = (servicioId: string, patch: Partial<ServicioConfig>) =>
    setServicios(prev => prev.map(s => s.servicioId === servicioId ? { ...s, ...patch } : s));

  const updateVehiculo = (servicioId: string, vehiculoId: string, activo: boolean) =>
    setServicios(prev =>
      prev.map(s => s.servicioId !== servicioId ? s : {
        ...s,
        vehiculos: s.vehiculos.map(v => v.vehiculoId === vehiculoId ? { ...v, activo } : v),
      })
    );

  const toggleExpanded = (servicioId: string) =>
    setExpandedServices(prev => {
      const next = new Set(prev);
      next.has(servicioId) ? next.delete(servicioId) : next.add(servicioId);
      return next;
    });

  // ── Save ───────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const s of servicios) {
        await fetch(`/api/aliados/${aliadoId}/servicios`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            servicioId: s.servicioId,
            activo: s.activo,
            tipoComision: s.tipoComision,
            comisionValor: s.comisionValor,
            vehiculos: s.vehiculos.map(v => ({ vehiculoId: v.vehiculoId, activo: v.activo })),
          }),
        });
      }
      onSave();
      onClose();
    } catch (error) {
      console.error('Error saving:', error);
      alert('Error al guardar la configuración');
    } finally {
      setSaving(false);
    }
  };

  // ── Loading ────────────────────────────────────────────────────────────────

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

  // ── Reusable row renderer ──────────────────────────────────────────────────

  const renderServicioRows = (list: ServicioConfig[], isGreen = false) =>
    list.map(s => {
      const nombreStr = typeof s.nombre === 'string' ? s.nombre : getLocalizedText(s.nombre, 'ES');
      const dimCls = !s.activo ? 'opacity-40' : '';
      const inputCls = `text-xs border rounded px-2 py-1.5 bg-white focus:outline-none focus:ring-1 disabled:opacity-40 w-full ${
        isGreen ? 'border-green-200 focus:ring-green-400' : 'border-neutral-200 focus:ring-amber-400'
      }`;
      const isExpanded = expandedServices.has(s.servicioId);
      const hasVehicles = !s.esCompartido && s.vehiculos.length > 0;

      // commission computed on service base for compartido
      const comisionCompartido = s.esCompartido
        ? calcComision(s.precioBase, s.tipoComision, s.comisionValor)
        : null;
      const totalCompartido = s.esCompartido && comisionCompartido !== null
        ? s.precioBase + comisionCompartido
        : null;

      return [
        /* ── Service row ─────────────────────────────────────────────────── */
        <tr
          key={`svc-${s.servicioId}`}
          className={`border-b ${isGreen ? 'border-green-100 bg-white' : 'border-neutral-100 bg-white'} ${dimCls}`}
        >
          {/* Name + expand toggle */}
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
                  {isExpanded
                    ? <FiChevronUp size={14} />
                    : <FiChevronDown size={14} />}
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

          {/* Active — Switch for service */}
          <td className="px-4 py-3 text-center">
            <Switch
              checked={s.activo}
              onCheckedChange={v => updateServicio(s.servicioId, { activo: v })}
              className="scale-90"
            />
          </td>

          {/* Commission type */}
          <td className="px-4 py-3">
            <div className={`flex rounded-lg border overflow-hidden text-xs font-medium ${!s.activo ? 'opacity-40 pointer-events-none' : ''} ${isGreen ? 'border-green-200' : 'border-neutral-200'}`}>
              {(['PORCENTAJE', 'FIJO'] as TipoComision[]).map(tipo => (
                <button
                  key={tipo}
                  type="button"
                  onClick={() => updateServicio(s.servicioId, { tipoComision: tipo })}
                  className={`flex-1 py-1.5 px-2 transition-colors whitespace-nowrap
                    ${s.tipoComision === tipo
                      ? isGreen
                        ? 'bg-green-600 text-white'
                        : 'bg-neutral-800 text-white'
                      : isGreen
                        ? 'bg-white text-green-700 hover:bg-green-50'
                        : 'bg-white text-neutral-500 hover:bg-neutral-50'
                    }`}
                >
                  {tipo === 'PORCENTAJE' ? '% Porcentaje' : '$ Fijo'}
                </button>
              ))}
            </div>
          </td>

          {/* Commission value */}
          <td className="px-4 py-3">
            <div className={`flex items-center gap-1.5 border rounded-lg px-3 py-1.5 bg-white transition-colors
              ${!s.activo ? 'opacity-40' : ''}
              ${isGreen ? 'border-green-200 focus-within:ring-1 focus-within:ring-green-400' : 'border-neutral-200 focus-within:ring-1 focus-within:ring-amber-400'}`}>
              <span className={`text-xs font-semibold shrink-0 ${isGreen ? 'text-green-600' : 'text-amber-500'}`}>
                {s.tipoComision === 'PORCENTAJE' ? '%' : '$'}
              </span>
              <input
                type="number"
                min={0}
                max={s.tipoComision === 'PORCENTAJE' ? 100 : undefined}
                value={s.comisionValor === 0 ? '' : s.comisionValor}
                placeholder="0"
                onChange={e => updateServicio(s.servicioId, { comisionValor: parseFloat(e.target.value) || 0 })}
                onFocus={e => e.target.select()}
                disabled={!s.activo}
                className="w-full text-xs bg-transparent outline-none text-neutral-800 placeholder-neutral-300 disabled:cursor-not-allowed [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
          </td>

          {/* Precio servicio */}
          <td className="px-4 py-3 text-right">
            <span className="text-xs text-neutral-500 font-mono">{fmt(s.precioBase)}</span>
          </td>

          {/* Precio vehículo */}
          <td className="px-4 py-3 text-right">
            {s.esCompartido ? (
              <span className="text-xs text-neutral-300">—</span>
            ) : (
              <span className="text-xs text-neutral-300 text-[11px]">↓ por vehículo</span>
            )}
          </td>

          {/* Comisión */}
          <td className="px-4 py-3 text-right">
            {s.esCompartido && comisionCompartido !== null && s.activo ? (
              <span className="text-xs font-mono text-amber-600">{fmt(comisionCompartido)}</span>
            ) : (
              <span className="text-xs text-neutral-300">—</span>
            )}
          </td>

          {/* Total */}
          <td className="px-4 py-3 text-right">
            {s.esCompartido && totalCompartido !== null && s.activo ? (
              <span className="text-sm font-bold text-neutral-900 font-mono">{fmt(totalCompartido)}</span>
            ) : (
              <span className="text-xs text-neutral-300">—</span>
            )}
          </td>
        </tr>,

        /* ── Vehicle sub-rows (collapsible) ───────────────────────────────── */
        ...(!s.esCompartido && isExpanded
          ? s.vehiculos.map(v => {
              // svcOff = service toggle is off → whole row dimmed
              // vehOff = vehicle checkbox unchecked but service active → row visible, no totals
              const svcOff = !s.activo;
              const vehOff = !v.activo;
              const showTotals = !svcOff && !vehOff;

              const base = s.precioBase + v.precioBase;
              const comision = calcComision(base, s.tipoComision, s.comisionValor);
              const total = base + comision;

              return (
                <tr
                  key={`veh-${s.servicioId}-${v.vehiculoId}`}
                  className={`border-b border-neutral-150 transition-colors
                    ${svcOff ? 'opacity-40 bg-neutral-50' : vehOff ? 'bg-white hover:bg-neutral-50/60' : 'bg-amber-50/20 hover:bg-amber-50/40'}
                  `}
                >
                  {/* Name */}
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

                  {/* Active — Checkbox for vehicle */}
                  <td className="px-4 py-3 text-center">
                    <div className="flex justify-center">
                      <VehicleCheckbox
                        checked={v.activo}
                        onChange={val => updateVehiculo(s.servicioId, v.vehiculoId, val)}
                        disabled={svcOff}
                      />
                    </div>
                  </td>

                  {/* Commission type/value — inherited */}
                  <td className="px-4 py-3 text-center">
                    <span className="text-[11px] text-neutral-300">—</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-[11px] text-neutral-300">—</span>
                  </td>

                  {/* Precio servicio */}
                  <td className="px-4 py-3 text-right">
                    <span className={`text-xs font-mono ${showTotals ? 'text-neutral-600' : 'text-neutral-400'}`}>
                      {fmt(s.precioBase)}
                    </span>
                  </td>

                  {/* Precio vehículo */}
                  <td className="px-4 py-3 text-right">
                    <span className={`text-xs font-mono ${showTotals ? 'text-blue-600 font-semibold' : 'text-neutral-400'}`}>
                      {fmt(v.precioBase)}
                    </span>
                  </td>

                  {/* Comisión */}
                  <td className="px-4 py-3 text-right">
                    {showTotals ? (
                      <span className="text-xs font-mono text-amber-600 font-semibold">{fmt(comision)}</span>
                    ) : (
                      <span className="text-xs text-neutral-300">—</span>
                    )}
                  </td>

                  {/* Total */}
                  <td className="px-4 py-3 text-right">
                    {showTotals ? (
                      <span className="text-sm font-bold text-neutral-900 font-mono">{fmt(total)}</span>
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

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">

      {/* ── Legend ────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-6 text-xs text-neutral-500">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-neutral-400" />
          Precio servicio
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-blue-500" />
          Precio vehículo
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-amber-500" />
          Comisión aliado
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-neutral-900" />
          Total cliente
        </div>
        <span className="ml-4 text-neutral-400">Filas en gris = inactivo</span>
      </div>

      {/* ── Regular Services ──────────────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold text-neutral-900 mb-1">Servicios y vehículos</h3>
        <p className="text-xs text-neutral-400 mb-4">
          Activa servicios, configura la comisión y los vehículos disponibles para este aliado.
          El total cliente = precio servicio + precio vehículo + comisión.
        </p>

        <div className="border border-neutral-200 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <TableHeader />
            <tbody>
              {regularServicios.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-xs text-neutral-400">
                    No hay servicios disponibles
                  </td>
                </tr>
              ) : renderServicioRows(regularServicios)}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Municipal Transport ───────────────────────────────────────────── */}
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

      {/* ── Actions ───────────────────────────────────────────────────────── */}
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
