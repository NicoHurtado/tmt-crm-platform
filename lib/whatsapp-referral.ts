// Número central de Transportes Medellín Travel (+57 317 5177409) en formato wa.me.
export const TMT_WHATSAPP_NUMBER = '573175177409';

/**
 * Construye el enlace de WhatsApp para el QR de referido de un aliado.
 * Lleva al huésped a un chat con TMT con un mensaje predefinido que menciona al aliado.
 * Funciona para cualquier aliado sin importar el tipo (HOTEL/AIRBNB/AGENCIA).
 */
export function buildAliadoReferralLink(nombreAliado: string): string {
    const mensaje = `Holaa vengo de parte de ${nombreAliado} y quiero informacion para servicios de transporte`;
    return `https://wa.me/${TMT_WHATSAPP_NUMBER}?text=${encodeURIComponent(mensaje)}`;
}
