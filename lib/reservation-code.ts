// Utility to generate unique reservation codes
export function generateReservationCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluding confusing chars like O, 0, I, 1
    let code = '';

    for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    return code;
}

// Validate if code format is correct
export function isValidReservationCode(code: string): boolean {
    return /^[A-Z0-9]{8}$/.test(code);
}
