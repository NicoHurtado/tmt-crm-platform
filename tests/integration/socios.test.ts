import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
    prisma: {
        socio: { findUnique: vi.fn() },
        socioReserva: { findUnique: vi.fn(), create: vi.fn() },
        servicio: { findFirst: vi.fn() },
        reserva: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
        $transaction: vi.fn(),
    },
}));

// Los efectos posteriores (calendario y correo) no deben salir a la red en tests.
vi.mock('@/lib/google-calendar-service', () => ({
    createCalendarEvent: vi.fn().mockResolvedValue(null),
}));
vi.mock('@/lib/email-service', () => ({
    sendReservaConfirmadaEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('crypto', async () => {
    const actual = await vi.importActual<typeof import('crypto')>('crypto');
    return { ...actual, default: { ...actual, randomInt: vi.fn().mockReturnValue(0) }, randomInt: vi.fn().mockReturnValue(0) };
});

const SOCIO = {
    id: 'socio-1',
    nombre: 'Housy (pruebas)',
    codigo: 'housy-test',
    apiKey: 'llave-de-prueba',
    activo: true,
    createdAt: new Date(),
    updatedAt: new Date(),
};

// Espeja el servicio real de aeropuerto en producción: recargo nocturno 22:00–03:00
// de $20.000, adicional "Póster aeropuerto" de $15.000 y precio alterno de Olaya.
const SERVICIO_AEROPUERTO = {
    id: 'svc-aeropuerto',
    nombre: { es: 'Traslado Privado Aeropuerto', en: 'Private Airport Transfer' },
    activo: true,
    esAeropuerto: true,
    esCompartido: false,
    esPorHoras: false,
    esMunicipal: false,
    esTraslado: false,
    aplicaRecargoNocturno: true,
    recargoNocturnoInicio: '22:00',
    recargoNocturnoFin: '03:00',
    montoRecargoNocturno: 20_000,
    configuracion: {
        camposCustom: [
            {
                tipo: 'SWITCH',
                clave: 'Posterairport',
                orden: 0,
                etiqueta: { es: 'Póster aeropuerto', en: 'Airport poster' },
                requerido: false,
                tienePrecio: true,
                precioUnitario: 15_000,
            },
        ],
    },
    vehiculosPermitidos: [
        {
            vehiculoId: 'veh-auto',
            precio: 140_000,
            precioOlaya: 80_000,
            vehiculo: {
                id: 'veh-auto',
                nombre: 'Auto 1 - 3',
                capacidadMinima: 1,
                capacidadMaxima: 3,
                imagen: '',
                activo: true,
            },
        },
        {
            vehiculoId: 'veh-van',
            precio: 240_000,
            precioOlaya: 120_000,
            vehiculo: {
                id: 'veh-van',
                nombre: 'Van 5 - 8',
                capacidadMinima: 5,
                capacidadMaxima: 8,
                imagen: '',
                activo: true,
            },
        },
    ],
};

const RESERVA_BASE = {
    id: 'res-1',
    codigo: 'AAAAAAAA',
    estado: 'CONFIRMED_UNASSIGNED',
    fecha: new Date('2026-09-14T12:00:00.000Z'),
    hora: '14:30',
    numeroPasajeros: 2,
    precioTotal: 140_000,
    idioma: 'ES',
    vehiculo: SERVICIO_AEROPUERTO.vehiculosPermitidos[0].vehiculo,
    servicio: SERVICIO_AEROPUERTO,
    conductor: null,
};

const BODY_RESERVA_VALIDO = {
    refExterna: 'hsy_1',
    servicioId: 'svc-aeropuerto',
    numeroPasajeros: 2,
    fecha: '2026-09-14',
    hora: '14:30',
    aeropuertoNombre: 'JOSE_MARIA_CORDOVA',
    aeropuertoTipo: 'DESDE',
    lugarRecogida: 'Cra 43A #7-50, Apto 1204, El Poblado',
    numeroVuelo: 'AV8432',
    nombreCliente: 'Juan Pérez',
    whatsappCliente: '+573001234567',
    emailCliente: 'juan@test.com',
};

function post(url: string, body: unknown, apiKey?: string) {
    return new Request(url, {
        method: 'POST',
        headers: apiKey ? { 'x-api-key': apiKey, 'Content-Type': 'application/json' } : {},
        body: JSON.stringify(body),
    });
}

describe('API de socios', () => {
    let prisma: any;

    beforeEach(async () => {
        vi.clearAllMocks();
        const prismaMod = await import('@/lib/prisma');
        prisma = prismaMod.prisma;

        prisma.socio.findUnique.mockResolvedValue(SOCIO);
        prisma.servicio.findFirst.mockResolvedValue(SERVICIO_AEROPUERTO);
        prisma.socioReserva.findUnique.mockResolvedValue(null);
        prisma.reserva.findUnique.mockResolvedValue(null);
        prisma.reserva.create.mockResolvedValue(RESERVA_BASE);
        prisma.socioReserva.create.mockResolvedValue({ id: 'sr-1' });
        prisma.$transaction.mockImplementation(async (fn: any) =>
            fn({ reserva: prisma.reserva, socioReserva: prisma.socioReserva })
        );
    });

    afterEach(() => {
        vi.resetModules();
    });

    // ── Autenticación ─────────────────────────────────────────────────────────

    it('rechaza requests sin x-api-key', async () => {
        const { POST } = await import('@/app/api/socios/cotizar/route');
        const res = await POST(post('http://localhost/api/socios/cotizar', {}) as any);

        expect(res.status).toBe(401);
        expect(prisma.servicio.findFirst).not.toHaveBeenCalled();
    });

    it('rechaza la llave de un socio desactivado', async () => {
        prisma.socio.findUnique.mockResolvedValue({ ...SOCIO, activo: false });
        const { POST } = await import('@/app/api/socios/cotizar/route');
        const res = await POST(post('http://localhost/api/socios/cotizar', {}, 'llave-de-prueba') as any);

        expect(res.status).toBe(401);
    });

    // ── Cotización ────────────────────────────────────────────────────────────

    it('cotiza el precio público del vehículo que cubre al grupo', async () => {
        const { POST } = await import('@/app/api/socios/cotizar/route');
        const res = await POST(
            post(
                'http://localhost/api/socios/cotizar',
                {
                    servicioId: 'svc-aeropuerto',
                    numeroPasajeros: 2,
                    hora: '14:30',
                    aeropuertoNombre: 'JOSE_MARIA_CORDOVA',
                },
                'llave-de-prueba'
            ) as any
        );
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.ok).toBe(true);
        expect(body.vehiculo.nombre).toBe('Auto 1 - 3');
        expect(body.desglose.precioBase).toBe(140_000);
        expect(body.desglose.recargoNocturno).toBe(0);
        expect(body.desglose.tarifaMunicipio).toBe(0);
        expect(body.total).toBe(140_000);
        expect(body.moneda).toBe('COP');
    });

    it('suma el recargo nocturno dentro de la franja 22:00–03:00', async () => {
        const { POST } = await import('@/app/api/socios/cotizar/route');
        const res = await POST(
            post(
                'http://localhost/api/socios/cotizar',
                {
                    servicioId: 'svc-aeropuerto',
                    numeroPasajeros: 2,
                    hora: '23:30',
                    aeropuertoNombre: 'JOSE_MARIA_CORDOVA',
                },
                'llave-de-prueba'
            ) as any
        );
        const body = await res.json();

        expect(body.desglose.recargoNocturno).toBe(20_000);
        expect(body.total).toBe(160_000);
    });

    it('usa el precio alterno cuando el aeropuerto es Olaya Herrera', async () => {
        const { POST } = await import('@/app/api/socios/cotizar/route');
        const res = await POST(
            post(
                'http://localhost/api/socios/cotizar',
                {
                    servicioId: 'svc-aeropuerto',
                    numeroPasajeros: 2,
                    hora: '14:30',
                    aeropuertoNombre: 'OLAYA_HERRERA',
                },
                'llave-de-prueba'
            ) as any
        );
        const body = await res.json();

        expect(body.desglose.precioBase).toBe(80_000);
        expect(body.total).toBe(80_000);
    });

    it('cobra los adicionales del servicio cuando el socio los envía', async () => {
        const { POST } = await import('@/app/api/socios/cotizar/route');
        const res = await POST(
            post(
                'http://localhost/api/socios/cotizar',
                {
                    servicioId: 'svc-aeropuerto',
                    numeroPasajeros: 2,
                    hora: '14:30',
                    aeropuertoNombre: 'JOSE_MARIA_CORDOVA',
                    datosDinamicos: { Posterairport: true },
                },
                'llave-de-prueba'
            ) as any
        );
        const body = await res.json();

        expect(body.desglose.precioAdicionales).toBe(15_000);
        expect(body.total).toBe(155_000);
    });

    it('exige el aeropuerto en servicios de aeropuerto', async () => {
        const { POST } = await import('@/app/api/socios/cotizar/route');
        const res = await POST(
            post(
                'http://localhost/api/socios/cotizar',
                { servicioId: 'svc-aeropuerto', numeroPasajeros: 2, hora: '14:30' },
                'llave-de-prueba'
            ) as any
        );
        const body = await res.json();

        expect(res.status).toBe(400);
        expect(body.error).toContain('aeropuertoNombre es requerido');
    });

    it('responde 400 cuando ningún vehículo cubre al grupo', async () => {
        const { POST } = await import('@/app/api/socios/cotizar/route');
        const res = await POST(
            post(
                'http://localhost/api/socios/cotizar',
                {
                    servicioId: 'svc-aeropuerto',
                    numeroPasajeros: 40,
                    hora: '14:30',
                    aeropuertoNombre: 'JOSE_MARIA_CORDOVA',
                },
                'llave-de-prueba'
            ) as any
        );
        const body = await res.json();

        expect(res.status).toBe(400);
        expect(body.error).toContain('No hay vehículo disponible para 40 pasajeros');
    });

    it('rechaza servicios con tarifa por persona, que usan otro modelo de precio', async () => {
        prisma.servicio.findFirst.mockResolvedValue({
            ...SERVICIO_AEROPUERTO,
            esAeropuerto: false,
            configuracion: {
                camposCustom: [],
                tipoTarifa: 'POR_PERSONA',
                preciosPorPersona: { p1: 700_000, p2: 350_000, p3: 270_000 },
            },
        });

        const { POST } = await import('@/app/api/socios/cotizar/route');
        const res = await POST(
            post(
                'http://localhost/api/socios/cotizar',
                { servicioId: 'svc-tour', numeroPasajeros: 2, hora: '08:00' },
                'llave-de-prueba'
            ) as any
        );
        const body = await res.json();

        expect(res.status).toBe(400);
        expect(body.error).toContain('no está disponible por la API de socios');
    });

    // ── Creación de reservas ──────────────────────────────────────────────────

    it('crea la reserva marcada como pagada por el socio', async () => {
        const { POST } = await import('@/app/api/socios/reservas/route');
        const res = await POST(
            post('http://localhost/api/socios/reservas', BODY_RESERVA_VALIDO, 'llave-de-prueba') as any
        );
        const body = await res.json();

        expect(res.status).toBe(201);
        expect(body.ok).toBe(true);
        expect(body.duplicado).toBe(false);
        expect(body.codigo).toBe('AAAAAAAA');

        expect(prisma.reserva.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    servicioId: 'svc-aeropuerto',
                    vehiculoId: 'veh-auto',
                    origen: 'socio:housy-test',
                    clientePaga: false,
                    esReservaAliado: false,
                    aliadoId: null,
                    estado: 'CONFIRMED_UNASSIGNED',
                    estadoPago: 'APROBADO',
                    metodoPago: 'EFECTIVO',
                    comisionBold: 0,
                    comisionAliado: 0,
                    municipio: null,
                    municipioConfigId: null,
                    aeropuertoNombre: 'JOSE_MARIA_CORDOVA',
                    precioBase: 140_000,
                    precioTotal: 140_000,
                }),
            })
        );
    });

    it('guarda el sentido, la dirección y el vuelo en datos', async () => {
        const { POST } = await import('@/app/api/socios/reservas/route');
        await POST(post('http://localhost/api/socios/reservas', BODY_RESERVA_VALIDO, 'llave-de-prueba') as any);

        const datos = prisma.reserva.create.mock.calls[0][0].data.datos;
        expect(datos).toMatchObject({
            aeropuertoTipo: 'DESDE',
            aeropuertoNombre: 'JOSE_MARIA_CORDOVA',
            lugarRecogida: 'Cra 43A #7-50, Apto 1204, El Poblado',
            numeroVuelo: 'AV8432',
        });
    });

    it('registra la trazabilidad del socio junto con la reserva', async () => {
        const { POST } = await import('@/app/api/socios/reservas/route');
        await POST(post('http://localhost/api/socios/reservas', BODY_RESERVA_VALIDO, 'llave-de-prueba') as any);

        expect(prisma.socioReserva.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    socioId: 'socio-1',
                    reservaId: 'res-1',
                    refExterna: 'hsy_1',
                }),
            })
        );
    });

    it('no duplica la reserva cuando se reintenta con la misma refExterna', async () => {
        prisma.socioReserva.findUnique.mockResolvedValue({ reserva: RESERVA_BASE });

        const { POST } = await import('@/app/api/socios/reservas/route');
        const res = await POST(
            post('http://localhost/api/socios/reservas', BODY_RESERVA_VALIDO, 'llave-de-prueba') as any
        );
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.duplicado).toBe(true);
        expect(body.codigo).toBe('AAAAAAAA');
        expect(prisma.reserva.create).not.toHaveBeenCalled();
    });

    it('exige la dirección del alojamiento en traslados de aeropuerto', async () => {
        const { POST } = await import('@/app/api/socios/reservas/route');
        const res = await POST(
            post(
                'http://localhost/api/socios/reservas',
                { ...BODY_RESERVA_VALIDO, lugarRecogida: '' },
                'llave-de-prueba'
            ) as any
        );
        const body = await res.json();

        expect(res.status).toBe(400);
        expect(body.error).toContain('lugarRecogida es requerido');
        expect(prisma.reserva.create).not.toHaveBeenCalled();
    });

    it('exige el sentido del traslado de aeropuerto', async () => {
        const { POST } = await import('@/app/api/socios/reservas/route');
        const res = await POST(
            post(
                'http://localhost/api/socios/reservas',
                { ...BODY_RESERVA_VALIDO, aeropuertoTipo: undefined },
                'llave-de-prueba'
            ) as any
        );
        const body = await res.json();

        expect(res.status).toBe(400);
        expect(body.error).toContain('aeropuertoTipo');
    });

    it('valida el formato de la fecha', async () => {
        const { POST } = await import('@/app/api/socios/reservas/route');
        const res = await POST(
            post(
                'http://localhost/api/socios/reservas',
                { ...BODY_RESERVA_VALIDO, fecha: '14/09/2026' },
                'llave-de-prueba'
            ) as any
        );
        const body = await res.json();

        expect(res.status).toBe(400);
        expect(body.error).toContain('YYYY-MM-DD');
    });

    it('rechaza una fecha que no existe en el calendario en vez de correrla de mes', async () => {
        const { POST } = await import('@/app/api/socios/reservas/route');
        const res = await POST(
            post(
                'http://localhost/api/socios/reservas',
                { ...BODY_RESERVA_VALIDO, fecha: '2026-02-31' },
                'llave-de-prueba'
            ) as any
        );
        const body = await res.json();

        expect(res.status).toBe(400);
        expect(body.error).toContain('fecha inexistente');
        expect(prisma.reserva.create).not.toHaveBeenCalled();
    });

    it('guarda la fecha al mediodía UTC para que el día no se corra', async () => {
        const { POST } = await import('@/app/api/socios/reservas/route');
        await POST(post('http://localhost/api/socios/reservas', BODY_RESERVA_VALIDO, 'llave-de-prueba') as any);

        const fecha: Date = prisma.reserva.create.mock.calls[0][0].data.fecha;
        expect(fecha.toISOString()).toBe('2026-09-14T12:00:00.000Z');
    });

    // ── Datos de contacto ─────────────────────────────────────────────────────
    // El correo y el WhatsApp son los dos únicos canales con el huésped. Un fallo de
    // envío no tumba la reserva, así que un dato malo pasaría inadvertido: se validan
    // en la entrada para que el socio corrija antes de cobrarle al huésped.

    it('rechaza un correo con formato inválido', async () => {
        const { POST } = await import('@/app/api/socios/reservas/route');
        const res = await POST(
            post(
                'http://localhost/api/socios/reservas',
                { ...BODY_RESERVA_VALIDO, emailCliente: 'juan@test' },
                'llave-de-prueba'
            ) as any
        );
        const body = await res.json();

        expect(res.status).toBe(400);
        expect(body.error).toContain('emailCliente');
        expect(prisma.reserva.create).not.toHaveBeenCalled();
    });

    it('rechaza un WhatsApp sin indicativo de país', async () => {
        const { POST } = await import('@/app/api/socios/reservas/route');
        const res = await POST(
            post(
                'http://localhost/api/socios/reservas',
                { ...BODY_RESERVA_VALIDO, whatsappCliente: '3001234567' },
                'llave-de-prueba'
            ) as any
        );
        const body = await res.json();

        expect(res.status).toBe(400);
        expect(body.error).toContain('whatsappCliente');
        expect(prisma.reserva.create).not.toHaveBeenCalled();
    });

    it('rechaza un WhatsApp con letras mezcladas en vez de limpiarlas en silencio', async () => {
        const { POST } = await import('@/app/api/socios/reservas/route');
        const res = await POST(
            post(
                'http://localhost/api/socios/reservas',
                { ...BODY_RESERVA_VALIDO, whatsappCliente: '+57abc3001234567' },
                'llave-de-prueba'
            ) as any
        );

        expect(res.status).toBe(400);
        expect(prisma.reserva.create).not.toHaveBeenCalled();
    });

    it('rechaza numeroPasajeros que no sea número ni cadena numérica', async () => {
        const { POST } = await import('@/app/api/socios/reservas/route');
        for (const valor of [true, [2], { n: 2 }]) {
            vi.clearAllMocks();
            prisma.socio.findUnique.mockResolvedValue(SOCIO);
            prisma.servicio.findFirst.mockResolvedValue(SERVICIO_AEROPUERTO);
            prisma.socioReserva.findUnique.mockResolvedValue(null);

            const res = await POST(
                post(
                    'http://localhost/api/socios/reservas',
                    { ...BODY_RESERVA_VALIDO, numeroPasajeros: valor },
                    'llave-de-prueba'
                ) as any
            );

            expect(res.status, `numeroPasajeros: ${JSON.stringify(valor)}`).toBe(400);
            expect(prisma.reserva.create).not.toHaveBeenCalled();
        }
    });

    it('normaliza el WhatsApp a +<dígitos> para que el link del conductor abra', async () => {
        const { POST } = await import('@/app/api/socios/reservas/route');
        await POST(
            post(
                'http://localhost/api/socios/reservas',
                { ...BODY_RESERVA_VALIDO, whatsappCliente: '+57 (300) 123-4567' },
                'llave-de-prueba'
            ) as any
        );

        expect(prisma.reserva.create.mock.calls[0][0].data.whatsappCliente).toBe('+573001234567');
    });

    it('normaliza el correo a minúsculas', async () => {
        const { POST } = await import('@/app/api/socios/reservas/route');
        await POST(
            post(
                'http://localhost/api/socios/reservas',
                { ...BODY_RESERVA_VALIDO, emailCliente: 'Juan@Test.COM' },
                'llave-de-prueba'
            ) as any
        );

        expect(prisma.reserva.create.mock.calls[0][0].data.emailCliente).toBe('juan@test.com');
    });

    // ── Códigos de error ──────────────────────────────────────────────────────
    // La guía le dice al socio que reintente ante un 500 y que NO reintente ante un 400.
    // Si una falla nuestra saliera como 400, el socio daría por perdida una reserva que
    // ya le cobró al huésped.

    it('responde 500 y no 400 cuando la falla es nuestra', async () => {
        prisma.$transaction.mockRejectedValue(new Error('connection terminated unexpectedly'));

        const { POST } = await import('@/app/api/socios/reservas/route');
        const res = await POST(
            post('http://localhost/api/socios/reservas', BODY_RESERVA_VALIDO, 'llave-de-prueba') as any
        );
        const body = await res.json();

        expect(res.status).toBe(500);
        expect(body.ok).toBe(false);
        expect(body.error).toContain('Reintenta con la misma refExterna');
        // El detalle interno no se le expone al socio.
        expect(body.error).not.toContain('connection terminated');
    });

    it('responde 500 cuando la cotización falla por un error inesperado', async () => {
        prisma.servicio.findFirst.mockRejectedValue(new Error('pool exhausted'));

        const { POST } = await import('@/app/api/socios/cotizar/route');
        const res = await POST(
            post(
                'http://localhost/api/socios/cotizar',
                { servicioId: 'svc-aeropuerto', numeroPasajeros: 2, hora: '14:30', aeropuertoNombre: 'JOSE_MARIA_CORDOVA' },
                'llave-de-prueba'
            ) as any
        );

        expect(res.status).toBe(500);
        expect((await res.json()).error).not.toContain('pool exhausted');
    });

    it('sigue respondiendo 400 cuando la petición del socio es la que está mal', async () => {
        const { POST } = await import('@/app/api/socios/reservas/route');
        const res = await POST(
            post(
                'http://localhost/api/socios/reservas',
                { ...BODY_RESERVA_VALIDO, numeroPasajeros: 0 },
                'llave-de-prueba'
            ) as any
        );

        expect(res.status).toBe(400);
    });
});
