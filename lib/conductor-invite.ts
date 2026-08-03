import { prisma } from '@/lib/prisma';

export type InviteCheck =
    | { ok: true; expiresAt: Date }
    | { ok: false; error: string; status: 404 | 410 };

/**
 * Valida un token de invitación de conductor.
 * El link es REUTILIZABLE: varios conductores pueden registrarse con el mismo
 * link mientras no expire. `usedAt` solo registra el último uso (informativo).
 */
export async function checkInvite(token: string): Promise<InviteCheck> {
    if (!token) return { ok: false, error: 'Link inválido', status: 404 };

    const invite = await prisma.conductorInvite.findUnique({ where: { token } });
    if (!invite) return { ok: false, error: 'Link inválido', status: 404 };
    if (invite.expiresAt < new Date()) {
        return { ok: false, error: 'Este link ha expirado. Solicita uno nuevo al administrador.', status: 410 };
    }
    return { ok: true, expiresAt: invite.expiresAt };
}

/** Deja solo dígitos y un `+` inicial opcional. */
export function normalizarTelefono(valor: string): string {
    const limpio = String(valor).trim().replace(/[^\d+]/g, '');
    return limpio.startsWith('+') ? `+${limpio.slice(1).replace(/\+/g, '')}` : limpio.replace(/\+/g, '');
}

export function normalizarPlaca(valor: string): string {
    return String(valor).trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function normalizarDocumento(valor: string): string {
    return String(valor).trim().replace(/[^\dA-Za-z]/g, '');
}
