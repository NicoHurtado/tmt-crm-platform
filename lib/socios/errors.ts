/**
 * Error de la petición del socio: falta un campo, el formato es inválido, el servicio no
 * existe, ningún vehículo cubre el grupo. Se responde `400` y el socio debe corregir.
 *
 * Todo lo demás (base de datos caída, bug nuestro) se responde `500`. La distinción
 * importa: la guía le dice al socio que reintente ante un `500` y que NO reintente ante
 * un `400`. Si devolviéramos `400` ante una caída nuestra, el socio daría por perdida
 * una reserva que ya le cobró al huésped.
 */
export class SocioRequestError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'SocioRequestError';
    }
}

/** Lanza un `SocioRequestError`. Atajo para las funciones de parseo. */
export function badRequest(message: string): never {
    throw new SocioRequestError(message);
}
