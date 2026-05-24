// ─── Types ───────────────────────────────────────────────────────────────────

export type ReservaTemplate = {
  codigo: string;
  nombreCliente: string;
  whatsappCliente?: string | null;
  emailCliente: string;
  fecha: Date;
  hora: string;
  numeroPasajeros: number;
  municipio?: string | null;
  otroMunicipio?: string | null;
  metodoPago: string;
  estadoPago?: string | null;
  precioBase: { toNumber(): number } | number;
  precioAdicionales: { toNumber(): number } | number;
  precioTotal: { toNumber(): number } | number;
  recargoNocturno?: { toNumber(): number } | number | null;
  tarifaMunicipio?: { toNumber(): number } | number | null;
  descuentoAliado?: { toNumber(): number } | number | null;
  estado: string;
  notas?: string | null;
  clientePaga?: boolean | null;
  pagoId?: string | null;
  servicio: { nombre: unknown; destinoAutoFill?: string | null };
  conductor?: { nombre: string; whatsapp?: string | null } | null;
  vehiculo?: { nombre: string } | null;
  origen?: string | null;
  datos?: unknown;
};

export type AliadoTemplate = {
  nombre: string;
  email?: string | null;
};

// ─── Utilities ───────────────────────────────────────────────────────────────

export const formatPrice = (price: number): string =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(price);

export const formatDate = (date: Date, language: 'ES' | 'EN' = 'ES'): string =>
  new Intl.DateTimeFormat(language === 'ES' ? 'es-CO' : 'en-US', {
    dateStyle: 'long',
  }).format(date);

export const estadoFriendly: Record<string, Record<string, string>> = {
  ES: {
    PENDING_PAYMENT: 'Pendiente de Pago',
    CONFIRMED_UNASSIGNED: 'Confirmada — Sin conductor asignado',
    CONFIRMED_ASSIGNED: 'Confirmada — Conductor asignado',
    IN_PROGRESS: 'En Curso',
    COMPLETED: 'Completada',
    CANCELLED: 'Cancelada',
    PAYMENT_FAILED: 'Pago Fallido',
    QUOTE_PENDING: 'Cotización Pendiente',
    QUOTE_READY: 'Cotización Lista',
  },
  EN: {
    PENDING_PAYMENT: 'Pending Payment',
    CONFIRMED_UNASSIGNED: 'Confirmed — Driver not yet assigned',
    CONFIRMED_ASSIGNED: 'Confirmed — Driver assigned',
    IN_PROGRESS: 'In Progress',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled',
    PAYMENT_FAILED: 'Payment Failed',
    QUOTE_PENDING: 'Quote Pending',
    QUOTE_READY: 'Quote Ready',
  },
};

const toNum = (v: { toNumber(): number } | number | null | undefined): number => {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  return v.toNumber();
};

const svcName = (nombre: unknown, lang: 'ES' | 'EN'): string => {
  try {
    const obj = typeof nombre === 'string' ? JSON.parse(nombre) : (nombre as Record<string, string>);
    return obj[lang === 'ES' ? 'es' : 'en'] || obj['es'] || String(nombre);
  } catch {
    return String(nombre ?? '');
  }
};

export const getTrackingUrl = (codigo: string, lang: 'ES' | 'EN'): string => {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  return `${appUrl}/tracking/${codigo}?lang=${lang.toLowerCase()}`;
};

// ─── HTML Helpers ─────────────────────────────────────────────────────────────

const bilingualDivider = (): string => `
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:40px 0 28px 0;">
    <tr>
      <td style="border-top:1px dashed #d1d5db;width:45%;"></td>
      <td style="padding:0 16px;white-space:nowrap;text-align:center;vertical-align:middle;width:10%;">
        <span style="font-size:11px;color:#9ca3af;letter-spacing:0.12em;text-transform:uppercase;font-weight:600;">Español</span>
      </td>
      <td style="border-top:1px dashed #d1d5db;width:45%;"></td>
    </tr>
  </table>`;

const buildBilingual = (enHtml: string, esHtml: string, lang: 'ES' | 'EN'): string =>
  lang === 'ES' ? esHtml : `${enHtml}${bilingualDivider()}${esHtml}`;

const badgeHtml = (label: string, color: string, bg: string): string =>
  `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
    <tr><td>
      <span style="display:inline-block;padding:4px 14px;background-color:${bg};border-radius:20px;font-size:11px;font-weight:700;color:${color};letter-spacing:0.08em;text-transform:uppercase;">${label}</span>
    </td></tr>
  </table>`;

const codigoBlock = (codigo: string, label: string): string =>
  `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
    <tr><td style="padding:10px 14px;background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;">
      <span style="font-size:12px;color:#9ca3af;margin-right:8px;">${label}:</span>
      <span style="font-size:14px;font-weight:600;color:#374151;">${codigo}</span>
    </td></tr>
  </table>`;

const sectionHead = (label: string): string =>
  `<table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr><td style="padding:9px 14px;background-color:#0A0A0A;border-radius:6px 6px 0 0;">
      <span style="font-size:11px;font-weight:600;color:#D6A75D;text-transform:uppercase;letter-spacing:0.1em;">${label}</span>
    </td></tr>
  </table>`;

type Row = { label: string; value: string };

const detailsTable = (rows: Row[]): string => {
  const vis = rows.filter(r => r.value.trim() !== '');
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0"
    style="border-collapse:collapse;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 6px 6px;overflow:hidden;margin-bottom:24px;">
    ${vis.map((r, i) => `
      <tr${i % 2 === 0 ? ' style="background-color:#f9fafb;"' : ''}>
        <td style="padding:10px 14px;font-size:13px;color:#6b7280;width:42%;${i < vis.length - 1 ? 'border-bottom:1px solid #e5e7eb;' : ''}">${r.label}</td>
        <td style="padding:10px 14px;font-size:13px;color:#0A0A0A;font-weight:500;${i < vis.length - 1 ? 'border-bottom:1px solid #e5e7eb;' : ''}">${r.value}</td>
      </tr>`).join('')}
  </table>`;
};

type PriceRow = { label: string; value: string };

const priceTable = (rows: PriceRow[], totalLabel: string, totalValue: string): string =>
  `<table width="100%" cellpadding="0" cellspacing="0" border="0"
    style="border-collapse:collapse;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 6px 6px;overflow:hidden;margin-bottom:24px;">
    ${rows.map(r => `
      <tr>
        <td style="padding:10px 16px;font-size:13px;color:#6b7280;border-bottom:1px solid #e5e7eb;">${r.label}</td>
        <td style="padding:10px 16px;font-size:13px;color:#0A0A0A;text-align:right;border-bottom:1px solid #e5e7eb;">${r.value}</td>
      </tr>`).join('')}
    <tr style="background-color:#0A0A0A;">
      <td style="padding:14px 16px;font-size:14px;font-weight:700;color:#ffffff;">${totalLabel}</td>
      <td style="padding:14px 16px;font-size:19px;font-weight:700;color:#D6A75D;text-align:right;">${totalValue}</td>
    </tr>
  </table>`;

const ctaBtn = (label: string, url: string): string =>
  `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 8px 0;">
    <tr><td align="center">
      <a href="${url}" style="display:inline-block;padding:14px 40px;background-color:#D6A75D;color:#0A0A0A;text-decoration:none;border-radius:8px;font-weight:700;font-size:15px;">
        ${label}
      </a>
    </td></tr>
  </table>`;

type AlertType = 'info' | 'warning' | 'success' | 'error';
const alertStyles: Record<AlertType, { bg: string; border: string; color: string }> = {
  info:    { bg: '#f9fafb', border: '#d1d5db', color: '#374151' },
  warning: { bg: '#fffbeb', border: '#f59e0b', color: '#92400e' },
  success: { bg: '#f0fdf4', border: '#22c55e', color: '#15803d' },
  error:   { bg: '#fef2f2', border: '#ef4444', color: '#991b1b' },
};

const alertBox = (html: string, type: AlertType = 'info'): string => {
  const s = alertStyles[type];
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0;">
    <tr><td style="padding:16px 20px;background-color:${s.bg};border-left:4px solid ${s.border};border-radius:0 6px 6px 0;">
      <span style="font-size:14px;color:${s.color};line-height:1.7;">${html}</span>
    </td></tr>
  </table>`;
};

// ─── Layout ───────────────────────────────────────────────────────────────────

export const getEmailLayout = (content: string, language: 'ES' | 'EN' = 'ES'): string => `
  <!DOCTYPE html>
  <html lang="${language === 'ES' ? 'es' : 'en'}">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>Transportes Medellín Travel</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f5;padding:24px 0;">
      <tr><td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;">
          <!-- Header -->
          <tr><td style="background-color:#0A0A0A;padding:28px 32px;text-align:center;">
            <p style="margin:0;font-size:22px;font-weight:700;color:#D6A75D;letter-spacing:0.02em;">Transportes Medellín Travel</p>
            <p style="margin:6px 0 0;font-size:11px;color:#6b7280;letter-spacing:0.08em;text-transform:uppercase;">Transporte Premium · Medellín, Colombia</p>
          </td></tr>
          <!-- Body -->
          <tr><td style="padding:32px 32px 8px;">
            ${content}
          </td></tr>
          <!-- Contact -->
          <tr><td style="padding:0 32px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0"
              style="background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;">
              <tr><td style="padding:20px 24px;text-align:center;">
                <p style="margin:0 0 12px;font-size:13px;font-weight:600;color:#374151;">
                  ${language === 'ES' ? '¿Necesitas ayuda? Contáctanos' : 'Need help? Contact us'}
                </p>
                <a href="https://wa.me/573175177409"
                  style="display:inline-block;padding:9px 20px;background-color:#25D366;color:#ffffff;text-decoration:none;border-radius:6px;font-size:13px;font-weight:600;margin-right:8px;">
                  WhatsApp +57 317 5177409
                </a>
                <a href="mailto:comercial@tmedellintravel.com"
                  style="display:inline-block;padding:9px 20px;background-color:#f3f4f6;color:#374151;text-decoration:none;border-radius:6px;font-size:13px;font-weight:600;border:1px solid #e5e7eb;">
                  Email
                </a>
              </td></tr>
            </table>
          </td></tr>
          <!-- Footer -->
          <tr><td style="background-color:#0A0A0A;padding:20px 32px;text-align:center;">
            <p style="margin:0 0 6px;font-size:13px;color:#9ca3af;">
              <a href="https://instagram.com/transportesmedellintravel" style="color:#D6A75D;text-decoration:none;">@transportesmedellintravel</a>
              &nbsp;·&nbsp;
              <a href="mailto:comercial@tmedellintravel.com" style="color:#D6A75D;text-decoration:none;">comercial@tmedellintravel.com</a>
            </p>
            <p style="margin:0;font-size:11px;color:#6b7280;">
              © 2025 Transportes Medellín Travel · ${language === 'ES' ? 'Todos los derechos reservados' : 'All rights reserved'}
            </p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
  </html>`;

// ─── Template helpers ─────────────────────────────────────────────────────────

const buildPriceRows = (r: ReservaTemplate, isES: boolean): PriceRow[] => {
  const base = toNum(r.precioBase);
  const adicionales = toNum(r.precioAdicionales);
  const nocturno = toNum(r.recargoNocturno);
  const municipioFee = toNum(r.tarifaMunicipio);
  const descuento = toNum(r.descuentoAliado);
  const rows: PriceRow[] = [];
  if (base > 0) rows.push({ label: isES ? 'Precio Base' : 'Base Price', value: formatPrice(base) });
  if (adicionales > 0) rows.push({ label: isES ? 'Adicionales' : 'Add-ons', value: formatPrice(adicionales) });
  if (nocturno > 0) rows.push({ label: isES ? 'Recargo Nocturno' : 'Night Surcharge', value: formatPrice(nocturno) });
  if (municipioFee > 0) rows.push({ label: isES ? 'Tarifa Municipio' : 'City Fee', value: formatPrice(municipioFee) });
  if (descuento > 0) rows.push({ label: isES ? 'Descuento' : 'Discount', value: `-${formatPrice(descuento)}` });
  return rows;
};

const serviceDetailsRows = (r: ReservaTemplate, isES: boolean): Row[] => [
  { label: isES ? 'Servicio' : 'Service', value: svcName(r.servicio.nombre, isES ? 'ES' : 'EN') },
  { label: isES ? 'Fecha' : 'Date', value: formatDate(r.fecha, isES ? 'ES' : 'EN') },
  { label: isES ? 'Hora' : 'Time', value: r.hora },
  { label: isES ? 'Pasajeros' : 'Passengers', value: `${r.numeroPasajeros}` },
  { label: isES ? 'Municipio' : 'City', value: r.otroMunicipio || r.municipio || '' },
  { label: isES ? 'Vehículo' : 'Vehicle', value: r.vehiculo?.nombre || '' },
];

const trackingCta = (r: ReservaTemplate, lang: 'ES' | 'EN', isES: boolean): string =>
  ctaBtn(isES ? 'Ver mi Reserva' : 'View my Booking', getTrackingUrl(r.codigo, lang));

// ─── TEMPLATE 1: Reserva Confirmada ──────────────────────────────────────────

export const tplReservaConfirmada = (r: ReservaTemplate, lang: 'ES' | 'EN'): string => {
  const total = toNum(r.precioTotal);
  const esEfectivo = r.metodoPago === 'EFECTIVO';

  const section = (isES: boolean): string => {
    const l: 'ES' | 'EN' = isES ? 'ES' : 'EN';
    const priceRows = buildPriceRows(r, isES);
    return `
      ${badgeHtml(isES ? 'Reserva Confirmada' : 'Booking Confirmed', '#166534', '#dcfce7')}
      <p style="margin:0 0 6px;font-size:16px;color:#374151;">${isES ? `Hola, <strong>${r.nombreCliente}</strong>` : `Hello, <strong>${r.nombreCliente}</strong>`}</p>
      <p style="margin:0 0 24px;font-size:14px;color:#6b7280;line-height:1.7;">
        ${isES ? 'Tu reserva ha sido confirmada exitosamente. A continuación encontrarás todos los detalles.' : 'Your booking has been confirmed successfully. Below you will find all the details.'}
      </p>
      ${codigoBlock(r.codigo, isES ? 'Código de Reserva' : 'Booking Code')}
      ${sectionHead(isES ? 'Detalles del Servicio' : 'Service Details')}
      ${detailsTable(serviceDetailsRows(r, isES))}
      ${sectionHead(isES ? 'Resumen de Precio' : 'Price Summary')}
      ${priceTable(priceRows, isES ? 'Total a Pagar' : 'Total Amount', formatPrice(total))}
      ${esEfectivo
        ? alertBox(`<strong>${isES ? 'Pago en Efectivo:' : 'Cash Payment:'}</strong> ${isES ? `Ten listos <strong>${formatPrice(total)}</strong> para pagar al conductor al inicio del servicio.` : `Please have <strong>${formatPrice(total)}</strong> ready to pay the driver at the start of the service.`}`, 'info')
        : alertBox(`<strong>${isES ? 'Pago completado con tarjeta.' : 'Card payment confirmed.'}</strong> ${isES ? 'Puedes ver tu recibo en el link de seguimiento.' : 'You can view your receipt on the tracking link.'}`, 'success')
      }
      ${r.notas ? alertBox(`<strong>${isES ? 'Notas:' : 'Notes:'}</strong> ${r.notas}`, 'info') : ''}
      ${trackingCta(r, l, isES)}
      <p style="text-align:center;margin:4px 0 28px;font-size:12px;color:#9ca3af;">
        ${isES ? 'Sigue el estado de tu reserva en tiempo real' : 'Track your reservation status in real time'}
      </p>`;
  };

  return getEmailLayout(buildBilingual(section(false), section(true), lang), lang);
};

// ─── TEMPLATE 2: Pendiente de Pago (Tarjeta) ─────────────────────────────────

export const tplPendientePago = (r: ReservaTemplate, lang: 'ES' | 'EN'): string => {
  const total = toNum(r.precioTotal);

  const section = (isES: boolean): string => {
    const l: 'ES' | 'EN' = isES ? 'ES' : 'EN';
    return `
      ${badgeHtml(isES ? 'Pago Pendiente' : 'Payment Pending', '#92400e', '#fffbeb')}
      <p style="margin:0 0 6px;font-size:16px;color:#374151;">${isES ? `Hola, <strong>${r.nombreCliente}</strong>` : `Hello, <strong>${r.nombreCliente}</strong>`}</p>
      <p style="margin:0 0 24px;font-size:14px;color:#6b7280;line-height:1.7;">
        ${isES ? 'Hemos recibido tu solicitud. Completa el pago para confirmar tu reserva.' : 'We have received your request. Complete the payment to confirm your booking.'}
      </p>
      ${codigoBlock(r.codigo, isES ? 'Código de Reserva' : 'Booking Code')}
      ${sectionHead(isES ? 'Detalles del Servicio' : 'Service Details')}
      ${detailsTable(serviceDetailsRows(r, isES))}
      ${alertBox(`<strong>${isES ? 'Total a pagar:' : 'Total to pay:'}</strong> <span style="font-size:18px;font-weight:700;color:#0A0A0A;">${formatPrice(total)}</span>`, 'warning')}
      ${r.notas ? alertBox(`<strong>${isES ? 'Notas:' : 'Notes:'}</strong> ${r.notas}`, 'info') : ''}
      ${ctaBtn(isES ? 'Completar Pago' : 'Complete Payment', getTrackingUrl(r.codigo, l))}
      <p style="text-align:center;margin:4px 0 28px;font-size:12px;color:#9ca3af;">
        ${isES ? 'Tu cupo queda asegurado una vez procesado el pago' : 'Your spot is secured once payment is processed'}
      </p>`;
  };

  return getEmailLayout(buildBilingual(section(false), section(true), lang), lang);
};

// ─── TEMPLATE 3: Pago Aprobado ────────────────────────────────────────────────

export const tplPagoAprobado = (r: ReservaTemplate, lang: 'ES' | 'EN'): string => {
  const total = toNum(r.precioTotal);

  const section = (isES: boolean): string => {
    const l: 'ES' | 'EN' = isES ? 'ES' : 'EN';
    return `
      ${badgeHtml(isES ? 'Pago Confirmado' : 'Payment Confirmed', '#166534', '#dcfce7')}
      <p style="margin:0 0 6px;font-size:16px;color:#374151;">${isES ? `Hola, <strong>${r.nombreCliente}</strong>` : `Hello, <strong>${r.nombreCliente}</strong>`}</p>
      <p style="margin:0 0 24px;font-size:14px;color:#6b7280;line-height:1.7;">
        ${isES ? 'Hemos recibido tu pago exitosamente. Tu reserva está confirmada.' : 'We have received your payment successfully. Your booking is confirmed.'}
      </p>
      ${codigoBlock(r.codigo, isES ? 'Código de Reserva' : 'Booking Code')}
      ${sectionHead(isES ? 'Recibo de Pago' : 'Payment Receipt')}
      ${detailsTable([
        { label: isES ? 'Servicio' : 'Service', value: svcName(r.servicio.nombre, isES ? 'ES' : 'EN') },
        { label: isES ? 'Fecha' : 'Date', value: formatDate(r.fecha, isES ? 'ES' : 'EN') },
        { label: isES ? 'Monto Pagado' : 'Amount Paid', value: formatPrice(total) },
        { label: isES ? 'Fecha de Pago' : 'Payment Date', value: formatDate(new Date(), isES ? 'ES' : 'EN') },
        { label: isES ? 'ID Transacción' : 'Transaction ID', value: r.pagoId || '' },
      ])}
      ${alertBox(isES ? 'Pronto te asignaremos un conductor. Recibirás un correo con sus datos de contacto.' : 'We will assign you a driver shortly. You will receive an email with their contact details.', 'success')}
      ${trackingCta(r, l, isES)}
      <p style="text-align:center;margin:4px 0 28px;font-size:12px;color:#9ca3af;">
        ${isES ? 'Sigue el estado de tu reserva en tiempo real' : 'Track your reservation status in real time'}
      </p>`;
  };

  return getEmailLayout(buildBilingual(section(false), section(true), lang), lang);
};

// ─── TEMPLATE 4: Conductor Asignado ──────────────────────────────────────────

export const tplConductorAsignado = (r: ReservaTemplate, lang: 'ES' | 'EN'): string => {
  const section = (isES: boolean): string => {
    const l: 'ES' | 'EN' = isES ? 'ES' : 'EN';
    const whatsappNum = r.conductor?.whatsapp?.replace(/\D/g, '') || '';
    return `
      ${badgeHtml(isES ? 'Conductor Asignado' : 'Driver Assigned', '#1d4ed8', '#dbeafe')}
      <p style="margin:0 0 6px;font-size:16px;color:#374151;">${isES ? `Hola, <strong>${r.nombreCliente}</strong>` : `Hello, <strong>${r.nombreCliente}</strong>`}</p>
      <p style="margin:0 0 24px;font-size:14px;color:#6b7280;line-height:1.7;">
        ${isES ? 'Tu conductor ha sido asignado. Aquí tienes sus datos de contacto para coordinar el viaje.' : 'Your driver has been assigned. Here are their contact details to coordinate the trip.'}
      </p>
      ${codigoBlock(r.codigo, isES ? 'Código de Reserva' : 'Booking Code')}
      ${r.conductor ? `
        ${sectionHead(isES ? 'Tu Conductor' : 'Your Driver')}
        ${detailsTable([
          { label: isES ? 'Nombre' : 'Name', value: r.conductor.nombre },
          ...(whatsappNum ? [{ label: 'WhatsApp', value: `<a href="https://wa.me/${whatsappNum}" style="color:#25D366;font-weight:600;text-decoration:none;">${r.conductor.whatsapp}</a>` }] : []),
        ])}` : ''}
      ${r.vehiculo ? `
        ${sectionHead(isES ? 'Vehículo Asignado' : 'Assigned Vehicle')}
        ${detailsTable([{ label: isES ? 'Tipo' : 'Type', value: r.vehiculo.nombre }])}` : ''}
      ${sectionHead(isES ? 'Detalles del Servicio' : 'Service Details')}
      ${detailsTable([
        { label: isES ? 'Servicio' : 'Service', value: svcName(r.servicio.nombre, isES ? 'ES' : 'EN') },
        { label: isES ? 'Fecha' : 'Date', value: formatDate(r.fecha, isES ? 'ES' : 'EN') },
        { label: isES ? 'Hora' : 'Time', value: r.hora },
        { label: isES ? 'Pasajeros' : 'Passengers', value: `${r.numeroPasajeros}` },
      ])}
      ${trackingCta(r, l, isES)}
      <p style="text-align:center;margin:4px 0 28px;font-size:12px;color:#9ca3af;">
        ${isES ? '¡Nos vemos pronto!' : 'See you soon!'}
      </p>`;
  };

  return getEmailLayout(buildBilingual(section(false), section(true), lang), lang);
};

// ─── TEMPLATE 5: Cambio de Estado ────────────────────────────────────────────

const estadoColor: Record<string, { color: string; bg: string }> = {
  PENDING_PAYMENT:     { color: '#92400e', bg: '#fffbeb' },
  CONFIRMED_UNASSIGNED:{ color: '#166534', bg: '#dcfce7' },
  CONFIRMED_ASSIGNED:  { color: '#1d4ed8', bg: '#dbeafe' },
  IN_PROGRESS:         { color: '#4338ca', bg: '#ede9fe' },
  COMPLETED:           { color: '#166534', bg: '#dcfce7' },
  CANCELLED:           { color: '#991b1b', bg: '#fef2f2' },
  PAYMENT_FAILED:      { color: '#991b1b', bg: '#fef2f2' },
};

export const tplCambioEstado = (r: ReservaTemplate, estadoAnterior: string, lang: 'ES' | 'EN'): string => {
  const nuevoColor = estadoColor[r.estado] ?? { color: '#374151', bg: '#f3f4f6' };

  const section = (isES: boolean): string => {
    const l: 'ES' | 'EN' = isES ? 'ES' : 'EN';
    const ef = estadoFriendly[l];
    return `
      ${badgeHtml(isES ? 'Actualización de Reserva' : 'Booking Update', nuevoColor.color, nuevoColor.bg)}
      <p style="margin:0 0 6px;font-size:16px;color:#374151;">${isES ? `Hola, <strong>${r.nombreCliente}</strong>` : `Hello, <strong>${r.nombreCliente}</strong>`}</p>
      <p style="margin:0 0 24px;font-size:14px;color:#6b7280;line-height:1.7;">
        ${isES ? `El estado de tu reserva <strong>${r.codigo}</strong> ha cambiado.` : `The status of your booking <strong>${r.codigo}</strong> has changed.`}
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
        <tr>
          <td style="padding:14px 16px;background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;text-align:center;">
            <p style="margin:0 0 4px;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.08em;">${isES ? 'Estado anterior' : 'Previous status'}</p>
            <p style="margin:0;font-size:15px;font-weight:600;color:#374151;">${ef[estadoAnterior] || estadoAnterior}</p>
          </td>
          <td style="padding:0 12px;font-size:20px;color:#D6A75D;text-align:center;width:40px;">→</td>
          <td style="padding:14px 16px;background-color:${nuevoColor.bg};border:1px solid #e5e7eb;border-radius:6px;text-align:center;">
            <p style="margin:0 0 4px;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.08em;">${isES ? 'Estado actual' : 'Current status'}</p>
            <p style="margin:0;font-size:15px;font-weight:700;color:${nuevoColor.color};">${ef[r.estado] || r.estado}</p>
          </td>
        </tr>
      </table>
      ${sectionHead(isES ? 'Detalles del Servicio' : 'Service Details')}
      ${detailsTable(serviceDetailsRows(r, isES))}
      ${trackingCta(r, l, isES)}
      <p style="text-align:center;margin:4px 0 28px;font-size:12px;color:#9ca3af;">
        ${isES ? 'Sigue el estado en tiempo real' : 'Track your status in real time'}
      </p>`;
  };

  return getEmailLayout(buildBilingual(section(false), section(true), lang), lang);
};

// ─── TEMPLATE 6: Tour Compartido ─────────────────────────────────────────────

const MEETING_POINT = 'Casa del Reloj, Carrera 35 con Calle 7 en Provenza';
const MEETING_TIME  = '7:50 AM';
const MAPS_LINK     = 'https://maps.google.com/?q=Carrera+35+y+Calle+7+Medellin+Provenza';

export const tplTourCompartido = (r: ReservaTemplate, lang: 'ES' | 'EN'): string => {
  const total = toNum(r.precioTotal);
  const esEfectivo = r.metodoPago === 'EFECTIVO';

  const section = (isES: boolean): string => {
    const l: 'ES' | 'EN' = isES ? 'ES' : 'EN';
    return `
      ${badgeHtml(isES ? 'Tour Compartido Confirmado' : 'Shared Tour Confirmed', '#166534', '#dcfce7')}
      <p style="margin:0 0 6px;font-size:16px;color:#374151;">${isES ? `Hola, <strong>${r.nombreCliente}</strong>` : `Hello, <strong>${r.nombreCliente}</strong>`}</p>
      <p style="margin:0 0 24px;font-size:14px;color:#6b7280;line-height:1.7;">
        ${isES ? `Gracias por reservar tu cupo en <strong>${svcName(r.servicio.nombre, 'ES')}</strong>. Aquí tienes toda la información importante.` : `Thank you for booking your spot on <strong>${svcName(r.servicio.nombre, 'EN')}</strong>. Here is all the important information.`}
      </p>
      ${codigoBlock(r.codigo, isES ? 'Código de Reserva' : 'Booking Code')}
      ${sectionHead(isES ? 'Punto de Encuentro' : 'Meeting Point')}
      <table width="100%" cellpadding="0" cellspacing="0" border="0"
        style="border-collapse:collapse;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 6px 6px;overflow:hidden;margin-bottom:16px;">
        <tr>
          <td style="padding:16px 20px;background-color:#f9fafb;border-bottom:1px solid #e5e7eb;">
            <p style="margin:0 0 4px;font-size:13px;color:#6b7280;">${isES ? 'Dirección' : 'Address'}</p>
            <p style="margin:0;font-size:15px;font-weight:600;color:#0A0A0A;">📍 ${MEETING_POINT}</p>
            <p style="margin:8px 0 0;font-size:13px;">
              <a href="${MAPS_LINK}" style="color:#3b82f6;text-decoration:underline;">${isES ? 'Ver en Google Maps' : 'View on Google Maps'}</a>
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 20px;">
            <p style="margin:0 0 4px;font-size:13px;color:#6b7280;">${isES ? 'Hora de Encuentro' : 'Meeting Time'}</p>
            <p style="margin:0;font-size:22px;font-weight:700;color:#D6A75D;">⏰ ${MEETING_TIME}</p>
          </td>
        </tr>
      </table>
      ${alertBox(`<strong>${isES ? 'IMPORTANTE:' : 'IMPORTANT:'}</strong> ${isES ? 'No hay servicio de recogida (pickup). Debes llegar por tus propios medios al punto de encuentro. El tour sale puntual.' : 'There is no pickup service. You must arrive at the meeting point on your own. The tour departs on schedule.'}`, 'warning')}
      ${sectionHead(isES ? 'Detalles de la Reserva' : 'Booking Details')}
      ${detailsTable([
        { label: isES ? 'Fecha' : 'Date', value: formatDate(r.fecha, isES ? 'ES' : 'EN') },
        { label: isES ? 'Pasajeros' : 'Passengers', value: `${r.numeroPasajeros}` },
        { label: isES ? 'Total' : 'Total', value: formatPrice(total) },
        { label: isES ? 'Pago' : 'Payment', value: esEfectivo ? (isES ? 'Efectivo (al conductor)' : 'Cash (to driver)') : (isES ? 'Tarjeta (completado)' : 'Card (completed)') },
      ])}
      ${r.notas ? alertBox(`<strong>${isES ? 'Notas:' : 'Notes:'}</strong> ${r.notas}`, 'info') : ''}
      ${trackingCta(r, l, isES)}
      <p style="text-align:center;margin:4px 0 28px;font-size:12px;color:#9ca3af;">
        ${isES ? '¡Te esperamos!' : 'We look forward to seeing you!'}
      </p>`;
  };

  return getEmailLayout(buildBilingual(section(false), section(true), lang), lang);
};

// ─── TEMPLATE 7: Cotización Pendiente ────────────────────────────────────────

export const tplCotizacionPendiente = (r: ReservaTemplate, lang: 'ES' | 'EN'): string => {
  const section = (isES: boolean): string => {
    const l: 'ES' | 'EN' = isES ? 'ES' : 'EN';
    return `
      ${badgeHtml(isES ? 'Solicitud Recibida' : 'Request Received', '#92400e', '#fffbeb')}
      <p style="margin:0 0 6px;font-size:16px;color:#374151;">${isES ? `Hola, <strong>${r.nombreCliente}</strong>` : `Hello, <strong>${r.nombreCliente}</strong>`}</p>
      <p style="margin:0 0 24px;font-size:14px;color:#6b7280;line-height:1.7;">
        ${isES ? 'Hemos recibido tu solicitud. Dado que tu destino es personalizado, nuestro equipo está preparando tu cotización.' : 'We have received your request. Since your destination is custom, our team is preparing your quote.'}
      </p>
      ${codigoBlock(r.codigo, isES ? 'Código de Solicitud' : 'Request Code')}
      ${sectionHead(isES ? 'Detalles de la Solicitud' : 'Request Details')}
      ${detailsTable(serviceDetailsRows(r, isES))}
      ${alertBox(isES ? '<strong>En breve recibirás un correo</strong> con el precio final y el link de pago.' : '<strong>You will shortly receive an email</strong> with the final price and payment link.', 'warning')}
      ${trackingCta(r, l, isES)}
      <p style="text-align:center;margin:4px 0 28px;font-size:12px;color:#9ca3af;">
        ${isES ? 'Gracias por tu paciencia' : 'Thank you for your patience'}
      </p>`;
  };

  return getEmailLayout(buildBilingual(section(false), section(true), lang), lang);
};

// ─── TEMPLATE 8: Cotización Lista ────────────────────────────────────────────

export const tplCotizacionLista = (r: ReservaTemplate, lang: 'ES' | 'EN'): string => {
  const total = toNum(r.precioTotal);

  const section = (isES: boolean): string => {
    const l: 'ES' | 'EN' = isES ? 'ES' : 'EN';
    const priceRows = buildPriceRows(r, isES);
    return `
      ${badgeHtml(isES ? 'Cotización Lista' : 'Quote Ready', '#166534', '#dcfce7')}
      <p style="margin:0 0 6px;font-size:16px;color:#374151;">${isES ? `Hola, <strong>${r.nombreCliente}</strong>` : `Hello, <strong>${r.nombreCliente}</strong>`}</p>
      <p style="margin:0 0 24px;font-size:14px;color:#6b7280;line-height:1.7;">
        ${isES ? 'Tu cotización personalizada está lista. Revisa los detalles y completa el pago para confirmar.' : 'Your personalized quote is ready. Review the details and complete payment to confirm.'}
      </p>
      ${codigoBlock(r.codigo, isES ? 'Código de Reserva' : 'Booking Code')}
      ${sectionHead(isES ? 'Detalles del Servicio' : 'Service Details')}
      ${detailsTable(serviceDetailsRows(r, isES))}
      ${sectionHead(isES ? 'Tu Cotización' : 'Your Quote')}
      ${priceTable(priceRows, isES ? 'Total a Pagar' : 'Total Amount', formatPrice(total))}
      ${r.notas ? alertBox(`<strong>${isES ? 'Notas:' : 'Notes:'}</strong> ${r.notas}`, 'info') : ''}
      ${ctaBtn(isES ? 'Ver Cotización y Pagar' : 'View Quote & Pay', getTrackingUrl(r.codigo, l))}
      <p style="text-align:center;margin:4px 0 28px;font-size:12px;color:#9ca3af;">
        ${isES ? 'Completa el pago para asegurar tu reserva' : 'Complete payment to secure your booking'}
      </p>`;
  };

  return getEmailLayout(buildBilingual(section(false), section(true), lang), lang);
};

// ─── TEMPLATE 9: Cancelación ─────────────────────────────────────────────────

export const tplCancelacion = (r: ReservaTemplate, lang: 'ES' | 'EN'): string => {
  const total = toNum(r.precioTotal);
  const tienePagoAprobado = r.estadoPago === 'APROBADO';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  const section = (isES: boolean): string => {
    return `
      ${badgeHtml(isES ? 'Reserva Cancelada' : 'Booking Cancelled', '#991b1b', '#fef2f2')}
      <p style="margin:0 0 6px;font-size:16px;color:#374151;">${isES ? `Hola, <strong>${r.nombreCliente}</strong>` : `Hello, <strong>${r.nombreCliente}</strong>`}</p>
      <p style="margin:0 0 24px;font-size:14px;color:#6b7280;line-height:1.7;">
        ${isES ? `Tu reserva <strong>${r.codigo}</strong> ha sido cancelada exitosamente.` : `Your booking <strong>${r.codigo}</strong> has been successfully cancelled.`}
      </p>
      ${sectionHead(isES ? 'Reserva Cancelada' : 'Cancelled Booking')}
      ${detailsTable([
        { label: isES ? 'Código' : 'Code', value: r.codigo },
        { label: isES ? 'Servicio' : 'Service', value: svcName(r.servicio.nombre, isES ? 'ES' : 'EN') },
        { label: isES ? 'Fecha' : 'Date', value: formatDate(r.fecha, isES ? 'ES' : 'EN') },
        { label: isES ? 'Hora' : 'Time', value: r.hora },
        { label: isES ? 'Pasajeros' : 'Passengers', value: `${r.numeroPasajeros}` },
      ])}
      ${tienePagoAprobado
        ? alertBox(`<strong>${isES ? 'Reembolso:' : 'Refund:'}</strong> ${isES ? `El monto de <strong>${formatPrice(total)}</strong> será reembolsado en 5–7 días hábiles.` : `The amount of <strong>${formatPrice(total)}</strong> will be refunded within 5–7 business days.`}`, 'info')
        : ''}
      ${ctaBtn(isES ? 'Hacer Nueva Reserva' : 'Make New Booking', `${appUrl}/`)}
      <p style="text-align:center;margin:4px 0 12px;font-size:13px;color:#6b7280;">
        ${isES ? '¿Tienes preguntas? Contáctanos por WhatsApp.' : 'Have questions? Contact us via WhatsApp.'}
      </p>
      <p style="text-align:center;margin:0 0 28px;">
        <a href="https://wa.me/573175177409" style="color:#25D366;font-weight:600;text-decoration:none;font-size:14px;">+57 317 5177409</a>
      </p>`;
  };

  return getEmailLayout(buildBilingual(section(false), section(true), lang), lang);
};

// ─── TEMPLATE 10: Servicio Completado + Rating ───────────────────────────────

export const tplServicioCompletado = (r: ReservaTemplate, lang: 'ES' | 'EN'): string => {
  const section = (isES: boolean): string => {
    const l: 'ES' | 'EN' = isES ? 'ES' : 'EN';
    const ratingUrl = `${getTrackingUrl(r.codigo, l)}#calificacion`;
    return `
      ${badgeHtml(isES ? 'Servicio Completado' : 'Service Completed', '#166534', '#dcfce7')}
      <p style="margin:0 0 6px;font-size:16px;color:#374151;">${isES ? `Hola, <strong>${r.nombreCliente}</strong>` : `Hello, <strong>${r.nombreCliente}</strong>`}</p>
      <p style="margin:0 0 24px;font-size:14px;color:#6b7280;line-height:1.7;">
        ${isES ? 'Esperamos que hayas disfrutado tu experiencia con Transportes Medellín Travel. ¡Fue un placer servirte!' : 'We hope you enjoyed your experience with Transportes Medellín Travel. It was a pleasure serving you!'}
      </p>
      ${sectionHead(isES ? 'Servicio Realizado' : 'Completed Service')}
      ${detailsTable([
        { label: isES ? 'Servicio' : 'Service', value: svcName(r.servicio.nombre, isES ? 'ES' : 'EN') },
        { label: isES ? 'Fecha' : 'Date', value: formatDate(r.fecha, isES ? 'ES' : 'EN') },
        { label: isES ? 'Pasajeros' : 'Passengers', value: `${r.numeroPasajeros}` },
        { label: isES ? 'Código' : 'Code', value: r.codigo },
      ])}
      <table width="100%" cellpadding="0" cellspacing="0" border="0"
        style="background-color:#fffbeb;border:1px solid #fde68a;border-radius:8px;margin:20px 0;">
        <tr><td style="padding:24px;text-align:center;">
          <p style="margin:0 0 8px;font-size:20px;">⭐⭐⭐⭐⭐</p>
          <p style="margin:0 0 4px;font-size:16px;font-weight:700;color:#92400e;">${isES ? '¿Cómo fue tu experiencia?' : 'How was your experience?'}</p>
          <p style="margin:0 0 16px;font-size:13px;color:#78350f;">
            ${isES ? 'Tu opinión nos ayuda a mejorar y a otros viajeros a elegir con confianza.' : 'Your feedback helps us improve and helps other travelers choose with confidence.'}
          </p>
          ${ctaBtn(isES ? 'Calificar mi Experiencia' : 'Rate my Experience', ratingUrl)}
        </td></tr>
      </table>
      ${process.env.NEXT_PUBLIC_GOOGLE_REVIEW_URL ? `
      <table width="100%" cellpadding="0" cellspacing="0" border="0"
        style="background-color:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;margin:0 0 20px;">
        <tr><td style="padding:20px;text-align:center;">
          <p style="margin:0 0 6px;font-size:15px;font-weight:700;color:#1e40af;">
            ${isES ? '⭐ Ayúdanos también en Google' : '⭐ Help us on Google too'}
          </p>
          <p style="margin:0 0 14px;font-size:13px;color:#1e3a8a;">
            ${isES ? 'Una reseña en Google nos ayuda muchísimo a llegar a más viajeros.' : 'A Google review helps us reach more travelers.'}
          </p>
          ${ctaBtn(isES ? 'Reseñar en Google' : 'Review on Google', process.env.NEXT_PUBLIC_GOOGLE_REVIEW_URL)}
        </td></tr>
      </table>` : ''}
      <p style="text-align:center;margin:0 0 28px;font-size:14px;color:#374151;">
        ${isES ? '¡Esperamos verte pronto de nuevo!' : 'We hope to see you again soon!'}
      </p>`;
  };

  return getEmailLayout(buildBilingual(section(false), section(true), lang), lang);
};

// ─── TEMPLATE 11: Aliado — Nueva Reserva (siempre ES) ────────────────────────

export const tplAliadoNuevaReserva = (r: ReservaTemplate, aliado: AliadoTemplate): string => {
  const total = toNum(r.precioTotal);
  const cobrar = r.clientePaga !== false;
  const priceRows = buildPriceRows(r, true);

  const content = `
    ${badgeHtml('Nueva Reserva', '#1d4ed8', '#dbeafe')}
    <p style="margin:0 0 6px;font-size:16px;color:#374151;">Estimado/a <strong>${aliado.nombre}</strong>,</p>
    <p style="margin:0 0 24px;font-size:14px;color:#6b7280;line-height:1.7;">
      Se ha generado una nueva reserva a través de tu enlace o código de aliado.
    </p>
    ${codigoBlock(r.codigo, 'Código de Reserva')}
    ${sectionHead('Datos del Cliente')}
    ${detailsTable([
      { label: 'Nombre', value: r.nombreCliente },
      { label: 'WhatsApp', value: r.whatsappCliente
        ? `<a href="https://wa.me/${r.whatsappCliente.replace(/\D/g,'')}" style="color:#25D366;font-weight:600;text-decoration:none;">${r.whatsappCliente}</a>`
        : '' },
      { label: 'Email', value: r.emailCliente },
    ])}
    ${sectionHead('Detalles del Servicio')}
    ${detailsTable([
      { label: 'Servicio', value: svcName(r.servicio.nombre, 'ES') },
      { label: 'Fecha', value: formatDate(r.fecha, 'ES') },
      { label: 'Hora', value: r.hora },
      { label: 'Pasajeros', value: `${r.numeroPasajeros}` },
      { label: 'Municipio', value: r.otroMunicipio || r.municipio || '' },
      { label: 'Vehículo', value: r.vehiculo?.nombre || '' },
    ])}
    ${sectionHead('Resumen de Precio')}
    ${priceTable(priceRows, 'Total', formatPrice(total))}
    <table width="100%" cellpadding="0" cellspacing="0" border="0"
      style="border-collapse:collapse;border-left:4px solid ${cobrar ? '#22c55e' : '#f59e0b'};background-color:${cobrar ? '#f0fdf4' : '#fffbeb'};border-radius:0 6px 6px 0;margin:16px 0;">
      <tr><td style="padding:14px 20px;">
        <p style="margin:0 0 4px;font-size:16px;font-weight:700;color:${cobrar ? '#166534' : '#92400e'};">
          ${cobrar ? '✅ COBRAR AL CLIENTE' : '⛔ NO COBRAR AL CLIENTE'}
        </p>
        <p style="margin:0;font-size:13px;color:#6b7280;">
          ${cobrar ? 'El cliente debe pagar este servicio directamente.' : 'Este servicio está cubierto por el aliado. No cobrar al cliente.'}
        </p>
      </td></tr>
    </table>
    ${r.notas ? alertBox(`<strong>Notas del cliente:</strong> ${r.notas}`, 'info') : ''}
    <p style="margin:28px 0 0;font-size:13px;color:#9ca3af;text-align:center;">
      Gracias por ser parte de nuestra red de aliados
    </p>`;

  return getEmailLayout(content, 'ES');
};

// ─── Legacy exports (backward compatibility) ──────────────────────────────────

export const confirmacionReservaCliente = (r: ReservaTemplate, idioma: 'es' | 'en'): string =>
  tplReservaConfirmada(r, idioma === 'en' ? 'EN' : 'ES');

export const notificacionAliadoReserva = (r: ReservaTemplate, aliado: AliadoTemplate): string =>
  tplAliadoNuevaReserva(r, aliado);

export const actualizacionEstadoCliente = (r: ReservaTemplate, idioma: 'es' | 'en'): string =>
  tplConductorAsignado(r, idioma === 'en' ? 'EN' : 'ES');
