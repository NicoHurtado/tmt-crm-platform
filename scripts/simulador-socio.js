#!/usr/bin/env node
/**
 * Simulador del lado de la agencia (socio de API).
 *
 * Levanta un sitio web falso que hace de "plataforma del socio": el huésped llena el
 * formulario, el servidor del socio nos consulta el precio, el huésped paga en una
 * pasarela simulada y el servidor del socio nos manda la reserva.
 *
 * Reproduce la arquitectura real — navegador → servidor del socio → API de TMT — porque
 * la llave nunca debe viajar al navegador. Cada paso muestra el request y el response
 * exactos, para ver qué se está mandando y qué devolvemos.
 *
 * Uso:
 *   TMT_API_KEY=<llave de housy-test> node scripts/simulador-socio.js
 *   → abrir http://localhost:4100
 *
 * Variables opcionales:
 *   TMT_API_URL   por defecto https://www.medellintransportes.com
 *   PORT          por defecto 4100
 *
 * ⚠️ Confirmar una reserva aquí la crea DE VERDAD: manda un correo real al email que
 *    pongas y crea un evento real en el calendario. Usa siempre la llave de pruebas.
 */

const http = require('http');

const API_KEY = process.env.TMT_API_KEY;
const API_URL = (process.env.TMT_API_URL || 'https://www.medellintransportes.com').replace(/\/$/, '');
const PORT = Number(process.env.PORT || 4100);
const SERVICIO_AEROPUERTO = 'cmihxd4vy00159svu4opysoho';

if (!API_KEY) {
    console.error('\n❌ Falta la llave.\n');
    console.error('   TMT_API_KEY=<llave de housy-test> node scripts/simulador-socio.js\n');
    console.error('   Para obtenerla:');
    console.error('   psql "$DATABASE_URL" -A -t -c \'select "apiKey" from "Socio" where codigo=\\\'housy-test\\\';\'\n');
    process.exit(1);
}

// ── Llamadas a la API de TMT (esto es lo que haría el backend del socio) ──────

async function llamarTMT(ruta, cuerpo) {
    const res = await fetch(`${API_URL}${ruta}`, {
        method: 'POST',
        headers: { 'x-api-key': API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify(cuerpo),
    });
    let datos;
    try {
        datos = await res.json();
    } catch {
        datos = { ok: false, error: `Respuesta no-JSON (HTTP ${res.status})` };
    }
    return { status: res.status, datos };
}

// ── Utilidades de presentación ───────────────────────────────────────────────

const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );

const cop = (n) => '$' + Number(n).toLocaleString('es-CO');

/** Muestra el intercambio HTTP crudo, que es lo que el socio tiene que implementar. */
const bloqueHttp = (titulo, metodo, ruta, req, status, res) => `
  <details class="http" ${status >= 400 ? 'open' : ''}>
    <summary>${esc(titulo)} <code>${esc(metodo)} ${esc(ruta)}</code>
      <span class="status ${status < 300 ? 'ok' : status < 500 ? 'warn' : 'err'}">HTTP ${status}</span>
    </summary>
    <div class="par">
      <div><h4>Request</h4><pre>${esc(JSON.stringify(req, null, 2))}</pre></div>
      <div><h4>Response</h4><pre>${esc(JSON.stringify(res, null, 2))}</pre></div>
    </div>
  </details>`;

const pagina = (titulo, contenido) => `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(titulo)} · Simulador socio</title>
<style>
  *{box-sizing:border-box}
  body{margin:0;font:15px/1.55 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
       background:#f4f5f7;color:#1a1a1a}
  .barra{background:#14304a;color:#fff;padding:14px 24px;display:flex;align-items:center;gap:12px}
  .barra strong{font-size:16px}
  .barra .tag{margin-left:auto;font-size:12px;background:#ffffff22;padding:3px 10px;border-radius:99px}
  .wrap{max-width:820px;margin:28px auto;padding:0 20px}
  .card{background:#fff;border-radius:12px;padding:26px;box-shadow:0 1px 3px #0000001a;margin-bottom:20px}
  h1{font-size:21px;margin:0 0 6px} h2{font-size:17px;margin:0 0 14px}
  .sub{color:#666;margin:0 0 22px;font-size:14px}
  label{display:block;font-size:12px;font-weight:600;color:#444;margin:14px 0 5px;
        text-transform:uppercase;letter-spacing:.04em}
  input,select{width:100%;padding:9px 11px;border:1px solid #d3d7dd;border-radius:7px;font-size:15px;font-family:inherit}
  .fila{display:grid;grid-template-columns:1fr 1fr;gap:16px}
  button{margin-top:22px;width:100%;padding:13px;border:0;border-radius:8px;
         background:#14304a;color:#fff;font-size:15px;font-weight:600;cursor:pointer}
  button:hover{background:#1d4468}
  button.pagar{background:#0a8f4a} button.pagar:hover{background:#0b7f43}
  a.volver{display:inline-block;margin-top:18px;color:#14304a;font-size:14px}
  .precio{background:#f0f6ff;border:1px solid #cfe0f7;border-radius:10px;padding:20px;margin:6px 0 4px}
  .precio .total{font-size:32px;font-weight:700;color:#14304a}
  .precio .det{color:#555;font-size:13px;margin-top:8px}
  .aviso{background:#fff8e6;border:1px solid #f0d9a0;border-radius:8px;padding:13px;
         font-size:13px;color:#6b4e00;margin-top:16px}
  .error{background:#fdeaea;border:1px solid #f2b8b8;border-radius:8px;padding:15px;color:#8a1f1f}
  .exito{background:#e9f8ef;border:1px solid #a8dfc0;border-radius:10px;padding:22px;text-align:center}
  .exito .codigo{font-size:31px;font-weight:700;letter-spacing:3px;color:#0a5c33;font-family:ui-monospace,monospace}
  dl{display:grid;grid-template-columns:auto 1fr;gap:7px 18px;font-size:14px;margin:18px 0 0}
  dt{color:#666} dd{margin:0;font-weight:500}
  details.http{background:#fbfbfc;border:1px solid #e3e5e9;border-radius:9px;margin-top:20px;font-size:13px}
  details.http summary{cursor:pointer;padding:11px 14px;display:flex;align-items:center;gap:9px;font-weight:600}
  details.http code{background:#eceef1;padding:2px 7px;border-radius:4px;font-size:12px;font-weight:400}
  .status{margin-left:auto;font-size:11px;padding:2px 9px;border-radius:99px;font-weight:700}
  .status.ok{background:#d6f5e3;color:#0a5c33}
  .status.warn{background:#fdecc8;color:#7a5200}
  .status.err{background:#fbd9d9;color:#8a1f1f}
  .par{display:grid;grid-template-columns:1fr 1fr;gap:14px;padding:0 14px 14px}
  .par h4{margin:0 0 6px;font-size:11px;text-transform:uppercase;color:#777;letter-spacing:.05em}
  pre{background:#14304a;color:#e8eef4;padding:12px;border-radius:7px;overflow:auto;
      font-size:11.5px;line-height:1.5;margin:0;max-height:340px}
  @media(max-width:720px){.fila,.par{grid-template-columns:1fr}}
</style></head><body>
<div class="barra">
  <strong>Housy</strong> <span style="opacity:.65">— simulación de la plataforma del socio</span>
  <span class="tag">llave de pruebas</span>
</div>
<div class="wrap">${contenido}</div>
</body></html>`;

// ── Paso 1: formulario que llena el huésped en el sitio del socio ────────────

function vistaFormulario(valores = {}) {
    const v = (k, d = '') => esc(valores[k] ?? d);
    const manana = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
    return pagina(
        'Reservar traslado',
        `<div class="card">
      <h1>Reserva tu traslado al aeropuerto</h1>
      <p class="sub">Lo que vería el huésped en la página de la agencia.</p>
      <form method="POST" action="/cotizar">
        <div class="fila">
          <div><label>Pasajeros</label>
            <input type="number" name="numeroPasajeros" min="1" value="${v('numeroPasajeros', '2')}" required></div>
          <div><label>Aeropuerto</label>
            <select name="aeropuertoNombre">
              <option value="JOSE_MARIA_CORDOVA">José María Córdova (JMC)</option>
              <option value="OLAYA_HERRERA" ${valores.aeropuertoNombre === 'OLAYA_HERRERA' ? 'selected' : ''}>Olaya Herrera</option>
            </select></div>
        </div>
        <div class="fila">
          <div><label>Fecha</label>
            <input type="date" name="fecha" value="${v('fecha', manana)}" required></div>
          <div><label>Hora</label>
            <input type="time" name="hora" value="${v('hora', '23:30')}" required></div>
        </div>
        <label>Sentido del traslado</label>
        <select name="aeropuertoTipo">
          <option value="DESDE">Del aeropuerto a mi alojamiento (llegada)</option>
          <option value="HACIA" ${valores.aeropuertoTipo === 'HACIA' ? 'selected' : ''}>De mi alojamiento al aeropuerto (salida)</option>
        </select>
        <label>Dirección del alojamiento</label>
        <input name="lugarRecogida" value="${v('lugarRecogida', 'Cra 43A #7-50, Apto 1204, El Poblado')}" required>
        <label>Número de vuelo (opcional pero recomendado)</label>
        <input name="numeroVuelo" value="${v('numeroVuelo', 'AV8432')}">
        <div class="fila">
          <div><label>Nombre del huésped</label>
            <input name="nombreCliente" value="${v('nombreCliente', 'Prueba Simulador')}" required></div>
          <div><label>WhatsApp (con indicativo)</label>
            <input name="whatsappCliente" value="${v('whatsappCliente', '+573001234567')}" required></div>
        </div>
        <label>Correo del huésped — aquí llega la confirmación</label>
        <input type="email" name="emailCliente" value="${v('emailCliente', '')}" placeholder="tu-correo@ejemplo.com" required>
        <button type="submit">Ver precio</button>
      </form>
      <div class="aviso">
        <strong>Ojo:</strong> ver el precio no crea nada. Confirmar en el paso siguiente
        sí crea una reserva real, manda un correo real y crea un evento real en el calendario.
      </div>
    </div>`
    );
}

// ── Paso 2: el socio nos cotiza y le muestra el precio a su huésped ──────────

async function vistaCotizacion(f) {
    const peticion = {
        servicioId: SERVICIO_AEROPUERTO,
        numeroPasajeros: Number(f.numeroPasajeros),
        hora: f.hora,
        aeropuertoNombre: f.aeropuertoNombre,
    };
    const { status, datos } = await llamarTMT('/api/socios/cotizar', peticion);
    const http = bloqueHttp('El servidor del socio nos consulta el precio', 'POST', '/api/socios/cotizar', peticion, status, datos);

    if (!datos.ok) {
        return pagina(
            'Sin disponibilidad',
            `<div class="card">
        <h2>No pudimos cotizar</h2>
        <div class="error"><strong>${esc(datos.error || 'Error desconocido')}</strong></div>
        <p class="sub" style="margin-top:14px">
          ${status === 400
            ? 'Es un <strong>400</strong>: la petición tiene algo mal. La agencia debe corregirla; reintentar igual no sirve.'
            : status === 401
              ? 'Es un <strong>401</strong>: problema con la llave.'
              : 'Es un <strong>500</strong>: falla nuestra. Aquí la agencia sí debe reintentar.'}
        </p>
        ${http}
        <a class="volver" href="/">← Volver</a>
      </div>`
        );
    }

    const oculto = Object.entries(f)
        .map(([k, val]) => `<input type="hidden" name="${esc(k)}" value="${esc(val)}">`)
        .join('');
    const d = datos.desglose;

    return pagina(
        'Confirma tu traslado',
        `<div class="card">
      <h2>Precio de tu traslado</h2>
      <div class="precio">
        <div class="total">${cop(datos.total)} COP</div>
        <div class="det">
          ${esc(datos.vehiculo.nombre)} · hasta ${datos.vehiculo.capacidadMaxima} pasajeros<br>
          Tarifa ${cop(d.precioBase)}${d.recargoNocturno > 0 ? ` · recargo nocturno ${cop(d.recargoNocturno)}` : ''}
        </div>
      </div>
      <p class="sub" style="margin-top:14px">
        Este es el precio que TMT le cobra a la agencia. Lo que la agencia le cobre a su
        huésped (con su margen) es decisión suya — el huésped vería ese otro número.
      </p>
      <form method="POST" action="/confirmar">
        ${oculto}
        <button class="pagar" type="submit">Pagar ${cop(datos.total)} y confirmar</button>
      </form>
      <p class="sub" style="text-align:center;margin:10px 0 0;font-size:12.5px">
        Simula la pasarela de la agencia. Al confirmar, nos manda la reserva ya pagada.
      </p>
      ${http}
      <a class="volver" href="/">← Cambiar los datos</a>
    </div>`
    );
}

// ── Paso 3: el huésped pagó; el socio nos manda la reserva ───────────────────

async function vistaConfirmacion(f) {
    // refExterna: el id que la reserva tiene del lado del socio. Debe ser único y estable
    // por reserva — es lo que hace idempotente el reintento.
    const refExterna = f.refExterna || `sim-${Date.now()}`;
    const peticion = {
        refExterna,
        servicioId: SERVICIO_AEROPUERTO,
        numeroPasajeros: Number(f.numeroPasajeros),
        fecha: f.fecha,
        hora: f.hora,
        aeropuertoNombre: f.aeropuertoNombre,
        aeropuertoTipo: f.aeropuertoTipo,
        lugarRecogida: f.lugarRecogida,
        numeroVuelo: f.numeroVuelo || undefined,
        nombreCliente: f.nombreCliente,
        whatsappCliente: f.whatsappCliente,
        emailCliente: f.emailCliente,
        idioma: 'ES',
        notas: 'Creada desde el simulador del socio',
    };

    const { status, datos } = await llamarTMT('/api/socios/reservas', peticion);
    const http = bloqueHttp('El servidor del socio nos manda la reserva ya pagada', 'POST', '/api/socios/reservas', peticion, status, datos);

    if (!datos.ok) {
        return pagina(
            'No se pudo confirmar',
            `<div class="card">
        <h2>La reserva no se creó</h2>
        <div class="error"><strong>${esc(datos.error || 'Error desconocido')}</strong></div>
        <p class="sub" style="margin-top:14px">
          ${status >= 500
            ? 'Es un <strong>500</strong>: falla nuestra. La agencia debe <strong>reintentar con la misma refExterna</strong> — la idempotencia hace que sea seguro y no se duplica el traslado.'
            : 'Es un <strong>400</strong>: la petición tiene algo mal. Corregir y reenviar; reintentar igual no sirve.'}
        </p>
        ${http}
        <a class="volver" href="/">← Volver</a>
      </div>`
        );
    }

    // Botón para reenviar lo mismo: demuestra que un reintento no duplica el traslado.
    const reintento = Object.entries({ ...f, refExterna })
        .map(([k, val]) => `<input type="hidden" name="${esc(k)}" value="${esc(val)}">`)
        .join('');

    return pagina(
        '¡Traslado confirmado!',
        `<div class="card">
      <div class="exito">
        <div style="font-size:13px;color:#0a5c33;letter-spacing:.08em;text-transform:uppercase">
          ${datos.duplicado ? 'Ya existía — no se duplicó' : 'Traslado confirmado'}
        </div>
        <div class="codigo" style="margin-top:8px">${esc(datos.codigo)}</div>
      </div>
      <dl>
        <dt>Estado</dt><dd>${esc(datos.estado)} <span style="color:#666;font-weight:400">— confirmada, asignando conductor</span></dd>
        <dt>Fecha y hora</dt><dd>${esc(datos.fecha)} a las ${esc(datos.hora)}</dd>
        <dt>Vehículo</dt><dd>${esc(datos.vehiculo)} · ${esc(datos.numeroPasajeros)} pasajeros</dd>
        <dt>Total</dt><dd>${cop(datos.total)} COP</dd>
        <dt>Ref. del socio</dt><dd>${esc(refExterna)}</dd>
        <dt>Seguimiento</dt><dd><a href="${esc(datos.tracking)}" target="_blank">${esc(datos.tracking)}</a></dd>
      </dl>
      <div class="aviso">
        Al huésped le acaba de llegar un correo a <strong>${esc(f.emailCliente)}</strong> con
        este código. Debe decir <strong>"Pago ya realizado — no debes entregarle dinero al
        conductor"</strong>. Si dice que pague en efectivo, hay un problema.
      </div>
      <form method="POST" action="/confirmar">
        ${reintento}
        <button type="submit" style="background:#5b6470">Reenviar la misma refExterna (probar idempotencia)</button>
      </form>
      <p class="sub" style="text-align:center;margin:9px 0 0;font-size:12.5px">
        Debe devolver <code>200</code> con <code>duplicado: true</code> y el mismo código —
        sin crear un segundo traslado.
      </p>
      ${http}
      <a class="volver" href="/">← Hacer otra reserva</a>
    </div>`
    );
}

// ── Servidor ─────────────────────────────────────────────────────────────────

function leerFormulario(req) {
    return new Promise((resolve) => {
        let cuerpo = '';
        req.on('data', (c) => {
            cuerpo += c;
            if (cuerpo.length > 1e6) req.destroy();
        });
        req.on('end', () => resolve(Object.fromEntries(new URLSearchParams(cuerpo))));
    });
}

http.createServer(async (req, res) => {
    const responder = (html) => {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
    };

    try {
        if (req.method === 'GET' && req.url === '/') return responder(vistaFormulario());
        if (req.method === 'POST' && req.url === '/cotizar') {
            return responder(await vistaCotizacion(await leerFormulario(req)));
        }
        if (req.method === 'POST' && req.url === '/confirmar') {
            return responder(await vistaConfirmacion(await leerFormulario(req)));
        }
        res.writeHead(302, { Location: '/' });
        res.end();
    } catch (e) {
        console.error(e);
        responder(
            pagina(
                'Error del simulador',
                `<div class="card"><h2>Error en el simulador</h2>
         <div class="error">${esc(e.message)}</div>
         <p class="sub" style="margin-top:12px">Esto es un fallo de este script, no de la API.</p>
         <a class="volver" href="/">← Volver</a></div>`
            )
        );
    }
}).listen(PORT, () => {
    console.log(`\n  Simulador del socio corriendo\n`);
    console.log(`  →  http://localhost:${PORT}\n`);
    console.log(`  API:   ${API_URL}`);
    console.log(`  Llave: ...${API_KEY.slice(-6)}\n`);
    console.log(`  Confirmar una reserva la crea DE VERDAD (correo + calendario).`);
    console.log(`  Ctrl+C para salir.\n`);
});
