import { transporter } from './email';
import {
  getEmailLayout,
  formatPrice,
  formatDate,
  estadoFriendly,
  getTrackingUrl,
  tplReservaConfirmada,
  tplPendientePago,
  tplPagoAprobado,
  tplConductorAsignado,
  tplCambioEstado,
  tplTourCompartido,
  tplCotizacionPendiente,
  tplCotizacionLista,
  tplCancelacion,
  tplServicioCompletado,
  tplAliadoNuevaReserva,
  confirmacionReservaCliente,
  notificacionAliadoReserva,
  actualizacionEstadoCliente,
  tplConductorAutoRegistrado,
  ReservaTemplate,
  ConductorAutoRegistradoTemplate,
} from './email-templates';
import { Reserva, Servicio, Conductor, Vehiculo, Aliado } from '@prisma/client';
import { getDatos } from '@/types/reserva-datos';

// Re-export utilities used by other modules
export { getEmailLayout, formatPrice, formatDate, estadoFriendly };

const ADMIN_EMAIL = 'medellintraveltransportes@gmail.com';
const FROM = `"Transportes Medellín Travel" <${process.env.GMAIL_USER}>`;

type ReservaWithRelations = Reserva & {
  servicio: Servicio;
  conductor?: Conductor | null;
  vehiculo?: Vehiculo | null;
  aliado?: Aliado | null;
};

const toLang = (lang: string | null | undefined): 'ES' | 'EN' =>
  (lang ?? 'ES').toUpperCase() === 'EN' ? 'EN' : 'ES';

const send = async (to: string | string[], subject: string, html: string) => {
  const recipients = Array.isArray(to) ? to.join(', ') : to;
  await transporter.sendMail({ from: FROM, to: recipients, subject, html, bcc: ADMIN_EMAIL });
};

// ─── TRIGGER 1: Reserva Confirmada ───────────────────────────────────────────

export async function sendReservaConfirmadaEmail(
  reserva: ReservaWithRelations,
  language: 'ES' | 'EN' = 'ES',
  aliadoEmail?: string | null
) {
  const lang = toLang(language);
  const html = tplReservaConfirmada(reserva as unknown as ReservaTemplate, lang);
  const subject = lang === 'EN'
    ? `Booking Confirmed — ${reserva.codigo}`
    : `Reserva Confirmada — ${reserva.codigo}`;

  const toRecipients: string[] = [reserva.emailCliente];
  const effectiveAliadoEmail = process.env.DISABLE_ALIADO_EMAILS === 'true' ? null : aliadoEmail;
  if (effectiveAliadoEmail && effectiveAliadoEmail !== reserva.emailCliente) {
    toRecipients.push(effectiveAliadoEmail);
  }
  await send(toRecipients, subject, html);
}

// ─── TRIGGER 2: Cambio de Estado ─────────────────────────────────────────────

export async function sendCambioEstadoEmail(
  reserva: ReservaWithRelations,
  estadoAnterior: string,
  language: 'ES' | 'EN' = 'ES'
) {
  const lang = toLang(language);
  const html = tplCambioEstado(reserva as unknown as ReservaTemplate, estadoAnterior, lang);
  const subject = lang === 'EN'
    ? `Booking Update — ${reserva.codigo}`
    : `Actualización de Reserva — ${reserva.codigo}`;
  await send(reserva.emailCliente, subject, html);
}

// ─── TRIGGER 3b: Reserva Pendiente de Pago (creación con tarjeta) ────────────

export async function sendPendientePagoEmail(
  reserva: ReservaWithRelations,
  language: 'ES' | 'EN' = 'ES'
) {
  const lang = toLang(language);
  const html = tplPendientePago(reserva as unknown as ReservaTemplate, lang);
  const subject = lang === 'EN'
    ? `Booking Received — ${reserva.codigo}`
    : `Reserva Recibida — ${reserva.codigo}`;
  await send(reserva.emailCliente, subject, html);
}

// ─── TRIGGER 3: Pago Aprobado ─────────────────────────────────────────────────

export async function sendPagoAprobadoEmail(
  reserva: ReservaWithRelations,
  language: 'ES' | 'EN' = 'ES'
) {
  const lang = toLang(language);
  const html = tplPagoAprobado(reserva as unknown as ReservaTemplate, lang);
  const subject = lang === 'EN'
    ? `Payment Confirmed — ${reserva.codigo}`
    : `Pago Confirmado — ${reserva.codigo}`;
  await send(reserva.emailCliente, subject, html);
}

// ─── TRIGGER 4: Conductor Asignado ───────────────────────────────────────────

export async function sendConductorAsignadoEmail(
  reserva: ReservaWithRelations,
  language: 'ES' | 'EN' = 'ES'
) {
  if (!reserva.conductor || !reserva.vehiculo) {
    throw new Error('Conductor y vehículo deben estar asignados');
  }
  const lang = toLang(language);
  const html = tplConductorAsignado(reserva as unknown as ReservaTemplate, lang);
  const subject = lang === 'EN'
    ? `Driver Assigned — ${reserva.codigo}`
    : `Conductor Asignado — ${reserva.codigo}`;
  await send(reserva.emailCliente, subject, html);
}

// ─── TRIGGER 5: Servicio Completado ──────────────────────────────────────────

export async function sendServicioCompletadoEmail(
  reserva: ReservaWithRelations,
  language: 'ES' | 'EN' = 'ES'
) {
  const lang = toLang(language);
  const html = tplServicioCompletado(reserva as unknown as ReservaTemplate, lang);
  const subject = lang === 'EN'
    ? `Thank You! Rate your Experience — ${reserva.codigo}`
    : `¡Gracias! Califica tu Experiencia — ${reserva.codigo}`;
  await send(reserva.emailCliente, subject, html);
}

// ─── TRIGGER 6: Cotización Pendiente ─────────────────────────────────────────

export async function sendCotizacionPendienteEmail(
  reserva: ReservaWithRelations,
  language: 'ES' | 'EN' = 'ES'
) {
  const lang = toLang(language);
  const html = tplCotizacionPendiente(reserva as unknown as ReservaTemplate, lang);
  const subject = lang === 'EN'
    ? `Booking Request Received — ${reserva.codigo}`
    : `Solicitud Recibida — ${reserva.codigo}`;
  await send(reserva.emailCliente, subject, html);
}

// ─── TRIGGER 7: Cotización Lista ─────────────────────────────────────────────

export async function sendCotizacionListaEmail(
  reserva: ReservaWithRelations,
  language: 'ES' | 'EN' = 'ES'
) {
  const lang = toLang(language);
  const html = tplCotizacionLista(reserva as unknown as ReservaTemplate, lang);
  const subject = lang === 'EN'
    ? `Your Quote is Ready — ${reserva.codigo}`
    : `Tu Cotización está Lista — ${reserva.codigo}`;
  await send(reserva.emailCliente, subject, html);
}

// ─── TRIGGER 8: Cancelación ──────────────────────────────────────────────────

export async function sendCancelacionEmail(
  reserva: ReservaWithRelations,
  language: 'ES' | 'EN' = 'ES'
) {
  const lang = toLang(language);
  const html = tplCancelacion(reserva as unknown as ReservaTemplate, lang);
  const subject = lang === 'EN'
    ? `Booking Cancelled — ${reserva.codigo}`
    : `Reserva Cancelada — ${reserva.codigo}`;
  await send(reserva.emailCliente, subject, html);
}

// ─── TRIGGER 9: Cotización Generada (Admin → Cliente) ────────────────────────

export async function sendCotizacionGeneradaEmail(
  reserva: ReservaWithRelations,
  language: 'ES' | 'EN' = 'ES'
) {
  const lang = toLang(language);
  const html = tplCotizacionLista(reserva as unknown as ReservaTemplate, lang);
  const subject = lang === 'EN'
    ? `Your Quote is Ready — ${reserva.codigo}`
    : `Tu Cotización está Lista — ${reserva.codigo}`;
  await send(reserva.emailCliente, subject, html);
}

// ─── TRIGGER 10: Tour Compartido ─────────────────────────────────────────────

export async function sendTourCompartidoConfirmationEmail(
  reserva: ReservaWithRelations,
  language: 'ES' | 'EN' = 'ES'
) {
  const lang = toLang(language);
  const html = tplTourCompartido(reserva as unknown as ReservaTemplate, lang);
  const subject = lang === 'EN'
    ? `Shared Tour Confirmed — ${reserva.codigo}`
    : `Tour Compartido Confirmado — ${reserva.codigo}`;
  await send(reserva.emailCliente, subject, html);
}

// ─── TRIGGER 11: Aliado — Nueva Reserva ──────────────────────────────────────

export async function sendAliadoReservaEmail(
  reserva: ReservaWithRelations,
  aliadoEmail: string
) {
  const aliado = { nombre: reserva.aliado?.nombre ?? 'Aliado', email: aliadoEmail };
  const html = tplAliadoNuevaReserva(reserva as unknown as ReservaTemplate, aliado);
  await send(aliadoEmail, `Nueva Reserva — ${reserva.codigo}`, html);
}

// ─── Template-based wrappers (FASE 5 legacy) ─────────────────────────────────

export async function sendConfirmacionClienteEmail(
  reserva: ReservaWithRelations,
  idioma: 'es' | 'en' = 'es'
): Promise<void> {
  const lang: 'ES' | 'EN' = idioma === 'en' ? 'EN' : 'ES';
  const html = tplReservaConfirmada(reserva as unknown as ReservaTemplate, lang);
  const subject = lang === 'EN'
    ? `Booking Confirmed — ${reserva.codigo}`
    : `Reserva Confirmada — ${reserva.codigo}`;
  await send(reserva.emailCliente, subject, html);
}

export async function sendNotificacionAliadoEmail(
  reserva: ReservaWithRelations,
  aliadoEmail: string
): Promise<void> {
  if (!reserva.aliado) return;
  const html = tplAliadoNuevaReserva(reserva as unknown as ReservaTemplate, reserva.aliado);
  await send(aliadoEmail, `Nueva Reserva — ${reserva.codigo}`, html);
}

export async function sendActualizacionEstadoEmail(
  reserva: ReservaWithRelations,
  idioma: 'es' | 'en' = 'es'
): Promise<void> {
  const lang: 'ES' | 'EN' = idioma === 'en' ? 'EN' : 'ES';
  const html = tplConductorAsignado(reserva as unknown as ReservaTemplate, lang);
  const subject = lang === 'EN'
    ? `Driver Assigned — ${reserva.codigo}`
    : `Conductor Asignado — ${reserva.codigo}`;
  await send(reserva.emailCliente, subject, html);
}

// ─── ORCHESTRATOR ────────────────────────────────────────────────────────────

export async function sendReservationNotifications(
  reserva: ReservaWithRelations,
  context: {
    event: 'created' | 'estado_changed' | 'cancelled';
    language?: 'ES' | 'EN';
    estadoAnterior?: string;
  }
) {
  const lang = (context.language ?? reserva.idioma ?? 'ES').toLowerCase() as 'es' | 'en';

  if (context.event === 'created') {
    await sendConfirmacionClienteEmail(reserva, lang);
    const origenAliado = reserva.origen === 'codigo_aliado' || reserva.origen === 'link_aliado';
    const aliadoEmail = reserva.aliado?.email;
    if (origenAliado && aliadoEmail) {
      await sendNotificacionAliadoEmail(reserva, aliadoEmail);
    }
  } else if (context.event === 'estado_changed') {
    if (reserva.estado === 'CONFIRMED_ASSIGNED') {
      await sendActualizacionEstadoEmail(reserva, lang);
    }
  } else if (context.event === 'cancelled') {
    await sendCancelacionEmail(reserva, lang.toUpperCase() as 'ES' | 'EN');
  }
}

// ─── Auto-registro de conductor ──────────────────────────────────────────────

/**
 * Avisa al admin cuando un conductor se registra solo con el link de invitación.
 * Sin esto el alta pasaba en silencio: el conductor quedaba activo y disponible
 * (o sea, asignable a reservas) y nadie se enteraba hasta abrir la lista.
 */
export async function sendConductorAutoRegistradoEmail(
  conductor: ConductorAutoRegistradoTemplate
) {
  await transporter.sendMail({
    from: FROM,
    to: ADMIN_EMAIL,
    subject: `Nuevo conductor registrado — ${conductor.nombre} (${conductor.placa})`,
    html: tplConductorAutoRegistrado(conductor),
  });
}

/**
 * Confirmación al funcionario de un evento corporativo (sin pago: se factura a la empresa).
 * Copia oculta al admin, como el resto de correos al cliente.
 */
export async function sendCupoCorporativoEmail(datos: {
  to: string;
  nombre: string;
  empresa: string;
  titulo: string;
  origen: string;
  destino: string;
  salida: string;
  numeroVuelo?: string | null;
  linkEvento: string;
}) {
  const fila = (k: string, v: string) =>
    `<tr><td style="padding:6px 0;color:#6b7280;font-size:13px;width:140px;">${k}</td><td style="padding:6px 0;color:#111827;font-size:14px;font-weight:600;">${v}</td></tr>`;
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
  const html = getEmailLayout(`
    <p style="margin:0 0 8px;font-size:20px;font-weight:700;color:#111827;">¡Cupo confirmado, ${esc(datos.nombre)}!</p>
    <p style="margin:0 0 20px;font-size:14px;color:#4b5563;">Tu puesto en el transporte de <strong>${esc(datos.empresa)}</strong> quedó reservado. No tienes que pagar nada: el servicio se factura a la empresa.</p>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;margin-bottom:20px;">
      ${fila('Servicio', esc(datos.titulo))}
      ${fila('Salida', esc(datos.salida))}
      ${fila('Desde', esc(datos.origen))}
      ${fila('Hacia', esc(datos.destino))}
      ${datos.numeroVuelo ? fila('Tu vuelo', esc(datos.numeroVuelo)) : ''}
    </table>
    <p style="margin:0 0 20px;font-size:13px;color:#4b5563;">Preséntate en el punto de encuentro unos minutos antes de la hora de salida. Si tu vuelo cambia, escríbenos por WhatsApp para moverte de turno.</p>
    <p style="margin:0 0 24px;"><a href="${datos.linkEvento}" style="color:#D6A75D;font-size:13px;">Ver horarios del evento</a></p>
  `);
  await transporter.sendMail({
    from: FROM,
    to: datos.to,
    bcc: ADMIN_EMAIL,
    subject: `Cupo confirmado — ${datos.titulo} · ${datos.salida}`,
    html,
  });
}
