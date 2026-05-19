import { describe, it, expect } from 'vitest';
import { EstadoReserva } from '@prisma/client';
import {
    canTransitionTo,
    getAvailableTransitions,
    getStateLabel,
    getStateBadge,
    getStateDot,
} from '@/lib/state-transitions';

describe('canTransitionTo', () => {
    it('PENDING_PAYMENT puede ir a CONFIRMED_UNASSIGNED', () => {
        expect(canTransitionTo(EstadoReserva.PENDING_PAYMENT, EstadoReserva.CONFIRMED_UNASSIGNED)).toBe(true);
    });

    it('PENDING_PAYMENT puede ir a PAYMENT_FAILED', () => {
        expect(canTransitionTo(EstadoReserva.PENDING_PAYMENT, EstadoReserva.PAYMENT_FAILED)).toBe(true);
    });

    it('PENDING_PAYMENT puede ser cancelada', () => {
        expect(canTransitionTo(EstadoReserva.PENDING_PAYMENT, EstadoReserva.CANCELLED)).toBe(true);
    });

    it('PENDING_PAYMENT NO puede ir a IN_PROGRESS', () => {
        expect(canTransitionTo(EstadoReserva.PENDING_PAYMENT, EstadoReserva.IN_PROGRESS)).toBe(false);
    });

    it('CONFIRMED_UNASSIGNED puede ir a CONFIRMED_ASSIGNED', () => {
        expect(canTransitionTo(EstadoReserva.CONFIRMED_UNASSIGNED, EstadoReserva.CONFIRMED_ASSIGNED)).toBe(true);
    });

    it('CONFIRMED_ASSIGNED puede ir a IN_PROGRESS', () => {
        expect(canTransitionTo(EstadoReserva.CONFIRMED_ASSIGNED, EstadoReserva.IN_PROGRESS)).toBe(true);
    });

    it('IN_PROGRESS puede ir a COMPLETED', () => {
        expect(canTransitionTo(EstadoReserva.IN_PROGRESS, EstadoReserva.COMPLETED)).toBe(true);
    });

    it('COMPLETED es estado final — sin transiciones', () => {
        expect(canTransitionTo(EstadoReserva.COMPLETED, EstadoReserva.CANCELLED)).toBe(false);
        expect(canTransitionTo(EstadoReserva.COMPLETED, EstadoReserva.IN_PROGRESS)).toBe(false);
    });

    it('CANCELLED es estado final — sin transiciones', () => {
        expect(canTransitionTo(EstadoReserva.CANCELLED, EstadoReserva.CONFIRMED_UNASSIGNED)).toBe(false);
        expect(canTransitionTo(EstadoReserva.CANCELLED, EstadoReserva.IN_PROGRESS)).toBe(false);
    });

    it('PAYMENT_FAILED puede volver a PENDING_PAYMENT', () => {
        expect(canTransitionTo(EstadoReserva.PAYMENT_FAILED, EstadoReserva.PENDING_PAYMENT)).toBe(true);
    });

    it('PAYMENT_FAILED puede ser cancelada', () => {
        expect(canTransitionTo(EstadoReserva.PAYMENT_FAILED, EstadoReserva.CANCELLED)).toBe(true);
    });

    it('retorna false para estados iguales (misma transición)', () => {
        expect(canTransitionTo(EstadoReserva.IN_PROGRESS, EstadoReserva.IN_PROGRESS)).toBe(false);
    });
});

describe('getAvailableTransitions', () => {
    it('PENDING_PAYMENT tiene 3 transiciones disponibles', () => {
        const transitions = getAvailableTransitions(EstadoReserva.PENDING_PAYMENT);
        expect(transitions).toHaveLength(3);
        expect(transitions).toContain(EstadoReserva.CONFIRMED_UNASSIGNED);
        expect(transitions).toContain(EstadoReserva.PAYMENT_FAILED);
        expect(transitions).toContain(EstadoReserva.CANCELLED);
    });

    it('COMPLETED no tiene transiciones disponibles', () => {
        expect(getAvailableTransitions(EstadoReserva.COMPLETED)).toHaveLength(0);
    });

    it('CANCELLED no tiene transiciones disponibles', () => {
        expect(getAvailableTransitions(EstadoReserva.CANCELLED)).toHaveLength(0);
    });
});

describe('getStateLabel', () => {
    it('retorna etiquetas en español para todos los estados', () => {
        expect(getStateLabel(EstadoReserva.PENDING_PAYMENT)).toBe('Pendiente de Pago');
        expect(getStateLabel(EstadoReserva.CONFIRMED_UNASSIGNED)).toBe('Confirmada · Sin Asignar');
        expect(getStateLabel(EstadoReserva.CONFIRMED_ASSIGNED)).toBe('Confirmada · Asignada');
        expect(getStateLabel(EstadoReserva.IN_PROGRESS)).toBe('En Curso');
        expect(getStateLabel(EstadoReserva.COMPLETED)).toBe('Completada');
        expect(getStateLabel(EstadoReserva.CANCELLED)).toBe('Cancelada');
        expect(getStateLabel(EstadoReserva.PAYMENT_FAILED)).toBe('Pago Fallido');
    });

    it('retorna el propio estado si no hay etiqueta', () => {
        expect(getStateLabel('ESTADO_DESCONOCIDO' as EstadoReserva)).toBe('ESTADO_DESCONOCIDO');
    });
});

describe('getStateBadge', () => {
    it('retorna clases CSS válidas para cada estado', () => {
        for (const estado of Object.values(EstadoReserva)) {
            const badge = getStateBadge(estado);
            expect(badge).toBeTruthy();
            expect(typeof badge).toBe('string');
        }
    });

    it('retorna fallback para estado desconocido', () => {
        const badge = getStateBadge('ESTADO_RARO');
        expect(badge).toContain('neutral');
    });
});

describe('getStateDot', () => {
    it('retorna clase de color de punto para cada estado', () => {
        const dot = getStateDot(EstadoReserva.PENDING_PAYMENT);
        expect(dot).toContain('bg-');
    });
});
