/**
 * Mapeo de servicios/aliados a filas de Excel para el módulo "Estado General".
 *
 * Fuente única de cómo se "aplana" cada servicio a líneas de precio según su
 * `modeloPrecio` (ver lib/servicio-categoria.ts). Replica el criterio de
 * priceCalculator sin recalcular totales: aquí solo se exponen las tarifas
 * configuradas, no se cotiza.
 */
import { getLocalizedText, getLocalizedArray } from '@/types/multi-language';
import { categoriaDeServicio, modeloPrecioDeServicio, type Categoria } from '@/lib/servicio-categoria';
import { getConfiguracion } from '@/types/servicio-config';

const num = (v: unknown): number => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};

/** Etiqueta legible de categoría para encabezados de bloque. */
export const CATEGORIA_LABEL: Record<Categoria, string> = {
    AEROPUERTO: 'Transporte al aeropuerto',
    TRASLADO: 'Traslados',
    TOUR_PERSONA: 'Tours',
    COMPARTIDO: 'Tours',
    MUNICIPAL: 'Transportes municipales',
    OTRO: 'Otros servicios',
};

/** Orden de aparición de los bloques en la Hoja 1. */
export const ORDEN_BLOQUES: { key: string; label: string; categorias: Categoria[] }[] = [
    { key: 'AEROPUERTO', label: 'Transporte al aeropuerto', categorias: ['AEROPUERTO'] },
    { key: 'TRASLADO', label: 'Traslados', categorias: ['TRASLADO'] },
    { key: 'TOURS', label: 'Tours', categorias: ['TOUR_PERSONA', 'COMPARTIDO'] },
    { key: 'OTROS', label: 'Otros servicios', categorias: ['OTRO'] },
];

export interface ServicioFila {
    servicio: string;
    categoria: string;
    modalidad: string;
    vehiculo: string;
    capacidad: string;
    precio: number;
    precioOlaya: number | '';
    duracion: string;
    incluyeES: string;
    descripcionES: string;
    descripcionEN: string;
    recargoNocturno: string;
    guiaES: string;
    guiaEN: string;
}

/** Tipos mínimos esperados (subset de los modelos de Prisma). */
export interface VehiculoLite {
    nombre: string;
    capacidadMinima: number;
    capacidadMaxima: number;
}
export interface ServicioVehiculoLite {
    precio: unknown;
    precioOlaya?: unknown;
    vehiculo: VehiculoLite;
}
export interface ServicioLite {
    nombre: unknown;
    descripcion: unknown;
    incluye: unknown;
    duracion?: string | null;
    configuracion?: unknown;
    esAeropuerto?: boolean | null;
    esTraslado?: boolean | null;
    esPorHoras?: boolean | null;
    esCompartido?: boolean | null;
    esMunicipal?: boolean | null;
    aplicaRecargoNocturno?: boolean | null;
    montoRecargoNocturno?: unknown;
    recargoNocturnoInicio?: string | null;
    recargoNocturnoFin?: string | null;
    guiaEspanolDisponible?: boolean | null;
    precioGuiaEspanol?: unknown;
    guiaInglesDisponible?: boolean | null;
    precioGuiaIngles?: unknown;
    vehiculosPermitidos: ServicioVehiculoLite[];
}

function capacidadLabel(v: VehiculoLite): string {
    if (v.capacidadMinima === v.capacidadMaxima) return `${v.capacidadMaxima}`;
    return `${v.capacidadMinima}–${v.capacidadMaxima}`;
}

function recargoLabel(s: ServicioLite): string {
    if (!s.aplicaRecargoNocturno) return 'No';
    const monto = num(s.montoRecargoNocturno);
    const ventana = s.recargoNocturnoInicio && s.recargoNocturnoFin
        ? ` (${s.recargoNocturnoInicio}–${s.recargoNocturnoFin})`
        : '';
    return monto > 0 ? `$${monto.toLocaleString('es-CO')}${ventana}` : `Sí${ventana}`;
}

function guiaLabel(disponible: boolean | null | undefined, precio: unknown): string {
    if (!disponible) return 'No';
    const p = num(precio);
    return p > 0 ? `$${p.toLocaleString('es-CO')}` : 'Incluida';
}

/**
 * Aplana un servicio a sus filas de precio según el modelo de precio.
 * - POR_VEHICULO / POR_HORAS / COMPARTIDO_POR_PERSONA: una fila por vehículo.
 * - POR_PERSONA_TRAMOS: 3 filas (1 / 2 / 3+ pax) con la tarifa unitaria.
 */
export function servicioAFilas(s: ServicioLite): ServicioFila[] {
    const categoria = categoriaDeServicio(s);
    const modelo = modeloPrecioDeServicio(s);
    const base = {
        servicio: getLocalizedText(s.nombre, 'ES'),
        categoria: CATEGORIA_LABEL[categoria],
        duracion: s.duracion || '',
        incluyeES: getLocalizedArray(s.incluye, 'ES').join(' · '),
        descripcionES: getLocalizedText(s.descripcion, 'ES'),
        descripcionEN: getLocalizedText(s.descripcion, 'EN'),
        recargoNocturno: recargoLabel(s),
        guiaES: guiaLabel(s.guiaEspanolDisponible, s.precioGuiaEspanol),
        guiaEN: guiaLabel(s.guiaInglesDisponible, s.precioGuiaIngles),
    };

    if (modelo === 'POR_PERSONA_TRAMOS') {
        const pp = getConfiguracion(s.configuracion).preciosPorPersona;
        const tramos: { label: string; precio: number }[] = [
            { label: 'Por persona — 1 pax', precio: num(pp?.p1) },
            { label: 'Por persona — 2 pax', precio: num(pp?.p2) },
            { label: 'Por persona — 3+ pax', precio: num(pp?.p3) },
        ];
        return tramos.map((t) => ({
            ...base,
            modalidad: t.label,
            vehiculo: 'Por persona',
            capacidad: '',
            precio: t.precio,
            precioOlaya: '' as const,
        }));
    }

    const modalidad =
        modelo === 'POR_HORAS' ? 'Por hora'
        : modelo === 'COMPARTIDO_POR_PERSONA' ? 'Compartido — por persona'
        : 'Por vehículo';

    const esAeropuerto = !!s.esAeropuerto;

    return s.vehiculosPermitidos.map((sv) => ({
        ...base,
        modalidad,
        vehiculo: sv.vehiculo.nombre,
        capacidad: capacidadLabel(sv.vehiculo),
        precio: num(sv.precio),
        precioOlaya: esAeropuerto ? num(sv.precioOlaya ?? sv.precio) : ('' as const),
    }));
}
