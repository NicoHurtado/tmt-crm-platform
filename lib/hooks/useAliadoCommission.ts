'use client';

import { useState, useEffect } from 'react';

export interface AliadoCommissionInfo {
    tipoComision: 'PORCENTAJE' | 'FIJO';
    comisionValor: number;
    comisionAliado: number; // calculated amount
}

/**
 * Fetches the aliado commission config for a given aliado+service and
 * returns the commission amount calculated against the provided subtotal.
 */
export function useAliadoCommission(
    aliadoId: string | null | undefined,
    servicioId: string | null | undefined,
    subtotal: number
): AliadoCommissionInfo {
    const [info, setInfo] = useState<Omit<AliadoCommissionInfo, 'comisionAliado'>>({
        tipoComision: 'PORCENTAJE',
        comisionValor: 0,
    });

    useEffect(() => {
        if (!aliadoId || !servicioId) {
            setInfo({ tipoComision: 'PORCENTAJE', comisionValor: 0 });
            return;
        }

        fetch(`/api/aliados/${aliadoId}/servicios`)
            .then((r) => r.json())
            .then((data) => {
                const svcData = (data.data ?? []).find((s: any) => s.servicioId === servicioId);
                if (svcData) {
                    setInfo({
                        tipoComision: svcData.tipoComision ?? 'PORCENTAJE',
                        comisionValor: Number(svcData.comisionValor ?? 0),
                    });
                } else {
                    setInfo({ tipoComision: 'PORCENTAJE', comisionValor: 0 });
                }
            })
            .catch(() => setInfo({ tipoComision: 'PORCENTAJE', comisionValor: 0 }));
    }, [aliadoId, servicioId]);

    const comisionAliado =
        info.tipoComision === 'FIJO'
            ? info.comisionValor
            : subtotal * (info.comisionValor / 100);

    return { ...info, comisionAliado };
}
