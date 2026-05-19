import { describe, it, expect, beforeEach, vi } from 'vitest';
import crypto from 'crypto';
import {
    calculateBoldCommission,
    generateBoldHash,
    validateBoldHash,
    BOLD_COMMISSION_RATE,
} from '@/lib/bold';

describe('calculateBoldCommission', () => {
    it('calcula el 6% del monto', () => {
        expect(calculateBoldCommission(100_000)).toBeCloseTo(6_000);
        expect(calculateBoldCommission(150_000)).toBeCloseTo(9_000);
        expect(calculateBoldCommission(0)).toBe(0);
    });

    it('BOLD_COMMISSION_RATE es 0.06', () => {
        expect(BOLD_COMMISSION_RATE).toBe(0.06);
    });

    it('maneja montos decimales', () => {
        const commission = calculateBoldCommission(99_999.99);
        expect(commission).toBeCloseTo(99_999.99 * 0.06);
    });
});

describe('generateBoldHash', () => {
    beforeEach(() => {
        // Ensure test mode is active (set in vitest.config env)
        process.env.BOLD_MODE = 'test';
        process.env.BOLD_SECRET_KEY_TEST = 'test-secret-key-for-hmac-testing-only';
    });

    it('genera un hash SHA256 en formato hex de 64 caracteres', () => {
        const hash = generateBoldHash('RES-001', 150_000, 'COP');
        expect(hash).toHaveLength(64);
        expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('el mismo input siempre produce el mismo hash (determinístico)', () => {
        const hash1 = generateBoldHash('RES-001', 150_000, 'COP');
        const hash2 = generateBoldHash('RES-001', 150_000, 'COP');
        expect(hash1).toBe(hash2);
    });

    it('inputs diferentes producen hashes diferentes', () => {
        const hash1 = generateBoldHash('RES-001', 150_000, 'COP');
        const hash2 = generateBoldHash('RES-002', 150_000, 'COP');
        expect(hash1).not.toBe(hash2);
    });

    it('diferente monto produce diferente hash', () => {
        const hash1 = generateBoldHash('RES-001', 100_000, 'COP');
        const hash2 = generateBoldHash('RES-001', 200_000, 'COP');
        expect(hash1).not.toBe(hash2);
    });

    it('redondea el monto antes de hashear (sin decimales)', () => {
        // Bold requiere número entero
        const hash1 = generateBoldHash('RES-001', 150_000, 'COP');
        const hash2 = generateBoldHash('RES-001', 150_000.5, 'COP');
        // 150000 y 150001 redondeados deben ser diferentes
        expect(hash1).not.toBe(hash2);
    });

    it('usa COP como moneda por defecto', () => {
        const hashDefault = generateBoldHash('RES-001', 150_000);
        const hashCOP = generateBoldHash('RES-001', 150_000, 'COP');
        expect(hashDefault).toBe(hashCOP);
    });

    it('lanza error si BOLD_SECRET_KEY_TEST no está configurado', () => {
        const original = process.env.BOLD_SECRET_KEY_TEST;
        delete process.env.BOLD_SECRET_KEY_TEST;
        expect(() => generateBoldHash('RES-001', 150_000)).toThrow();
        process.env.BOLD_SECRET_KEY_TEST = original;
    });

    it('el hash coincide con cálculo manual SHA256', () => {
        const orderId = 'RES-TEST';
        const amount = 200_000;
        const currency = 'COP';
        const secret = process.env.BOLD_SECRET_KEY_TEST!;
        const concatenated = `${orderId}${Math.round(amount)}${currency}${secret}`;
        const expectedHash = crypto.createHash('sha256').update(concatenated).digest('hex');
        expect(generateBoldHash(orderId, amount, currency)).toBe(expectedHash);
    });
});

describe('validateBoldHash', () => {
    it('retorna true para un hash correcto', () => {
        const orderId = 'RES-001';
        const amount = 150_000;
        const currency = 'COP';
        const correctHash = generateBoldHash(orderId, amount, currency);
        expect(validateBoldHash(orderId, amount, currency, correctHash)).toBe(true);
    });

    it('retorna false para un hash incorrecto', () => {
        expect(validateBoldHash('RES-001', 150_000, 'COP', 'hash_incorrecto')).toBe(false);
    });

    it('retorna false cuando se modifica el order_id', () => {
        const correctHash = generateBoldHash('RES-001', 150_000, 'COP');
        expect(validateBoldHash('RES-002', 150_000, 'COP', correctHash)).toBe(false);
    });

    it('retorna false cuando se modifica el monto', () => {
        const correctHash = generateBoldHash('RES-001', 150_000, 'COP');
        expect(validateBoldHash('RES-001', 200_000, 'COP', correctHash)).toBe(false);
    });
});
