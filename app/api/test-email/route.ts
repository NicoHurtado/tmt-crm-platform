import { NextRequest, NextResponse } from 'next/server';
import { verifyEmailConfig } from '@/lib/email';
import {
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
  ReservaTemplate,
} from '@/lib/email-templates';
import { transporter } from '@/lib/email';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const ADMIN_EMAIL = 'medellintraveltransportes@gmail.com';
const FROM = `"Transportes Medellín Travel" <${process.env.GMAIL_USER}>`;

// Mock reserva for testing without a real DB record
const makeMockReserva = (overrides: Partial<ReservaTemplate> = {}): ReservaTemplate => ({
  codigo: 'TMT-2025-DEMO',
  nombreCliente: 'María García',
  whatsappCliente: '+57 316 4521890',
  emailCliente: 'cliente@ejemplo.com',
  fecha: new Date('2025-06-15'),
  hora: '09:00',
  numeroPasajeros: 3,
  municipio: 'MEDELLIN',
  otroMunicipio: null,
  metodoPago: 'EFECTIVO',
  estadoPago: 'PENDIENTE',
  precioBase: 180000,
  precioAdicionales: 20000,
  precioTotal: 215000,
  recargoNocturno: 0,
  tarifaMunicipio: 15000,
  descuentoAliado: 0,
  estado: 'CONFIRMED_UNASSIGNED',
  notas: 'Vuelo de llegada a las 08:30. Necesito silla para bebé.',
  clientePaga: true,
  pagoId: null,
  servicio: {
    nombre: JSON.stringify({ es: 'Tour Guatapé & El Peñol', en: 'Guatape & El Peñol Tour' }),
    destinoAutoFill: 'Guatapé',
  },
  conductor: {
    nombre: 'Carlos Rodríguez',
    whatsapp: '+573175177409',
  },
  vehiculo: { nombre: 'Van 8 pasajeros' },
  origen: 'web_directa',
  datos: {},
  ...overrides,
});

type EmailType =
  | 'confirmada'
  | 'pendiente_pago'
  | 'pago_aprobado'
  | 'conductor_asignado'
  | 'cambio_estado'
  | 'tour_compartido'
  | 'cotizacion_pendiente'
  | 'cotizacion_lista'
  | 'cancelacion'
  | 'completado'
  | 'aliado';

function buildEmail(type: EmailType, lang: 'ES' | 'EN'): { subject: string; html: string } {
  const r = makeMockReserva(
    type === 'pago_aprobado'
      ? { metodoPago: 'TARJETA', estadoPago: 'APROBADO', pagoId: 'BOLD-TXN-7823941' }
      : type === 'pendiente_pago'
      ? { metodoPago: 'TARJETA', estadoPago: 'PENDIENTE', estado: 'PENDING_PAYMENT' }
      : type === 'cancelacion'
      ? { estado: 'CANCELLED' }
      : type === 'completado'
      ? { estado: 'COMPLETED' }
      : {}
  );

  switch (type) {
    case 'confirmada':
      return {
        subject: lang === 'EN' ? `Booking Confirmed — ${r.codigo}` : `Reserva Confirmada — ${r.codigo}`,
        html: tplReservaConfirmada(r, lang),
      };
    case 'pendiente_pago':
      return {
        subject: lang === 'EN' ? `Payment Pending — ${r.codigo}` : `Pago Pendiente — ${r.codigo}`,
        html: tplPendientePago(r, lang),
      };
    case 'pago_aprobado':
      return {
        subject: lang === 'EN' ? `Payment Confirmed — ${r.codigo}` : `Pago Confirmado — ${r.codigo}`,
        html: tplPagoAprobado(r, lang),
      };
    case 'conductor_asignado':
      return {
        subject: lang === 'EN' ? `Driver Assigned — ${r.codigo}` : `Conductor Asignado — ${r.codigo}`,
        html: tplConductorAsignado(r, lang),
      };
    case 'cambio_estado':
      return {
        subject: lang === 'EN' ? `Booking Update — ${r.codigo}` : `Actualización — ${r.codigo}`,
        html: tplCambioEstado(r, 'CONFIRMED_UNASSIGNED', lang),
      };
    case 'tour_compartido':
      return {
        subject: lang === 'EN' ? `Shared Tour Confirmed — ${r.codigo}` : `Tour Compartido Confirmado — ${r.codigo}`,
        html: tplTourCompartido(r, lang),
      };
    case 'cotizacion_pendiente':
      return {
        subject: lang === 'EN' ? `Request Received — ${r.codigo}` : `Solicitud Recibida — ${r.codigo}`,
        html: tplCotizacionPendiente(r, lang),
      };
    case 'cotizacion_lista':
      return {
        subject: lang === 'EN' ? `Quote Ready — ${r.codigo}` : `Cotización Lista — ${r.codigo}`,
        html: tplCotizacionLista(r, lang),
      };
    case 'cancelacion':
      return {
        subject: lang === 'EN' ? `Booking Cancelled — ${r.codigo}` : `Reserva Cancelada — ${r.codigo}`,
        html: tplCancelacion(r, lang),
      };
    case 'completado':
      return {
        subject: lang === 'EN' ? `Rate your Experience — ${r.codigo}` : `Califica tu Experiencia — ${r.codigo}`,
        html: tplServicioCompletado(r, lang),
      };
    case 'aliado':
      return {
        subject: `Nueva Reserva — ${r.codigo}`,
        html: tplAliadoNuevaReserva(r, { nombre: 'Hotel Poblado Boutique', email: 'reservas@hotelpoblado.com' }),
      };
  }
}

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const isConfigured = await verifyEmailConfig();
  return NextResponse.json({ status: isConfigured ? 'ok' : 'misconfigured' });
}

export async function POST(req: NextRequest) {
  // Auth: session OR dev secret
  const session = await getServerSession(authOptions);
  const body = await req.json();
  const { secret, to, type, language, reservaId, sendAll } = body;

  const devSecret = process.env.TEST_EMAIL_SECRET;
  const authorized = session || (devSecret && secret === devSecret);
  if (!authorized) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const recipient: string = to || ADMIN_EMAIL;
  const lang: 'ES' | 'EN' = (language ?? 'ES').toUpperCase() === 'EN' ? 'EN' : 'ES';

  try {
    await verifyEmailConfig();

    // Send all types at once
    if (sendAll) {
      const types: EmailType[] = [
        'confirmada', 'pendiente_pago', 'pago_aprobado', 'conductor_asignado',
        'cambio_estado', 'tour_compartido', 'cotizacion_pendiente', 'cotizacion_lista',
        'cancelacion', 'completado', 'aliado',
      ];
      const results: { type: string; ok: boolean; error?: string }[] = [];
      for (const t of types) {
        try {
          // For bilingual test: send ES for first half, EN for second
          const l: 'ES' | 'EN' = t === 'aliado' ? 'ES' : lang;
          const email = buildEmail(t, l);
          await transporter.sendMail({ from: FROM, to: recipient, subject: `[TEST] ${email.subject}`, html: email.html, bcc: ADMIN_EMAIL });
          results.push({ type: t, ok: true });
        } catch (e) {
          results.push({ type: t, ok: false, error: String(e) });
        }
      }
      return NextResponse.json({ sent: results.filter(r => r.ok).length, total: types.length, results });
    }

    // Send from real reserva if provided
    if (reservaId && type) {
      const reserva = await prisma.reserva.findUnique({
        where: { id: reservaId },
        include: { servicio: true, conductor: true, vehiculo: true, aliado: true },
      });
      if (!reserva) return NextResponse.json({ error: 'Reserva not found' }, { status: 404 });
      const l = toLang(language ?? reserva.idioma);
      const r = reserva as unknown as ReservaTemplate;

      let email: { subject: string; html: string };
      if (type === 'aliado') {
        email = {
          subject: `Nueva Reserva — ${reserva.codigo}`,
          html: tplAliadoNuevaReserva(r, { nombre: reserva.aliado?.nombre ?? 'Aliado', email: recipient }),
        };
      } else {
        email = buildEmail(type as EmailType, l);
      }
      await transporter.sendMail({ from: FROM, to: recipient, subject: `[TEST] ${email.subject}`, html: email.html, bcc: ADMIN_EMAIL });
      return NextResponse.json({ ok: true, to: recipient, subject: email.subject });
    }

    // Send mock for a specific type
    if (type) {
      const email = buildEmail(type as EmailType, lang);
      await transporter.sendMail({ from: FROM, to: recipient, subject: `[TEST] ${email.subject}`, html: email.html, bcc: ADMIN_EMAIL });
      return NextResponse.json({ ok: true, to: recipient, type, language: lang });
    }

    return NextResponse.json({ error: 'Provide type or sendAll:true' }, { status: 400 });
  } catch (error) {
    console.error('test-email error:', error);
    return NextResponse.json({ error: 'Failed', details: String(error) }, { status: 500 });
  }
}

function toLang(v: string | null | undefined): 'ES' | 'EN' {
  return (v ?? 'ES').toUpperCase() === 'EN' ? 'EN' : 'ES';
}
