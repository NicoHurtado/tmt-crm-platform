import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Cálculo de precio REAL (recalcularPrecioWebDirecto / totalPorPersona): solo se mockea la BD.
vi.mock('@/lib/prisma', () => ({
    prisma: {
        servicio: { findFirst: vi.fn() },
        reserva: { findUnique: vi.fn(), create: vi.fn() },
        municipioConfig: { findMany: vi.fn() },
    },
}));

vi.mock('crypto', async () => {
    const actual = await vi.importActual<typeof import('crypto')>('crypto');
    return { ...actual, randomInt: vi.fn().mockReturnValue(0) };
});

const VEHICULOS = [
    { vehiculoId: 'veh-auto', precio: 140_000, precioOlaya: 100_000, vehiculo: { id: 'veh-auto', nombre: 'Auto 1 - 3', capacidadMinima: 1, capacidadMaxima: 3 } },
    { vehiculoId: 'veh-van', precio: 220_000, precioOlaya: 180_000, vehiculo: { id: 'veh-van', nombre: 'Van 5 - 8', capacidadMinima: 5, capacidadMaxima: 8 } },
];

const base = {
    activo: true,
    esAeropuerto: false,
    esPorHoras: false,
    esCompartido: false,
    esMunicipal: false,
    esTraslado: true,
    aplicaRecargoNocturno: false,
    montoRecargoNocturno: null,
    recargoNocturnoInicio: null,
    recargoNocturnoFin: null,
    configuracion: { camposCustom: [] },
    vehiculosPermitidos: VEHICULOS,
};

const servicioAeropuerto = {
    ...base,
    id: 'svc-aeropuerto',
    tipoServicio: 'AEROPUERTO',
    nombre: { es: 'Traslado Privado Aeropuerto', en: 'Private Airport Transfer' },
    esAeropuerto: true,
    aplicaRecargoNocturno: true,
    montoRecargoNocturno: 20_000,
    recargoNocturnoInicio: '22:00',
    recargoNocturnoFin: '03:00',
    configuracion: {
        camposCustom: [
            {
                clave: 'Posterairport', etiqueta: { es: 'Póster aeropuerto', en: 'Airport poster' },
                tipo: 'SWITCH', requerido: false, orden: 0, tienePrecio: true, precioUnitario: 15_000,
            },
        ],
    },
};

const servicioTraslado = {
    ...base,
    id: 'svc-guatape',
    tipoServicio: 'TOUR_GUATAPE',
    nombre: { es: 'Traslado Guatapé', en: 'Guatapé Transfer' },
};

const servicioPorPersona = {
    ...base,
    id: 'svc-comuna13',
    tipoServicio: 'CITY_TOUR',
    nombre: { es: 'Tour Comuna 13', en: 'Comuna 13 Tour' },
    configuracion: { camposCustom: [], tipoTarifa: 'POR_PERSONA', preciosPorPersona: { p1: 300_000, p2: 270_000, p3: 250_000 } },
    vehiculosPermitidos: [],
};

const servicioPorHoras = {
    ...base,
    id: 'svc-horas',
    tipoServicio: 'POR_HORAS',
    nombre: { es: 'Disposición por Horas', en: 'By the Hour' },
    esPorHoras: true,
    vehiculosPermitidos: [{ ...VEHICULOS[0], precio: 65_000 }],
};

const FUTURA = '2099-12-12';

function req(body: unknown, key = 'test-key') {
    return new Request('http://localhost/api/n8n/reservas/crear', {
        method: 'POST',
        headers: { 'x-api-key': key },
        body: JSON.stringify(body),
    });
}

const cliente = {
    nombreCliente: 'Yesid Bustamante',
    whatsappCliente: '573001234567',
    emailCliente: 'Yecabusa23@Gmail.com ',
};

describe('POST /api/n8n/reservas/crear', () => {
    let POST: (req: Request) => Promise<Response>;
    let prisma: any;

    beforeEach(async () => {
        vi.clearAllMocks();
        process.env.N8N_API_KEY = 'test-key';
        process.env.NEXT_PUBLIC_APP_URL = 'https://www.medellintransportes.com';
        const prismaMod = await import('@/lib/prisma');
        prisma = prismaMod.prisma;
        prisma.servicio.findFirst.mockResolvedValue(servicioTraslado);
        prisma.reserva.findUnique.mockResolvedValue(null);
        prisma.reserva.create.mockImplementation(async ({ data }: any) => data);
        prisma.municipioConfig.findMany.mockResolvedValue([
            { id: 'mc-rionegro', nombreES: 'Rionegro', nombreEN: 'Rionegro', recargo: 40_000 },
        ]);
        const mod = await import('@/app/api/n8n/reservas/crear/route');
        POST = mod.POST as any;
    });

    afterEach(() => vi.resetModules());

    it('devuelve 401 sin API key', async () => {
        vi.stubEnv('N8N_API_KEY', '');
        const res = await POST(req({}, ''));
        vi.unstubAllEnvs();
        expect(res.status).toBe(401);
    });

    it('devuelve 400 si faltan campos requeridos', async () => {
        const res = await POST(req({ nombreCliente: 'Juan' }));
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.success).toBe(false);
        expect(data.error).toContain('requeridos');
    });

    it('devuelve 400 si el servicio no existe', async () => {
        prisma.servicio.findFirst.mockResolvedValue(null);
        const res = await POST(req({ ...cliente, servicioId: 'x', fecha: FUTURA, hora: '07:00', numeroPasajeros: 2 }));
        expect(res.status).toBe(400);
        expect((await res.json()).status).toBe('servicio_no_encontrado');
    });

    it('devuelve 400 si no hay vehículo para la cantidad de pasajeros', async () => {
        const res = await POST(req({ ...cliente, servicioId: 'svc-guatape', fecha: FUTURA, hora: '07:00', numeroPasajeros: 50 }));
        expect(res.status).toBe(400);
        expect((await res.json()).error).toContain('pasajeros');
    });

    it('devuelve 400 si numeroPasajeros es 0', async () => {
        const res = await POST(req({ ...cliente, servicioId: 'svc-guatape', fecha: FUTURA, hora: '07:00', numeroPasajeros: 0 }));
        expect(res.status).toBe(400);
    });

    it('devuelve 400 si la fecha es inválida o ya pasó', async () => {
        const r1 = await POST(req({ ...cliente, servicioId: 'svc-guatape', fecha: 'not-a-date', hora: '07:00', numeroPasajeros: 2 }));
        expect(r1.status).toBe(400);
        const r2 = await POST(req({ ...cliente, servicioId: 'svc-guatape', fecha: '2020-01-01', hora: '07:00', numeroPasajeros: 2 }));
        expect(r2.status).toBe(400);
        expect((await r2.json()).status).toBe('fecha_pasada');
    });

    it('devuelve 400 si el correo es inválido', async () => {
        const res = await POST(req({ ...cliente, emailCliente: 'no-es-correo', servicioId: 'svc-guatape', fecha: FUTURA, hora: '07:00', numeroPasajeros: 2 }));
        expect(res.status).toBe(400);
    });

    it('crea un traslado con el vehículo adecuado y devuelve la URL de la cotización', async () => {
        const res = await POST(req({
            ...cliente, servicioId: 'svc-guatape', fecha: FUTURA, hora: '07:00', numeroPasajeros: 2,
            lugarRecogida: 'Hotel Belisario, El Poblado', trasladoDestino: 'Guatapé', notas: '3 maletas',
        }));
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.success).toBe(true);
        expect(data.url).toBe(`https://www.medellintransportes.com/reservas/confirmar/${data.codigo}`);
        expect(data.vehiculo).toBe('Auto 1 - 3');
        expect(data.totalEfectivo).toBe(140_000);
        expect(data.totalTarjeta).toBeCloseTo(140_000 * 1.06);

        const created = prisma.reserva.create.mock.calls[0][0].data;
        expect(created.origen).toBe('whatsapp_bot');
        expect(created.estado).toBe('PENDING_PAYMENT');
        expect(created.emailCliente).toBe('yecabusa23@gmail.com');
        expect(created.datos.lugarRecogida).toBe('Hotel Belisario, El Poblado');
        expect(created.datos.trasladoDestino).toBe('Guatapé');
        expect(created.notas).toBe('3 maletas');
        expect(created.municipio).toBe('MEDELLIN');
    });

    it('aeropuerto: exige aeropuerto y tipo', async () => {
        prisma.servicio.findFirst.mockResolvedValue(servicioAeropuerto);
        const r1 = await POST(req({ ...cliente, servicioId: 'svc-aeropuerto', fecha: FUTURA, hora: '23:00', numeroPasajeros: 5 }));
        expect((await r1.json()).status).toBe('falta_aeropuerto');
        const r2 = await POST(req({ ...cliente, servicioId: 'svc-aeropuerto', fecha: FUTURA, hora: '23:00', numeroPasajeros: 5, aeropuertoNombre: 'JOSE_MARIA_CORDOVA' }));
        expect((await r2.json()).status).toBe('falta_aeropuerto_tipo');
    });

    it('aeropuerto JMC de noche con póster: base + recargo + póster (caso de prueba del documento)', async () => {
        prisma.servicio.findFirst.mockResolvedValue(servicioAeropuerto);
        const res = await POST(req({
            ...cliente, servicioId: 'svc-aeropuerto', fecha: FUTURA, hora: '23:00', numeroPasajeros: 5,
            aeropuertoNombre: 'JOSE_MARIA_CORDOVA', aeropuertoTipo: 'DESDE', numeroVuelo: 'AB193',
            trasladoDestino: 'Hotel Belisario, El Poblado, Medellín', notas: '6 maletas',
            datosDinamicos: { Posterairport: true },
        }));
        const data = await res.json();
        expect(res.status).toBe(200);
        expect(data.vehiculo).toBe('Van 5 - 8');
        expect(data.desglose).toMatchObject({ precioBase: 220_000, adicionales: 15_000, recargoNocturno: 20_000 });
        expect(data.totalEfectivo).toBe(255_000);
        const created = prisma.reserva.create.mock.calls[0][0].data;
        expect(created.aeropuertoNombre).toBe('JOSE_MARIA_CORDOVA');
        expect(created.datos).toMatchObject({ aeropuertoTipo: 'DESDE', numeroVuelo: 'AB193', Posterairport: true });
    });

    it('aeropuerto Olaya Herrera usa su precio alterno', async () => {
        prisma.servicio.findFirst.mockResolvedValue(servicioAeropuerto);
        const res = await POST(req({
            ...cliente, servicioId: 'svc-aeropuerto', fecha: FUTURA, hora: '10:00', numeroPasajeros: 2,
            aeropuertoNombre: 'OLAYA_HERRERA', aeropuertoTipo: 'HACIA', lugarRecogida: 'Laureles',
        }));
        const data = await res.json();
        expect(data.totalEfectivo).toBe(100_000);
    });

    it('tour por persona: sin vehículo, precio por tramo × personas y hora por defecto', async () => {
        prisma.servicio.findFirst.mockResolvedValue(servicioPorPersona);
        const res = await POST(req({ ...cliente, servicioId: 'svc-comuna13', fecha: FUTURA, numeroPasajeros: 4 }));
        const data = await res.json();
        expect(res.status).toBe(200);
        expect(data.totalEfectivo).toBe(1_000_000);
        expect(data.vehiculo).toBeNull();
        const created = prisma.reserva.create.mock.calls[0][0].data;
        expect(created.vehiculoId).toBeNull();
        expect(created.hora).toBe('08:00');
        expect(created.municipio).toBeNull();
    });

    it('por horas: mínimo 4 horas y multiplica el precio', async () => {
        prisma.servicio.findFirst.mockResolvedValue(servicioPorHoras);
        const r1 = await POST(req({ ...cliente, servicioId: 'svc-horas', fecha: FUTURA, hora: '09:00', numeroPasajeros: 2, cantidadHoras: 2 }));
        expect((await r1.json()).status).toBe('falta_horas');
        const r2 = await POST(req({ ...cliente, servicioId: 'svc-horas', fecha: FUTURA, hora: '09:00', numeroPasajeros: 2, cantidadHoras: 5 }));
        expect((await r2.json()).totalEfectivo).toBe(325_000);
    });

    it('municipio de recogida con tarifa configurada suma el recargo; sin tarifa avisa', async () => {
        const r1 = await POST(req({ ...cliente, servicioId: 'svc-guatape', fecha: FUTURA, hora: '07:00', numeroPasajeros: 2, municipioNombre: 'rionegro' }));
        const d1 = await r1.json();
        expect(d1.totalEfectivo).toBe(180_000);
        expect(prisma.reserva.create.mock.calls[0][0].data).toMatchObject({ municipio: 'OTRO', municipioConfigId: 'mc-rionegro', otroMunicipio: 'Rionegro' });

        const r2 = await POST(req({ ...cliente, servicioId: 'svc-guatape', fecha: FUTURA, hora: '07:00', numeroPasajeros: 2, municipioNombre: 'Cartagena' }));
        expect((await r2.json()).status).toBe('municipio_no_configurado');
    });

    it('traslado municipal: no crea reserva y devuelve el enlace del formulario', async () => {
        prisma.servicio.findFirst.mockResolvedValue({ ...servicioTraslado, esMunicipal: true });
        const res = await POST(req({ ...cliente, servicioId: 'svc-guatape', fecha: FUTURA, hora: '07:00', numeroPasajeros: 2 }));
        const data = await res.json();
        expect(data.status).toBe('municipal');
        expect(prisma.reserva.create).not.toHaveBeenCalled();
    });

    it('responde con el nombre en inglés cuando idioma es EN', async () => {
        const res = await POST(req({ ...cliente, servicioId: 'svc-guatape', fecha: FUTURA, hora: '07:00', numeroPasajeros: 2, idioma: 'EN' }));
        expect((await res.json()).servicio).toBe('Guatapé Transfer');
    });
});
