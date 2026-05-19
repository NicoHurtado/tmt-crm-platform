import { EstadoReserva } from '@prisma/client';
import { FiCheck, FiClock, FiX, FiTruck, FiCheckCircle, FiAlertCircle, FiPlay } from 'react-icons/fi';
import { STATE_COLORS } from '@/lib/state-transitions';

export interface TimelineState {
    label: string;
    icon: any;
    color: string;
    bgColor: string;
    description: string;
}

export const TIMELINE_STATES: Record<EstadoReserva, TimelineState> = {
    [EstadoReserva.PENDING_PAYMENT]: {
        label: 'Pendiente de Pago',
        icon: FiClock,
        color: STATE_COLORS[EstadoReserva.PENDING_PAYMENT].text,
        bgColor: STATE_COLORS[EstadoReserva.PENDING_PAYMENT].bg,
        description: 'Reserva confirmada. Pendiente de pago'
    },
    [EstadoReserva.CONFIRMED_UNASSIGNED]: {
        label: 'Confirmada · Sin Asignar',
        icon: FiCheck,
        color: STATE_COLORS[EstadoReserva.CONFIRMED_UNASSIGNED].text,
        bgColor: STATE_COLORS[EstadoReserva.CONFIRMED_UNASSIGNED].bg,
        description: 'Reserva confirmada. Asignando conductor'
    },
    [EstadoReserva.CONFIRMED_ASSIGNED]: {
        label: 'Confirmada · Asignada',
        icon: FiTruck,
        color: STATE_COLORS[EstadoReserva.CONFIRMED_ASSIGNED].text,
        bgColor: STATE_COLORS[EstadoReserva.CONFIRMED_ASSIGNED].bg,
        description: 'Conductor asignado. Listo para tu viaje'
    },
    [EstadoReserva.IN_PROGRESS]: {
        label: 'En Curso',
        icon: FiPlay,
        color: STATE_COLORS[EstadoReserva.IN_PROGRESS].text,
        bgColor: STATE_COLORS[EstadoReserva.IN_PROGRESS].bg,
        description: 'Servicio en ejecución'
    },
    [EstadoReserva.COMPLETED]: {
        label: 'Completada',
        icon: FiCheckCircle,
        color: STATE_COLORS[EstadoReserva.COMPLETED].text,
        bgColor: STATE_COLORS[EstadoReserva.COMPLETED].bg,
        description: 'Servicio completado exitosamente'
    },
    [EstadoReserva.CANCELLED]: {
        label: 'Cancelada',
        icon: FiX,
        color: STATE_COLORS[EstadoReserva.CANCELLED].text,
        bgColor: STATE_COLORS[EstadoReserva.CANCELLED].bg,
        description: 'Reserva cancelada'
    },
    [EstadoReserva.PAYMENT_FAILED]: {
        label: 'Pago Fallido',
        icon: FiAlertCircle,
        color: STATE_COLORS[EstadoReserva.PAYMENT_FAILED].text,
        bgColor: STATE_COLORS[EstadoReserva.PAYMENT_FAILED].bg,
        description: 'El pago fue rechazado. Por favor intenta nuevamente'
    },
};

export function getStateOrder(estado: EstadoReserva): number {
    const order = {
        [EstadoReserva.PENDING_PAYMENT]: 0,
        [EstadoReserva.CONFIRMED_UNASSIGNED]: 1,
        [EstadoReserva.CONFIRMED_ASSIGNED]: 2,
        [EstadoReserva.IN_PROGRESS]: 3,
        [EstadoReserva.COMPLETED]: 4,
        [EstadoReserva.CANCELLED]: -1, // Special case
        [EstadoReserva.PAYMENT_FAILED]: -2, // Special case
    };
    return order[estado] ?? 0;
}

export function canCancelReservation(fecha: Date, estado: EstadoReserva): boolean {
    if (estado === EstadoReserva.COMPLETED || estado === EstadoReserva.CANCELLED) {
        return false;
    }

    const now = new Date();
    const reservationDate = new Date(fecha);
    const hoursUntilReservation = (reservationDate.getTime() - now.getTime()) / (1000 * 60 * 60);

    return hoursUntilReservation > 24;
}
