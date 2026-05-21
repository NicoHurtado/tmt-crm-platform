/**
 * migrate-from-neon.ts
 *
 * Migra el dump de Neon (producción vieja) a Railway (schema nuevo).
 * Uso:
 *   DATABASE_URL=<railway-url> \
 *   CLOUDINARY_CLOUD_NAME=... CLOUDINARY_API_KEY=... CLOUDINARY_API_SECRET=... \
 *   npx tsx scripts/migrate-from-neon.ts neon-produccion.sql
 */

import { PrismaClient } from '@prisma/client';
import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import cloudinary from '../lib/cloudinary';

const prisma = new PrismaClient();
const DUMP_PATH = resolve(process.argv[2] ?? 'neon-produccion.sql');
const PROJECT_ROOT = resolve(__dirname, '..');

// ── Contadores de progreso ─────────────────────────────────────────────────
const stats: Record<string, { ok: number; skip: number; err: number }> = {};
function log(table: string, ok: number, skip = 0, err = 0) {
  stats[table] = { ok, skip, err };
  console.log(`  ${table.padEnd(28)} ok=${ok} skip=${skip} err=${err}`);
}

// ── Mapeos de enums ─────────────────────────────────────────────────────────
const ESTADO_MAP: Record<string, string> = {
  PAGADA_PENDIENTE_ASIGNACION: 'CONFIRMED_UNASSIGNED',
  CONFIRMADA_PENDIENTE_PAGO: 'CONFIRMED_UNASSIGNED',
  ASIGNADA_PENDIENTE_COMPLETAR: 'CONFIRMED_ASSIGNED',
  CONFIRMADA_PENDIENTE_ASIGNACION: 'CONFIRMED_UNASSIGNED',
  PENDIENTE_COTIZACION: 'PENDING_PAYMENT',
  COMPLETADA: 'COMPLETED',
  CANCELADA: 'CANCELLED',
};

const METODO_MAP: Record<string, string> = {
  BOLD: 'TARJETA',
};

// ── Parse del dump ──────────────────────────────────────────────────────────
type TableData = { cols: string[]; rows: string[][] };

function parseDump(path: string): Map<string, TableData> {
  const dump = readFileSync(path, 'utf8');
  const tables = new Map<string, TableData>();
  const re = /^COPY public\."?(\w+)"? \(([^)]+)\) FROM stdin;\n([\s\S]*?)^\\\./gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(dump)) !== null) {
    const cols = m[2].split(',').map(c => c.trim().replace(/"/g, ''));
    const rows = m[3].trim().split('\n').filter(Boolean).map(r => r.split('\t'));
    tables.set(m[1], { cols, rows });
  }
  return tables;
}

// ── Helpers de valores ──────────────────────────────────────────────────────
function str(v: string): string | null  { return v === '\\N' ? null : v; }
function bool(v: string): boolean       { return v === 't'; }
function num(v: string): number | null  { return v === '\\N' ? null : parseFloat(v); }
function json(v: string): object        { return v === '\\N' ? {} : JSON.parse(v.replace(/\\\\/g, '\\')) as object; }
function dt(v: string): Date | null     {
  if (v === '\\N') return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d; // time-only strings (HH:MM:SS) → null
}

function row2obj(cols: string[], row: string[]): Record<string, string> {
  return Object.fromEntries(cols.map((c, i) => [c, row[i] ?? '\\N']));
}

// ── Migración de imágenes a Cloudinary ─────────────────────────────────────
async function migrateImage(raw: string | null, folder: string): Promise<string | null> {
  if (!raw) return null;
  if (raw.includes('res.cloudinary.com')) return raw; // ya está en Cloudinary

  let source: string;
  if (raw.startsWith('http')) {
    source = raw; // Vercel Blob u otra URL externa
  } else {
    // Ruta local tipo "/antioquia.jpg"
    const localPath = join(PROJECT_ROOT, 'public', raw.replace(/^\//, ''));
    if (!existsSync(localPath)) {
      console.warn(`    ⚠ imagen local no encontrada: ${localPath}`);
      return raw; // deja la ruta tal cual, no bloquea la migración
    }
    source = localPath;
  }

  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload(source, { folder: `tmt/${folder}` }, (err, result) => {
      if (err) reject(err);
      else resolve(result!.secure_url);
    });
  });
}

// ── MIGRACIÓN POR TABLA ─────────────────────────────────────────────────────

// Credenciales admin fijas para Railway (contraseña: tmtadmin)
const ADMIN_EMAIL    = 'admin';
const ADMIN_PASSWORD = '$2a$10$PrSgmKYIrUYaj0Vri1d5Iu0Vf2dwc4dJucz/tVpR7NKtTJxfUmkba';

async function migrateUser(data: TableData) {
  let ok = 0, skip = 0, err = 0;
  for (const row of data.rows) {
    const r = row2obj(data.cols, row);
    try {
      await prisma.user.upsert({
        where: { id: r.id },
        create: {
          id: r.id,
          email: ADMIN_EMAIL,       // fijo: admin
          password: ADMIN_PASSWORD, // fijo: tmtadmin (bcrypt)
          createdAt: new Date(r.createdAt),
          updatedAt: new Date(r.updatedAt),
        },
        update: {},
      });
      ok++;
    } catch { err++; }
  }
  log('User', ok, skip, err);
}

async function migrateVehiculo(data: TableData) {
  let ok = 0, skip = 0, err = 0;
  for (const row of data.rows) {
    const r = row2obj(data.cols, row);
    const existingV = await prisma.vehiculo.findUnique({ where: { id: r.id }, select: { imagen: true } });
    const imagen = existingV?.imagen ?? await migrateImage(str(r.imagen), 'vehiculos').catch(() => str(r.imagen));
    try {
      await prisma.vehiculo.upsert({
        where: { id: r.id },
        create: {
          id: r.id,
          nombre: r.nombre,
          capacidadMinima: parseInt(r.capacidadMinima),
          capacidadMaxima: parseInt(r.capacidadMaxima),
          imagen: imagen ?? r.imagen,
          activo: bool(r.activo),
          precioBase: 0, // campo nuevo — default 0
          createdAt: new Date(r.createdAt),
          updatedAt: new Date(r.updatedAt),
        },
        update: {},
      });
      ok++;
    } catch { err++; }
  }
  log('Vehiculo', ok, skip, err);
}

async function migrateConductor(data: TableData) {
  let ok = 0, skip = 0, err = 0;
  for (const row of data.rows) {
    const r = row2obj(data.cols, row);
    const existingC = await prisma.conductor.findUnique({ where: { id: r.id }, select: { foto: true } });
    const foto = existingC?.foto ?? await migrateImage(str(r.foto), 'conductores').catch(() => str(r.foto));
    const fotos = str(r.fotosVehiculo);
    let fotosArr: string[] = [];
    if (fotos && fotos !== '{}') {
      fotosArr = fotos.replace(/^\{|\}$/g, '').split(',').filter(Boolean);
    }
    try {
      await prisma.conductor.upsert({
        where: { id: r.id },
        create: {
          id: r.id,
          nombre: r.nombre,
          whatsapp: r.whatsapp,
          disponible: bool(r.disponible),
          activo: bool(r.activo),
          fotosVehiculo: fotosArr,
          telefono: r.telefono,
          documento: r.documento,
          placa: r.placa,
          foto: foto ?? null,
          createdAt: new Date(r.createdAt),
          updatedAt: new Date(r.updatedAt),
        },
        update: {},
      });
      ok++;
    } catch { err++; }
  }
  log('Conductor', ok, skip, err);
}

async function migrateServicio(data: TableData) {
  let ok = 0, skip = 0, err = 0;
  for (const row of data.rows) {
    const r = row2obj(data.cols, row);
    // Skip Cloudinary upload if record already exists (idempotent re-runs)
    const existing = await prisma.servicio.findUnique({ where: { id: r.id }, select: { imagen: true } });
    const imagen = existing?.imagen ?? await migrateImage(str(r.imagen), 'servicios').catch(() => str(r.imagen));

    // tipo → tipoServicio (rename); camposPersonalizados → configuracion.camposCustom
    const camposViejos = str(r.camposPersonalizados);
    const camposCustom = camposViejos && camposViejos !== '\\N' ? JSON.parse(camposViejos.replace(/\\\\/g, '\\')) : [];
    const configuracion = { camposCustom };

    try {
      await prisma.servicio.upsert({
        where: { id: r.id },
        create: {
          id: r.id,
          tipoServicio: r.tipo as any,     // rename: tipo → tipoServicio
          esMunicipal: r.tipo === 'TRANSPORTE_MUNICIPAL', // derivado del tipo
          imagen: imagen ?? r.imagen,
          activo: bool(r.activo),
          duracion: str(r.duracion),
          precioBase: parseFloat(r.precioBase),
          aplicaRecargoNocturno: bool(r.aplicaRecargoNocturno),
          recargoNocturnoInicio: str(r.recargoNocturnoInicio),
          recargoNocturnoFin: str(r.recargoNocturnoFin),
          montoRecargoNocturno: num(r.montoRecargoNocturno),
          configuracion,                   // camposPersonalizados migrado aquí
          destinoAutoFill: str(r.destinoAutoFill),
          esAeropuerto: bool(r.esAeropuerto),
          esTraslado: false,               // campo nuevo
          nombre: json(r.nombre),
          descripcion: json(r.descripcion),
          incluye: json(r.incluye),
          esPorHoras: bool(r.esPorHoras),
          esCompartido: bool(r.esCompartido),
          guiaEspanolDisponible: false,    // campo nuevo
          precioGuiaEspanol: null,         // campo nuevo
          guiaInglesDisponible: false,     // campo nuevo
          precioGuiaIngles: null,          // campo nuevo
          orden: parseInt(r.orden ?? '999'),
          createdAt: new Date(r.createdAt),
          updatedAt: new Date(r.updatedAt),
        },
        update: {},
      });
      ok++;
    } catch (e) { console.error(`  ✗ Servicio ${r.id}:`, e); err++; }
  }
  log('Servicio', ok, skip, err);
}

async function migrateAliado(data: TableData) {
  let ok = 0, skip = 0, err = 0;
  for (const row of data.rows) {
    const r = row2obj(data.cols, row);
    try {
      await prisma.aliado.upsert({
        where: { id: r.id },
        create: {
          id: r.id,
          nombre: r.nombre,
          tipo: r.tipo as any,
          codigo: r.codigo,
          linkToken: str(r.linkToken),
          email: r.email,
          contacto: r.contacto,
          activo: bool(r.activo),
          createdAt: new Date(r.createdAt),
          updatedAt: new Date(r.updatedAt),
        },
        update: {},
      });
      ok++;
    } catch { err++; }
  }
  log('Aliado', ok, skip, err);
}

async function migrateMunicipioConfig(data: TableData) {
  let ok = 0, skip = 0, err = 0;
  for (const row of data.rows) {
    const r = row2obj(data.cols, row);
    try {
      await prisma.municipioConfig.upsert({
        where: { id: r.id },
        create: {
          id: r.id,
          nombreES: r.nombreES,
          nombreEN: r.nombreEN,
          recargo: parseFloat(r.recargo),
          activo: bool(r.activo),
          orden: 0,  // campo nuevo
          createdAt: new Date(r.createdAt),
          updatedAt: new Date(r.updatedAt),
        },
        update: {},
      });
      ok++;
    } catch { err++; }
  }
  log('MunicipioConfig', ok, skip, err);
}

async function migratePedido(data: TableData) {
  let ok = 0, skip = 0, err = 0;
  for (const row of data.rows) {
    const r = row2obj(data.cols, row);
    // metodoPago: BOLD → TARJETA
    const metodoPago = METODO_MAP[r.metodoPago] ?? r.metodoPago;
    try {
      await prisma.pedido.upsert({
        where: { id: r.id },
        create: {
          id: r.id,
          codigo: r.codigo,
          nombreCliente: r.nombreCliente,
          whatsappCliente: r.whatsappCliente,
          emailCliente: r.emailCliente,
          idioma: r.idioma as any,
          subtotal: parseFloat(r.subtotal),
          comisionBold: parseFloat(r.comisionBold),
          precioTotal: parseFloat(r.precioTotal),
          estadoPago: str(r.estadoPago) as any ?? undefined,
          metodoPago: metodoPago as any,
          hashPago: str(r.hashPago),
          pagoId: str(r.pagoId),
          aliadoId: str(r.aliadoId),
          esReservaAliado: bool(r.esReservaAliado),
          createdAt: new Date(r.createdAt),
          updatedAt: new Date(r.updatedAt),
        },
        update: {},
      });
      ok++;
    } catch { err++; }
  }
  log('Pedido', ok, skip, err);
}

async function migrateServicioVehiculo(data: TableData) {
  let ok = 0, skip = 0, err = 0;
  for (const row of data.rows) {
    const r = row2obj(data.cols, row);
    try {
      await prisma.servicioVehiculo.upsert({
        where: { servicioId_vehiculoId: { servicioId: r.servicioId, vehiculoId: r.vehiculoId } },
        create: {
          id: r.id,
          servicioId: r.servicioId,
          vehiculoId: r.vehiculoId,
          precio: num(r.precio),
        },
        update: {},
      });
      ok++;
    } catch { err++; }
  }
  log('ServicioVehiculo', ok, skip, err);
}

async function migrateServicioAdicional(data: TableData) {
  let ok = 0, skip = 0, err = 0;
  for (const row of data.rows) {
    const r = row2obj(data.cols, row);
    try {
      await prisma.servicioAdicional.upsert({
        where: { id: r.id },
        create: {
          id: r.id,
          servicioId: r.servicioId,
          nombre: r.nombre,
          precio: parseFloat(r.precio),
          tipo: r.tipo as any,
          activo: bool(r.activo),
          incluidoPorDefecto: bool(r.incluidoPorDefecto),
          createdAt: new Date(r.createdAt),
          updatedAt: new Date(r.updatedAt),
        },
        update: {},
      });
      ok++;
    } catch { err++; }
  }
  log('ServicioAdicional', ok, skip, err);
}

async function migrateServicioAliado(data: TableData) {
  let ok = 0, skip = 0, err = 0;
  for (const row of data.rows) {
    const r = row2obj(data.cols, row);
    try {
      await prisma.servicioAliado.upsert({
        where: { aliadoId_servicioId: { aliadoId: r.aliadoId, servicioId: r.servicioId } },
        create: {
          id: r.id,
          aliadoId: r.aliadoId,
          servicioId: r.servicioId,
          activo: bool(r.activo),
          aplicaRecargoNocturno: str(r.aplicaRecargoNocturno) === null ? null : bool(r.aplicaRecargoNocturno),
          montoRecargoNocturno: num(r.montoRecargoNocturno),
          recargoNocturnoFin: str(r.recargoNocturnoFin),
          recargoNocturnoInicio: str(r.recargoNocturnoInicio),
          sobrescribirRecargoNocturno: bool(r.sobrescribirRecargoNocturno),
          createdAt: new Date(r.createdAt),
          updatedAt: new Date(r.updatedAt),
        },
        update: {},
      });
      ok++;
    } catch { err++; }
  }
  log('ServicioAliado', ok, skip, err);
}

async function migrateTarifaAliado(data: TableData) {
  let ok = 0, skip = 0, err = 0;
  for (const row of data.rows) {
    const r = row2obj(data.cols, row);
    try {
      await prisma.tarifaAliado.upsert({
        where: { aliadoId_servicioId: { aliadoId: r.aliadoId, servicioId: r.servicioId } },
        create: {
          id: r.id,
          aliadoId: r.aliadoId,
          servicioId: r.servicioId,
          precioEspecial: num(r.precioEspecial),
          comisionPorcentaje: parseFloat(r.comisionPorcentaje),
          descuentoEspecial: parseFloat(r.descuentoEspecial ?? '0'),
          tipoComision: (r.tipoComision as any) ?? 'PORCENTAJE',
          createdAt: new Date(r.createdAt),
          updatedAt: new Date(r.updatedAt),
        },
        update: {},
      });
      ok++;
    } catch { err++; }
  }
  log('TarifaAliado', ok, skip, err);
}

async function migrateTarifaMunicipioAliado(data: TableData) {
  let ok = 0, skip = 0, err = 0;
  for (const row of data.rows) {
    const r = row2obj(data.cols, row);
    try {
      await prisma.tarifaMunicipioAliado.upsert({
        where: { aliadoId_municipio: { aliadoId: r.aliadoId, municipio: r.municipio as any } },
        create: {
          id: r.id,
          aliadoId: r.aliadoId,
          municipio: r.municipio as any,
          valorExtra: parseFloat(r.valorExtra),
          createdAt: new Date(r.createdAt),
          updatedAt: new Date(r.updatedAt),
        },
        update: {},
      });
      ok++;
    } catch { err++; }
  }
  log('TarifaMunicipioAliado', ok, skip, err);
}

async function migrateTarifaMunicipioServicio(data: TableData) {
  let ok = 0, skip = 0, err = 0;
  for (const row of data.rows) {
    const r = row2obj(data.cols, row);
    try {
      await prisma.tarifaMunicipioServicio.upsert({
        where: { servicioId_municipio: { servicioId: r.servicioId, municipio: r.municipio as any } },
        create: {
          id: r.id,
          servicioId: r.servicioId,
          municipio: r.municipio as any,
          valorExtra: parseFloat(r.valorExtra ?? '0'),
        },
        update: {},
      });
      ok++;
    } catch { err++; }
  }
  log('TarifaMunicipioServicio', ok, skip, err);
}

async function migratePrecioVehiculoAliado(data: TableData) {
  // OLD: id, servicioAliadoId, vehiculoId, precio, comision, createdAt, updatedAt
  // NEW: id, servicioAliadoId, vehiculoId, activo, createdAt, updatedAt
  const records = data.rows.map(row => {
    const r = row2obj(data.cols, row);
    return { id: r.id, servicioAliadoId: r.servicioAliadoId, vehiculoId: r.vehiculoId, activo: true,
             createdAt: new Date(r.createdAt), updatedAt: new Date(r.updatedAt) };
  });
  const CHUNK = 500; let ok = 0, err = 0;
  for (let i = 0; i < records.length; i += CHUNK) {
    try {
      const res = await prisma.precioVehiculoAliado.createMany({ data: records.slice(i, i + CHUNK), skipDuplicates: true });
      ok += res.count;
    } catch { err += Math.min(CHUNK, records.length - i); }
  }
  log('PrecioVehiculoAliado', ok, 0, err);
}

async function migrateReserva(data: TableData) {
  const PACK_INTO_DATOS = [
    'aeropuertoTipo', 'aeropuertoNombre', 'numeroVuelo', 'lugarRecogida',
    'guiaCertificado', 'vueltaBote', 'cantidadAlmuerzos', 'cantidadMotos',
    'cantidadParticipantes', 'cantidadHoras', 'trasladoTipo', 'trasladoDestino',
  ];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const records: any[] = [];
  for (const row of data.rows) {
    const r = row2obj(data.cols, row);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const datos: Record<string, any> = {};
    for (const key of PACK_INTO_DATOS) {
      const v = str(r[key]);
      if (v !== null) datos[key] = v === 't' ? true : v === 'f' ? false : v;
    }
    const dinamicos = str(r.datosDinamicos);
    if (dinamicos) { try { Object.assign(datos, JSON.parse(dinamicos)); } catch {} }
    const estado = ESTADO_MAP[r.estado] ?? r.estado;
    const metodoPago = METODO_MAP[r.metodoPago] ?? r.metodoPago ?? 'TARJETA';
    records.push({
      id: r.id, codigo: r.codigo, nombreCliente: r.nombreCliente,
      whatsappCliente: r.whatsappCliente, emailCliente: r.emailCliente,
      servicioId: r.servicioId, fecha: new Date(r.fecha), hora: r.hora,
      idioma: r.idioma as any, municipio: str(r.municipio) as any ?? null,
      otroMunicipio: str(r.otroMunicipio), numeroPasajeros: parseInt(r.numeroPasajeros),
      vehiculoId: str(r.vehiculoId), datos,
      precioBase: parseFloat(r.precioBase),
      precioAdicionales: parseFloat(r.precioAdicionales ?? '0'),
      recargoNocturno: parseFloat(r.recargoNocturno ?? '0'),
      tarifaMunicipio: parseFloat(r.tarifaMunicipio ?? '0'),
      descuentoAliado: parseFloat(r.descuentoAliado ?? '0'),
      precioTotal: parseFloat(r.precioTotal),
      comisionBold: num(r.comisionBold), comisionAliado: num(r.comisionAliado),
      estado: estado as any, estadoPago: str(r.estadoPago) as any ?? null,
      conductorId: str(r.conductorId), conductorAsignadoAt: dt(r.conductorAsignadoAt),
      aliadoId: str(r.aliadoId), esReservaAliado: bool(r.esReservaAliado),
      notas: str(r.notas), notasInternas: str(r.notasInternas),
      hashPago: str(r.hashPago), pagoId: str(r.pagoId),
      canceladaAt: dt(r.canceladaAt), metodoPago: metodoPago as any,
      googleCalendarEventId: str(r.googleCalendarEventId),
      esCotizacion: bool(r.esCotizacion), linkCotizacion: str(r.linkCotizacion),
      precioManual: bool(r.precioManual), esPedido: bool(r.esPedido),
      pedidoId: str(r.pedidoId), origen: str(r.origen) ?? 'web_directa',
      clientePaga: bool(r.clientePaga ?? 't'), municipioConfigId: str(r.municipioConfigId),
      createdAt: new Date(r.createdAt), updatedAt: new Date(r.updatedAt),
    });
  }
  const CHUNK = 200; let ok = 0, err = 0;
  for (let i = 0; i < records.length; i += CHUNK) {
    try {
      const res = await prisma.reserva.createMany({ data: records.slice(i, i + CHUNK), skipDuplicates: true });
      ok += res.count;
    } catch { err += Math.min(CHUNK, records.length - i); }
  }
  log('Reserva', ok, 0, err);
}

async function migrateAsistente(data: TableData) {
  const records = data.rows.map(row => {
    const r = row2obj(data.cols, row);
    return { id: r.id, reservaId: r.reservaId, nombre: r.nombre,
             tipoDocumento: r.tipoDocumento as any, numeroDocumento: r.numeroDocumento,
             email: str(r.email), telefono: str(r.telefono),
             createdAt: new Date(r.createdAt), updatedAt: new Date(r.updatedAt) };
  });
  const CHUNK = 500; let ok = 0, err = 0;
  for (let i = 0; i < records.length; i += CHUNK) {
    try {
      const res = await prisma.asistente.createMany({ data: records.slice(i, i + CHUNK), skipDuplicates: true });
      ok += res.count;
    } catch { err += Math.min(CHUNK, records.length - i); }
  }
  log('Asistente', ok, 0, err);
}

async function migrateReservaAdicional(data: TableData) {
  let ok = 0, skip = 0, err = 0;
  for (const row of data.rows) {
    const r = row2obj(data.cols, row);
    try {
      await prisma.reservaAdicional.upsert({
        where: { reservaId_adicionalId: { reservaId: r.reservaId, adicionalId: r.adicionalId } },
        create: {
          id: r.id,
          reservaId: r.reservaId,
          adicionalId: r.adicionalId,
          cantidad: parseInt(r.cantidad),
          precioUnitario: parseFloat(r.precioUnitario),
          precioTotal: parseFloat(r.precioTotal),
        },
        update: {},
      });
      ok++;
    } catch { err++; }
  }
  log('ReservaAdicional', ok, skip, err);
}

async function migrateCalificacion(data: TableData) {
  const records = data.rows.map(row => {
    const r = row2obj(data.cols, row);
    return { id: r.id, reservaId: r.reservaId, servicioId: r.servicioId,
             estrellas: parseInt(r.estrellas), comentario: str(r.comentario),
             nombreCliente: r.nombreCliente, esPublica: bool(r.esPublica),
             destacada: bool(r.destacada),
             ordenDestacada: r.ordenDestacada ? parseInt(r.ordenDestacada) : null,
             createdAt: new Date(r.createdAt), updatedAt: new Date(r.updatedAt) };
  });
  try {
    const res = await prisma.calificacion.createMany({ data: records, skipDuplicates: true });
    log('Calificacion', res.count, 0, records.length - res.count);
  } catch { log('Calificacion', 0, 0, records.length); }
}

async function migrateBdAntigua(data: TableData) {
  const records = data.rows.map(row => {
    const r = row2obj(data.cols, row);
    return { id: parseInt(r.id), hora_reserva: dt(r.hora_reserva), canal: str(r.canal),
             nombre: str(r.nombre), idioma: str(r.idioma), fecha: dt(r.fecha), hora: dt(r.hora),
             servicio: str(r.servicio), vehiculo: str(r.vehiculo),
             numero_vuelo: str(r.numero_vuelo), numero_contacto: str(r.numero_contacto),
             cotizacion: str(r.cotizacion), comision: str(r.comision),
             informacion_adicional: str(r.informacion_adicional),
             estado_servicio: str(r.estado_servicio), estado_pago: str(r.estado_pago),
             conductor: str(r.conductor), created_at: dt(r.created_at) ?? new Date() };
  });
  const CHUNK = 500; let ok = 0, err = 0;
  for (let i = 0; i < records.length; i += CHUNK) {
    const chunk = records.slice(i, i + CHUNK);
    try {
      const res = await prisma.bdAntigua.createMany({ data: chunk, skipDuplicates: true });
      ok += res.count;
    } catch {
      // Batch failed — fall back to per-record to skip bad rows
      for (const rec of chunk) {
        try {
          await prisma.bdAntigua.upsert({ where: { id: rec.id }, create: rec, update: {} });
          ok++;
        } catch (e2) {
          console.error(`  ✗ BdAntigua id=${rec.id}:`, (e2 as Error).message?.slice(0, 120));
          err++;
        }
      }
    }
  }
  log('BdAntigua', ok, 0, err);
}

// ── MAIN ────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n🚀 Migración Neon → Railway`);
  console.log(`   Dump: ${DUMP_PATH}`);
  console.log(`   DB:   ${process.env.DATABASE_URL?.split('@')[1] ?? '(DATABASE_URL no definida)'}\n`);

  if (!existsSync(DUMP_PATH)) {
    console.error(`✗ No se encontró el archivo: ${DUMP_PATH}`);
    process.exit(1);
  }

  console.log('Parseando dump...');
  const tables = parseDump(DUMP_PATH);
  console.log(`  ${tables.size} tablas encontradas: ${Array.from(tables.keys()).join(', ')}\n`);

  console.log('Migrando tablas (orden FK-safe)...');

  // Orden respeta dependencias de FK
  await migrateUser(tables.get('User')!);
  await migrateVehiculo(tables.get('Vehiculo')!);
  await migrateConductor(tables.get('Conductor')!);
  await migrateServicio(tables.get('Servicio')!);
  await migrateAliado(tables.get('Aliado')!);
  await migrateMunicipioConfig(tables.get('MunicipioConfig')!);
  await migratePedido(tables.get('Pedido')!);
  await migrateServicioVehiculo(tables.get('ServicioVehiculo')!);
  await migrateServicioAdicional(tables.get('ServicioAdicional')!);
  await migrateServicioAliado(tables.get('ServicioAliado')!);
  await migrateTarifaAliado(tables.get('TarifaAliado')!);
  await migrateTarifaMunicipioAliado(tables.get('TarifaMunicipioAliado')!);
  await migrateTarifaMunicipioServicio(tables.get('tarifas_municipio_servicio')!);
  await migratePrecioVehiculoAliado(tables.get('PrecioVehiculoAliado')!);
  await migrateReserva(tables.get('Reserva')!);
  await migrateAsistente(tables.get('Asistente')!);
  await migrateReservaAdicional(tables.get('ReservaAdicional')!);
  await migrateCalificacion(tables.get('Calificacion')!);
  await migrateBdAntigua(tables.get('bd_antigua')!);

  // ── Resumen final ─────────────────────────────────────────────────────────
  console.log('\n📊 Resumen:');
  let totalOk = 0, totalErr = 0;
  for (const [t, s] of Object.entries(stats)) {
    totalOk += s.ok;
    totalErr += s.err;
  }
  console.log(`   Total ok:     ${totalOk}`);
  console.log(`   Total errores: ${totalErr}`);
  if (totalErr === 0) {
    console.log('\n✅ Migración completa sin errores.\n');
  } else {
    console.log('\n⚠  Migración completada con errores — revisa los logs arriba.\n');
  }
}

main()
  .catch(e => { console.error('Error fatal:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
