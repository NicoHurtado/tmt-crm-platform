import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    findUnique: vi.fn(), update: vi.fn(), cancelCalendar: vi.fn(), email: vi.fn(),
}));
vi.mock('@/lib/prisma', () => ({ prisma: { reserva: {
    findUnique: mocks.findUnique, update: mocks.update,
} } }));
vi.mock('@/lib/google-calendar-service', () => ({ cancelReservationCalendarEvent: mocks.cancelCalendar }));
vi.mock('@/lib/email-service', () => ({ sendCancelacionEmail: mocks.email }));
vi.mock('@/lib/timeline-states', () => ({ canCancelReservation: () => true }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn().mockResolvedValue({ user: { id: 'admin' } }) }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));

import { getServerSession } from 'next-auth';
import { POST } from '@/app/api/reservas/[codigo]/cancelar/route';
import { DELETE } from '@/app/api/reservas/[codigo]/route';

const reservation = {
    id: 'res-1', codigo: 'RES-001', estado: 'CONFIRMED_ASSIGNED', idioma: 'ES',
    googleCalendarEventId: 'event-1', servicio: { esCompartido: false },
};

beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'admin' } });
    mocks.findUnique.mockResolvedValue(reservation);
    mocks.update.mockResolvedValue({ ...reservation, estado: 'CANCELLED' });
    mocks.cancelCalendar.mockResolvedValue(true);
    mocks.email.mockResolvedValue(undefined);
});

describe('Cancelación conserva historial, aviso y sincroniza Calendar', () => {
    it.each(['cliente', 'admin'])('%s retira el evento y mantiene la reserva cancelada', async (actor) => {
        const response = actor === 'cliente'
            ? await POST(new Request('http://localhost/cancelar', { method: 'POST' }) as any, { params: Promise.resolve({ codigo: 'RES-001' }) })
            : await DELETE(new Request('http://localhost/reservas/RES-001', { method: 'DELETE' }) as any, { params: Promise.resolve({ codigo: 'RES-001' }) });
        expect(response.status).toBe(200);
        expect((await response.json()).data.estado).toBe('CANCELLED');
        expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ data: { estado: 'CANCELLED' } }));
        expect(mocks.email).toHaveBeenCalledWith(expect.objectContaining({ estado: 'CANCELLED' }), 'ES');
        expect(mocks.cancelCalendar).toHaveBeenCalledWith(expect.objectContaining({ estado: 'CANCELLED', googleCalendarEventId: 'event-1' }));
    });

    it('un fallo del correo no impide retirar el evento', async () => {
        mocks.email.mockRejectedValue(new Error('SMTP unavailable'));
        const response = await POST(new Request('http://localhost/cancelar', { method: 'POST' }) as any, { params: Promise.resolve({ codigo: 'RES-001' }) });
        expect(response.status).toBe(200);
        expect(mocks.cancelCalendar).toHaveBeenCalled();
    });
});
