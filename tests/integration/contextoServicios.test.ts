import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
    prisma: {
        servicio: {
            findMany: vi.fn(),
        },
    },
}));

const mockServicios = [
    {
        id: 'svc-guatape-1',
        tipoServicio: 'TOUR_GUATAPE',
        nombre: { es: 'Tour Guatapé', en: 'Guatapé Tour' },
        descripcion: { es: 'Tour al embalse', en: 'Lake tour' },
        incluye: { es: 'Transporte', en: 'Transport' },
        duracion: '10 horas',
        precioBase: 150_000,
        aplicaRecargoNocturno: false,
        recargoNocturnoInicio: null,
        recargoNocturnoFin: null,
        montoRecargoNocturno: null,
        esPorHoras: false,
        esMunicipal: false,
        configuracion: { camposCustom: [] },
        vehiculosPermitidos: [
            {
                precio: 150_000,
                vehiculo: {
                    nombre: 'Van',
                    capacidadMinima: 1,
                    capacidadMaxima: 7,
                    precioBase: 140_000,
                },
            },
        ],
        tarifasMunicipios: [],
        adicionales: [],
    },
    {
        id: 'svc-city-1',
        tipoServicio: 'CITY_TOUR',
        nombre: { es: 'City Tour Medellín', en: 'Medellín City Tour' },
        descripcion: { es: 'Recorrido por la ciudad', en: 'City sightseeing' },
        incluye: { es: 'Guía', en: 'Guide' },
        duracion: '4 horas',
        precioBase: 80_000,
        aplicaRecargoNocturno: false,
        recargoNocturnoInicio: null,
        recargoNocturnoFin: null,
        montoRecargoNocturno: null,
        esPorHoras: false,
        esMunicipal: false,
        configuracion: { camposCustom: [] },
        vehiculosPermitidos: [],
        tarifasMunicipios: [],
        adicionales: [],
    },
];

describe('GET /api/n8n/contexto-servicios', () => {
    let GET: (req: Request) => Promise<Response>;
    let prisma: any;

    beforeEach(async () => {
        vi.clearAllMocks();
        vi.stubEnv('N8N_API_KEY', 'test-key');
        const mod = await import('@/lib/prisma');
        prisma = mod.prisma;
        prisma.servicio.findMany.mockResolvedValue(mockServicios);
        const routeMod = await import('@/app/api/n8n/contexto-servicios/route');
        GET = routeMod.GET;
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        vi.resetModules();
    });

    it('devuelve 401 sin API key', async () => {
        vi.stubEnv('N8N_API_KEY', 'real-key');
        const req = new Request('http://localhost/api/n8n/contexto-servicios');
        const res = await GET(req);
        expect(res.status).toBe(401);
    });

    it('devuelve 200 con API key válida', async () => {
        const req = new Request('http://localhost/api/n8n/contexto-servicios', {
            headers: { 'x-api-key': 'test-key' },
        });
        const res = await GET(req);
        expect(res.status).toBe(200);
    });

    it('systemPrompt contiene la persona de Mía', async () => {
        const req = new Request('http://localhost/api/n8n/contexto-servicios', {
            headers: { 'x-api-key': 'test-key' },
        });
        const res = await GET(req);
        const data = await res.json();
        expect(data.systemPrompt).toContain('Mía');
        expect(data.systemPrompt).toContain('TMT Travel');
    });

    it('systemPrompt contiene los servicios mockeados', async () => {
        const req = new Request('http://localhost/api/n8n/contexto-servicios', {
            headers: { 'x-api-key': 'test-key' },
        });
        const res = await GET(req);
        const data = await res.json();
        expect(data.systemPrompt).toContain('TOUR_GUATAPE');
        expect(data.systemPrompt).toContain('CITY_TOUR');
        expect(data.systemPrompt).toContain('Tour Guatapé');
    });

    it('devuelve serviciosCount correcto', async () => {
        const req = new Request('http://localhost/api/n8n/contexto-servicios', {
            headers: { 'x-api-key': 'test-key' },
        });
        const res = await GET(req);
        const data = await res.json();
        expect(data.serviciosCount).toBe(2);
    });

    it('devuelve updatedAt como ISO string', async () => {
        const req = new Request('http://localhost/api/n8n/contexto-servicios', {
            headers: { 'x-api-key': 'test-key' },
        });
        const res = await GET(req);
        const data = await res.json();
        expect(data.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
});
