import { describe, it, expect } from 'vitest';
import { origenDestinoReserva } from '@/types/reserva-datos';

describe('origenDestinoReserva', () => {
    it('llegada al aeropuerto: la dirección del viajero es el destino', () => {
        expect(origenDestinoReserva({ datos: { aeropuertoTipo: 'DESDE', aeropuertoNombre: 'JOSE_MARIA_CORDOVA', lugarRecogida: 'Cra 43A #10-20, El Poblado' } }))
            .toEqual({ origen: 'Aeropuerto José María Córdova', destino: 'Cra 43A #10-20, El Poblado' });
    });

    it('salida al aeropuerto: la dirección del viajero es el origen', () => {
        expect(origenDestinoReserva({ datos: { aeropuertoTipo: 'HACIA', lugarRecogida: 'Hotel Kuuna' }, aeropuertoNombre: 'OLAYA_HERRERA' }))
            .toEqual({ origen: 'Hotel Kuuna', destino: 'Aeropuerto Olaya Herrera' });
    });

    it('tour o traslado: recogida → destino del traslado o del servicio', () => {
        expect(origenDestinoReserva({ datos: { lugarRecogida: 'Laureles', trasladoDestino: 'Guatapé' } })).toEqual({ origen: 'Laureles', destino: 'Guatapé' });
        expect(origenDestinoReserva({ datos: { lugarRecogida: 'Laureles' }, servicio: { destinoAutoFill: 'Jardín' } })).toEqual({ origen: 'Laureles', destino: 'Jardín' });
    });
});
