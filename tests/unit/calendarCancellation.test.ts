import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    insert: vi.fn(), update: vi.fn(), remove: vi.fn(),
    findMany: vi.fn(), updateMany: vi.fn(),
}));
vi.mock('googleapis', () => ({ google: {
    auth: { JWT: class {} },
    calendar: () => ({ events: { insert: mocks.insert, update: mocks.update, delete: mocks.remove } }),
} }));
vi.mock('@/lib/prisma', () => ({ prisma: { reserva: {
    findMany: mocks.findMany, updateMany: mocks.updateMany,
} } }));

import { cancelReservationCalendarEvent, createCalendarEvent, updateCalendarEvent } from '@/lib/google-calendar-service';

const cancelled = {
    id: 'cancelled', codigo: 'RES-CANCEL', estado: 'CANCELLED',
    googleCalendarEventId: 'event-1', servicioId: 'service-1',
    servicio: { nombre: { es: 'Tour' }, esCompartido: false },
    fecha: new Date('2026-10-15T12:00:00Z'), hora: '10:00',
    numeroPasajeros: 2, precioTotal: 100000, metodoPago: 'EFECTIVO', datos: {},
} as any;

beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv('DISABLE_CALENDAR_SYNC', 'false');
    vi.stubEnv('GOOGLE_CALENDAR_ID', 'calendar-test');
    vi.stubEnv('GOOGLE_SERVICE_ACCOUNT_EMAIL', 'test@example.com');
    vi.stubEnv('GOOGLE_PRIVATE_KEY', 'test-key');
    mocks.remove.mockResolvedValue({});
    mocks.update.mockResolvedValue({});
    mocks.updateMany.mockResolvedValue({ count: 1 });
});

const sharedCancelled = () => ({ ...cancelled, servicio: { ...cancelled.servicio, esCompartido: true } });

describe('Cancelaciones en Google Calendar', () => {
    it('elimina y notifica, limpiando solo el vínculo de la reserva cancelada', async () => {
        expect(await cancelReservationCalendarEvent(cancelled)).toBe(true);
        expect(mocks.remove).toHaveBeenCalledWith({ calendarId: 'calendar-test', eventId: 'event-1', sendUpdates: 'all' });
        expect(mocks.updateMany).toHaveBeenCalledWith({
            where: { id: 'cancelled', estado: 'CANCELLED', googleCalendarEventId: 'event-1' },
            data: { googleCalendarEventId: null },
        });
    });

    it('conserva el vínculo si Google falla, para permitir reintentar', async () => {
        mocks.remove.mockRejectedValue({ code: 503 });
        expect(await cancelReservationCalendarEvent(cancelled)).toBe(false);
        expect(mocks.updateMany).not.toHaveBeenCalled();
    });

    it.each([404, 410])('limpia el vínculo si el evento ya fue eliminado (%s)', async (code) => {
        mocks.remove.mockRejectedValue({ response: { status: code } });
        expect(await cancelReservationCalendarEvent(cancelled)).toBe(true);
        expect(mocks.updateMany).toHaveBeenCalled();
    });

    it('elimina el evento compartido al cancelar la última reserva', async () => {
        mocks.findMany.mockResolvedValue([]);
        expect(await cancelReservationCalendarEvent(sharedCancelled())).toBe(true);
        expect(mocks.remove).toHaveBeenCalled();
        expect(mocks.update).not.toHaveBeenCalled();
        expect(mocks.insert).not.toHaveBeenCalled();
    });

    it('conserva las otras reservas del tour y excluye la cancelada del evento', async () => {
        mocks.findMany.mockResolvedValue([{ ...sharedCancelled(), id: 'active', codigo: 'RES-ACTIVE', estado: 'CONFIRMED_ASSIGNED' }]);
        expect(await cancelReservationCalendarEvent(sharedCancelled())).toBe(true);
        expect(mocks.findMany.mock.calls[0][0].where.estado).toEqual({ not: 'CANCELLED' });
        expect(mocks.remove).not.toHaveBeenCalled();
        const details = mocks.update.mock.calls[0][0].requestBody;
        expect(details.description).toContain('RES-ACTIVE');
        expect(details.description).not.toContain('RES-CANCEL');
        expect(details.summary).toContain('2 personas (1 reservas)');
        expect(mocks.updateMany).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({ estado: 'CANCELLED' }), data: { googleCalendarEventId: null },
        }));
    });

    it('no duplica el tour ante errores transitorios de Google', async () => {
        mocks.findMany.mockResolvedValue([{ ...sharedCancelled(), id: 'active', estado: 'CONFIRMED_ASSIGNED' }]);
        mocks.update.mockRejectedValue({ code: 503 });
        expect(await cancelReservationCalendarEvent(sharedCancelled())).toBe(false);
        expect(mocks.insert).not.toHaveBeenCalled();
        expect(mocks.updateMany).not.toHaveBeenCalled();
    });

    it('una actualización de reserva cancelada elimina el evento en vez de reprogramarlo', async () => {
        expect(await updateCalendarEvent(cancelled)).toBe(true);
        expect(mocks.remove).toHaveBeenCalled();
        expect(mocks.update).not.toHaveBeenCalled();
        expect(await createCalendarEvent(cancelled)).toBeNull();
        expect(mocks.insert).not.toHaveBeenCalled();
    });

    it.each(['true', '1'])('respeta el modo sin sincronización (%s)', async (value) => {
        vi.stubEnv('DISABLE_CALENDAR_SYNC', value);
        expect(await cancelReservationCalendarEvent(cancelled)).toBe(false);
        expect(mocks.remove).not.toHaveBeenCalled();
        expect(mocks.updateMany).not.toHaveBeenCalled();
    });
});
