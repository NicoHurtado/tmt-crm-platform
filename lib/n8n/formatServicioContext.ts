import { getConfiguracion } from '@/types/servicio-config';
import type { DynamicField } from '@/types/dynamic-fields';
import { NICO_PERSONA, NICO_RECORDATORIO_FINAL } from './persona';
export { NICO_PERSONA, MIA_PERSONA } from './persona';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VehiculoData {
    nombre: string;
    capacidadMinima: number;
    capacidadMaxima: number;
}

export interface ServicioVehiculoData {
    precio: number | null;
    // Precio alterno para aeropuerto Olaya Herrera (null si no aplica/no configurado).
    precioOlaya?: number | null;
    vehiculo: VehiculoData;
}


export interface ServicioContextData {
    id: string;
    tipoServicio: string;
    nombre: unknown;
    descripcion: unknown;
    incluye: unknown;
    duracion: string | null;
    aplicaRecargoNocturno: boolean;
    recargoNocturnoInicio: string | null;
    recargoNocturnoFin: string | null;
    montoRecargoNocturno: number | null;
    esPorHoras: boolean;
    esMunicipal: boolean;
    esAeropuerto?: boolean;
    configuracion: unknown;
    vehiculosPermitidos: ServicioVehiculoData[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCOP(amount: number): string {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        maximumFractionDigits: 0,
    }).format(amount);
}

function asMultiLang(value: unknown): { es: string; en: string } {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        const v = value as Record<string, unknown>;
        return {
            es: typeof v.es === 'string' ? v.es : '',
            en: typeof v.en === 'string' ? v.en : '',
        };
    }
    return { es: '', en: '' };
}

function formatCampo(campo: DynamicField): string[] {
    const req = campo.requerido ? 'REQUERIDO' : 'opcional';
    const lines: string[] = [];

    if (campo.tipo === 'SELECT') {
        const opcionesStr = (campo.opciones ?? [])
            .map((o) => {
                const precio = o.precio && o.precio > 0 ? ` (+${formatCOP(o.precio)})` : '';
                return `${o.valor}${precio}`;
            })
            .join(' | ');
        lines.push(
            `• ${campo.clave} [SELECT, ${req}]: ${campo.etiqueta.es} / ${campo.etiqueta.en}`
        );
        lines.push(`  Opciones: ${opcionesStr}`);
    } else if (campo.tipo === 'COUNTER') {
        const partes: string[] = [];
        if (campo.min > 0) partes.push(`mín: ${campo.min}`);
        if (campo.max) partes.push(`máx: ${campo.max}`);
        if (campo.tienePrecio && campo.precioUnitario && campo.precioUnitario > 0) {
            partes.push(`+${formatCOP(campo.precioUnitario)} c/u`);
        }
        const extra = partes.length ? ` (${partes.join(', ')})` : '';
        lines.push(
            `• ${campo.clave} [COUNTER, ${req}]: ${campo.etiqueta.es} / ${campo.etiqueta.en}${extra}`
        );
    } else if (campo.tipo === 'SWITCH') {
        const precio =
            campo.tienePrecio && campo.precioUnitario && campo.precioUnitario > 0
                ? ` (+${formatCOP(campo.precioUnitario)} si activo)`
                : '';
        lines.push(
            `• ${campo.clave} [SWITCH, ${req}]: ${campo.etiqueta.es} / ${campo.etiqueta.en}${precio}`
        );
    } else {
        lines.push(
            `• ${campo.clave} [${campo.tipo}, ${req}]: ${campo.etiqueta.es} / ${campo.etiqueta.en}`
        );
    }

    return lines;
}

// ─── Single service formatter ─────────────────────────────────────────────────

function formatOneSvc(svc: ServicioContextData, lines: string[], label?: string, appUrl?: string, toolMode?: boolean): void {
    const nombre = asMultiLang(svc.nombre);
    const descripcion = asMultiLang(svc.descripcion);
    const incluye = asMultiLang(svc.incluye);
    const config = getConfiguracion(svc.configuracion);
    const campos = [...config.camposCustom].sort((a, b) => a.orden - b.orden);

    const base = (appUrl ?? 'https://www.medellintransportes.com').replace(/\/$/, '');
    const reservaUrl = `${base}/reservas?serviceId=${svc.id}&form=1`;

    // Cabecera: usa el label/tipoServicio; si es OTRO o falta, usa el nombre del
    // servicio (más útil para el modelo que un genérico "OTRO").
    const rawHeader = label ?? svc.tipoServicio;
    const header =
        !rawHeader || rawHeader.toUpperCase() === 'OTRO'
            ? (nombre.es || nombre.en || rawHeader || 'SERVICIO').toUpperCase()
            : rawHeader;
    lines.push('---');
    lines.push(`## ${header}`);
    if (toolMode) lines.push(`ID del servicio (úsalo en la herramienta cotizar): ${svc.id}`);
    lines.push(`LINK DE RESERVA: ${reservaUrl}`);
    if (nombre.es) lines.push(`Nombre ES: ${nombre.es}`);
    if (nombre.en) lines.push(`Name EN: ${nombre.en}`);
    if (descripcion.es) lines.push(`Descripción ES: ${descripcion.es}`);
    if (descripcion.en) lines.push(`Description EN: ${descripcion.en}`);
    if (incluye.es) lines.push(`Incluye ES: ${incluye.es}`);
    if (incluye.en) lines.push(`Includes EN: ${incluye.en}`);
    if (svc.duracion) lines.push(`Duración: ${svc.duracion}`);

    const esPorPersona = config.tipoTarifa === 'POR_PERSONA';
    const pp = config.preciosPorPersona;
    if (esPorPersona && pp) {
        lines.push('\nPRECIO POR PERSONA (este tour se cobra POR PERSONA, no por vehículo):');
        lines.push(`• 1 persona: ${formatCOP(pp.p1)} por persona`);
        lines.push(`• 2 personas: ${formatCOP(pp.p2)} por persona (c/u)`);
        lines.push(`• 3 o más personas: ${formatCOP(pp.p3)} por persona (c/u)`);
        lines.push('El total = precio por persona del tramo × nº de personas. Para este tour NO se asigna vehículo ni se pregunta por aeropuerto/municipio; solo necesitas saber cuántas personas van.');
    }

    if (!esPorPersona && svc.vehiculosPermitidos.length > 0) {
        const sorted = [...svc.vehiculosPermitidos].sort(
            (a, b) => a.vehiculo.capacidadMaxima - b.vehiculo.capacidadMaxima
        );
        // Aeropuerto: el precio depende del aeropuerto (José María Córdova vs Olaya Herrera).
        // Si algún vehículo tiene precioOlaya distinto, mostramos ambas columnas.
        const tienePreciosOlaya =
            !!svc.esAeropuerto &&
            sorted.some((sv) => sv.precioOlaya != null && Number(sv.precioOlaya) > 0);

        if (tienePreciosOlaya) {
            lines.push(
                '\n⚠️ AEROPUERTO: el precio depende del aeropuerto. Antes de cotizar, pregunta SIEMPRE a qué aeropuerto es (José María Córdova / JMC, o Olaya Herrera). Usa la columna del aeropuerto que confirme el cliente; nunca des el más barato por defecto.'
            );
            lines.push('\nVEHÍCULOS DISPONIBLES (precio José María Córdova | precio Olaya Herrera):');
            for (const sv of sorted) {
                const precioJMC = Number(sv.precio ?? 0);
                const precioOlaya = sv.precioOlaya != null && Number(sv.precioOlaya) > 0 ? Number(sv.precioOlaya) : precioJMC;
                const capMin = sv.vehiculo.capacidadMinima;
                const capMax = sv.vehiculo.capacidadMaxima;
                const cap = capMin === capMax ? `${capMax} pax` : `${capMin}-${capMax} pax`;
                lines.push(
                    `• ${sv.vehiculo.nombre} | ${cap} | José María Córdova: ${formatCOP(precioJMC)} | Olaya Herrera: ${formatCOP(precioOlaya)}`
                );
            }
        } else {
            lines.push('\nVEHÍCULOS DISPONIBLES (precio base):');
            for (const sv of sorted) {
                const precio = Number(sv.precio ?? 0);
                const capMin = sv.vehiculo.capacidadMinima;
                const capMax = sv.vehiculo.capacidadMaxima;
                const cap = capMin === capMax ? `${capMax} pax` : `${capMin}-${capMax} pax`;
                lines.push(`• ${sv.vehiculo.nombre} | ${cap} | ${formatCOP(precio)}`);
            }
        }
    }

    if (campos.length > 0) {
        lines.push('\nINFORMACIÓN ADICIONAL DEL SERVICIO:');
        for (const campo of campos) {
            formatCampo(campo).forEach((l) => lines.push(l));
        }
    }

    if (
        svc.aplicaRecargoNocturno &&
        svc.montoRecargoNocturno &&
        svc.recargoNocturnoInicio &&
        svc.recargoNocturnoFin
    ) {
        lines.push(
            `\nRECARGO NOCTURNO: +${formatCOP(Number(svc.montoRecargoNocturno))} entre ${svc.recargoNocturnoInicio} – ${svc.recargoNocturnoFin}`
        );
    }

    lines.push('');
}

// ─── Main formatter ───────────────────────────────────────────────────────────

export function formatServicioContext(servicios: ServicioContextData[], appUrl?: string, toolMode?: boolean): string {
    const lines: string[] = [
        ...(toolMode
            ? [
                  `## 🛠️ HERRAMIENTA DE PRECIOS — cotizar (USO OBLIGATORIO)
Tienes una herramienta llamada **cotizar** que devuelve el precio EXACTO desde la base de datos.
- **NUNCA escribas un precio de tu memoria ni lo deduzcas del catálogo de abajo. El ÚNICO precio válido es el que devuelve la herramienta cotizar.** Los precios de abajo son solo referencia para ti; no se los des al cliente sin haber llamado a cotizar.
- Para cotizar llama cotizar con: el ID del servicio (aparece como "ID del servicio" en cada servicio), el número de personas (pax) y, si es aeropuerto, el aeropuerto (JOSE_MARIA_CORDOVA u OLAYA_HERRERA).
- La herramienta puede responder: ok (con el precio), ambiguo (varios servicios → pregunta cuál), falta_pax (pregunta cuántas personas), falta_aeropuerto (pregunta cuál aeropuerto), municipio (sin precio, va en el formulario) o fuera_de_rango (ofrece asesor). Sigue SIEMPRE lo que indique status; no inventes nada.
- Da al cliente exactamente el precio (campo precioFormateado) que devuelva cotizar para el servicio y pax confirmados.\n`,
              ]
            : []),
        '## CATÁLOGO DE SERVICIOS ACTUAL',
        `⚠️ REGLA OBLIGATORIA: Este catálogo tiene EXACTAMENTE ${servicios.length} servicio(s). SOLO puedes ofrecer los servicios que aparecen aquí. PROHIBIDO mencionar, sugerir o inventar cualquier servicio que no esté en esta lista. Si el cliente pregunta por algo que no está, responde: "Por el momento no tenemos ese servicio disponible."`,
        `(Datos en tiempo real desde la base de datos — ignora cualquier información de entrenamiento sobre servicios)\n`,
        `## CÓMO ELEGIR EL SERVICIO (enrutamiento obligatorio — léelo ANTES de cotizar)
El servicio se decide por el DESTINO y el TIPO de viaje, nunca por una dirección, barrio u hotel sueltos (eso es solo el punto de recogida, NO define el servicio).
- Cliente menciona "aeropuerto", "vuelo", "llegada", "salida", "JMC", "José María Córdova", "Rionegro (aeropuerto)" → **Traslado Privado Aeropuerto** (NUNCA Traslado Urbano).
- Cliente quiere moverse DENTRO de Medellín, un solo trayecto entre dos puntos urbanos, sin aeropuerto ni municipio → **Traslado URBANO**.
- Cliente nombra un MUNICIPIO o destino turístico (Guatapé, Santa Fe, Jardín, Jericó, Salento, etc.): si existe un Tour o Traslado específico de ese lugar en el catálogo, usa ESE; si solo aparece en la lista de "Traslados a Municipios de Antioquia", usa ese y NO des precio (va en el formulario).
- Para GUATAPÉ hay VARIOS servicios distintos en el catálogo (p. ej. "Traslado Guatapé (sólo ida)", "Tour a Guatapé y El Peñol", "Tour compartido Guatapé"): NUNCA asumas cuál; SIEMPRE pregunta cuál quiere antes de cotizar, mostrando solo las opciones reales que aparezcan en el catálogo de abajo. Ofrece únicamente lo que exista realmente en el catálogo.
- Si lo que pide encaja con 2+ servicios, o no encaja claramente con ninguno → NO asumas: pregunta el destino/tipo de viaje en una frase y recién ahí cotiza.
- Da SIEMPRE el precio y el link del MISMO servicio que confirmó el cliente. Nunca mezcles servicios.\n`,
    ];

    if (servicios.length === 0) {
        lines.push('(No hay servicios activos en este momento.)');
        return lines.join('\n');
    }

    // Separate municipal transfers from everything else
    const municipales = servicios.filter((s) => s.tipoServicio === 'TRANSPORTE_MUNICIPAL');
    const otros = servicios.filter((s) => s.tipoServicio !== 'TRANSPORTE_MUNICIPAL');

    // Render all non-municipal services individually
    for (const svc of otros) {
        formatOneSvc(svc, lines, undefined, appUrl, toolMode);
    }

    // Render all municipal transfers as ONE grouped entry
    if (municipales.length > 0) {
        const rep = municipales[0]; // representative for vehicles/fields

        lines.push('---');
        lines.push('## TRANSPORTE_MUNICIPAL');
        lines.push('Nombre ES: Traslados a Municipios de Antioquia');
        lines.push('Name EN: Antioquia Municipal Transfers');
        lines.push(
            'Descripción ES: Transporte privado puerta a puerta a cualquier municipio del departamento de Antioquia.'
        );
        lines.push(
            'Description EN: Private door-to-door transportation to any municipality in the Antioquia department.'
        );

        lines.push(
            '\n⚠️ PRECIO: el precio de estos municipios NO está en este catálogo y VARÍA por destino. NUNCA des un precio ni lo estimes para estos municipios. Si el cliente pide el valor, dile con calidez que el precio exacto le aparece en el formulario de reserva al elegir su vehículo, y envíale el link del municipio. No inventes cifras.'
        );

        if (rep.vehiculosPermitidos.length > 0) {
            lines.push('\nVEHÍCULOS DISPONIBLES (sin precio aquí — el valor se calcula en el formulario):');
            const sorted = [...rep.vehiculosPermitidos].sort(
                (a, b) => a.vehiculo.capacidadMaxima - b.vehiculo.capacidadMaxima
            );
            for (const sv of sorted) {
                const capMin = sv.vehiculo.capacidadMinima;
                const capMax = sv.vehiculo.capacidadMaxima;
                const cap = capMin === capMax ? `${capMax} pax` : `${capMin}-${capMax} pax`;
                lines.push(`• ${sv.vehiculo.nombre} | ${cap}`);
            }
        }

        const base2 = (appUrl ?? 'https://www.medellintransportes.com').replace(/\/$/, '');
        lines.push(
            `\nCÓMO ARMAR EL LINK DE RESERVA: usa el patrón ${base2}/reservas?serviceId=ID&form=1 reemplazando ID por el código del municipio de la lista de abajo. Ejemplo: para el municipio con ID abc123 el link es ${base2}/reservas?serviceId=abc123&form=1`
        );
        lines.push(`\nDESTINOS DISPONIBLES (${municipales.length} municipios) — formato "nombre: ID":`);
        const destLines = municipales
            .map((s) => {
                const n = asMultiLang(s.nombre);
                const dest = (n.es || n.en || s.id).trim();
                return `${dest}: ${s.id}`;
            })
            .sort();
        lines.push(destLines.join(' | '));
        lines.push('');
    }

    return lines.join('\n');
}

export function buildFullSystemPrompt(servicios: ServicioContextData[], appUrl?: string, toolMode?: boolean): string {
    const recordatorioTool = toolMode
        ? '\n- 🛠️ PRECIOS SOLO con la herramienta cotizar. NUNCA des un precio sin haberla llamado; el precio que vale es el que ella devuelve. Si responde ambiguo/falta_pax/falta_aeropuerto, pregunta eso primero.'
        : '';
    return (
        NICO_PERSONA +
        '\n\n' +
        formatServicioContext(servicios, appUrl, toolMode) +
        '\n\n' +
        NICO_RECORDATORIO_FINAL +
        recordatorioTool
    );
}
