import { EstadoReserva } from '@prisma/client';

// ─── Unified color palette ────────────────────────────────────────────────────
// Single source of truth for all estado colors across the application.
// Each state has: badge (bg+text+border), dot (small indicator), text (standalone)
export const STATE_COLORS: Record<EstadoReserva, {
    badge: string;    // bg-X text-X border-X  — for <Badge> / pill components
    text: string;     // text-X                 — for text-only
    bg: string;       // bg-X                   — for background-only
    dot: string;      // bg-X                   — for dot indicators
}> = {
    [EstadoReserva.PENDING_PAYMENT]: {
        badge: 'bg-amber-50 text-amber-700 border-amber-200',
        text: 'text-amber-700',
        bg: 'bg-amber-50',
        dot: 'bg-amber-400',
    },
    [EstadoReserva.CONFIRMED_UNASSIGNED]: {
        badge: 'bg-sky-50 text-sky-700 border-sky-200',
        text: 'text-sky-700',
        bg: 'bg-sky-50',
        dot: 'bg-sky-400',
    },
    [EstadoReserva.CONFIRMED_ASSIGNED]: {
        badge: 'bg-indigo-50 text-indigo-700 border-indigo-200',
        text: 'text-indigo-700',
        bg: 'bg-indigo-50',
        dot: 'bg-indigo-400',
    },
    [EstadoReserva.IN_PROGRESS]: {
        badge: 'bg-orange-50 text-orange-700 border-orange-200',
        text: 'text-orange-700',
        bg: 'bg-orange-50',
        dot: 'bg-orange-400',
    },
    [EstadoReserva.COMPLETED]: {
        badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        text: 'text-emerald-700',
        bg: 'bg-emerald-50',
        dot: 'bg-emerald-400',
    },
    [EstadoReserva.CANCELLED]: {
        badge: 'bg-red-50 text-red-600 border-red-200',
        text: 'text-red-600',
        bg: 'bg-red-50',
        dot: 'bg-red-400',
    },
    [EstadoReserva.PAYMENT_FAILED]: {
        badge: 'bg-rose-100 text-rose-700 border-rose-300',
        text: 'text-rose-700',
        bg: 'bg-rose-100',
        dot: 'bg-rose-500',
    },
};

const FALLBACK = {
    badge: 'bg-neutral-100 text-neutral-600 border-neutral-200',
    text: 'text-neutral-600',
    bg: 'bg-neutral-100',
    dot: 'bg-neutral-300',
};

/** Returns the full badge CSS classes (bg + text + border) for a given state */
export function getStateBadge(state: string): string {
    return STATE_COLORS[state as EstadoReserva]?.badge ?? FALLBACK.badge;
}

/** Returns bg + text classes (no border) for inline use */
export function getStateBg(state: string): string {
    const c = STATE_COLORS[state as EstadoReserva];
    return c ? `${c.bg} ${c.text}` : `${FALLBACK.bg} ${FALLBACK.text}`;
}

/** Returns the dot color class for small indicators */
export function getStateDot(state: string): string {
    return STATE_COLORS[state as EstadoReserva]?.dot ?? FALLBACK.dot;
}

// ─── State machine ────────────────────────────────────────────────────────────

// Define valid state transitions
const VALID_TRANSITIONS: Record<EstadoReserva, EstadoReserva[]> = {
    [EstadoReserva.PENDING_PAYMENT]: [
        EstadoReserva.CONFIRMED_UNASSIGNED,
        EstadoReserva.PAYMENT_FAILED,
        EstadoReserva.CANCELLED,
    ],
    [EstadoReserva.CONFIRMED_UNASSIGNED]: [
        EstadoReserva.CONFIRMED_ASSIGNED,
        EstadoReserva.CANCELLED,
    ],
    [EstadoReserva.CONFIRMED_ASSIGNED]: [
        EstadoReserva.IN_PROGRESS,
        EstadoReserva.CANCELLED,
    ],
    [EstadoReserva.IN_PROGRESS]: [
        EstadoReserva.COMPLETED,
        EstadoReserva.CANCELLED,
    ],
    [EstadoReserva.COMPLETED]: [],
    [EstadoReserva.CANCELLED]: [],
    [EstadoReserva.PAYMENT_FAILED]: [
        EstadoReserva.PENDING_PAYMENT,
        EstadoReserva.CANCELLED,
    ],
};

export function canTransitionTo(from: EstadoReserva, to: EstadoReserva): boolean {
    return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function getAvailableTransitions(currentState: EstadoReserva): EstadoReserva[] {
    return VALID_TRANSITIONS[currentState] ?? [];
}

export function getStateLabel(state: EstadoReserva): string {
    const labels: Record<EstadoReserva, string> = {
        [EstadoReserva.PENDING_PAYMENT]: 'Pendiente de Pago',
        [EstadoReserva.CONFIRMED_UNASSIGNED]: 'Confirmada · Sin Asignar',
        [EstadoReserva.CONFIRMED_ASSIGNED]: 'Confirmada · Asignada',
        [EstadoReserva.IN_PROGRESS]: 'En Curso',
        [EstadoReserva.COMPLETED]: 'Completada',
        [EstadoReserva.CANCELLED]: 'Cancelada',
        [EstadoReserva.PAYMENT_FAILED]: 'Pago Fallido',
    };
    return labels[state] ?? state;
}

/** @deprecated Use getStateBadge() or getStateBg() instead */
export function getStateColor(state: EstadoReserva): string {
    return getStateBg(state);
}
