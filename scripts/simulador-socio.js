#!/usr/bin/env node
/**
 * Demo de la integración con un socio de API, para presentar en reunión.
 *
 * Levanta un sitio que hace de "plataforma de la agencia" y recorre el flujo completo
 * en cuatro pantallas: datos del huésped → precio que consultamos a TMT → pasarela de
 * pago simulada → reserva creada en el sistema de TMT.
 *
 * Lo único simulado es la pasarela de pago y la marca de la agencia. **Las llamadas a
 * TMT son reales**: el precio sale del catálogo de producción y la reserva queda creada
 * de verdad, con su correo al huésped, su evento de calendario y su fila en el CRM. Esa
 * es la gracia — al terminar la demo se entra al CRM y la reserva está ahí.
 *
 * Reproduce la arquitectura que tendrá que montar la agencia — navegador → servidor de
 * la agencia → API de TMT — porque la llave nunca debe viajar al navegador.
 *
 * Uso:
 *   TMT_API_KEY=<llave de housy-test> node scripts/simulador-socio.js
 *   → abrir http://localhost:4100
 *
 * Variables opcionales:
 *   TMT_API_URL   por defecto https://www.medellintransportes.com
 *   SOCIO_NOMBRE  por defecto "Housy" — el nombre que se muestra como la agencia
 *   PORT          por defecto 4100
 */

const http = require('http');

const API_KEY = process.env.TMT_API_KEY;
const API_URL = (process.env.TMT_API_URL || 'https://www.medellintransportes.com').replace(/\/$/, '');
const SOCIO_NOMBRE = process.env.SOCIO_NOMBRE || 'Housy';
const PORT = Number(process.env.PORT || 4100);
const SERVICIO_AEROPUERTO = 'cmihxd4vy00159svu4opysoho';

if (!API_KEY) {
    console.error('\n  Falta la llave.\n');
    console.error('  TMT_API_KEY=<llave de housy-test> node scripts/simulador-socio.js\n');
    console.error('  Para obtenerla:');
    console.error('    psql "$DATABASE_URL" -A -t -c \'select "apiKey" from "Socio" where codigo=\\\'housy-test\\\';\'\n');
    process.exit(1);
}

// ── Llamadas a TMT — esto es lo que hará el backend de la agencia ────────────

async function llamarTMT(ruta, cuerpo) {
    const t0 = Date.now();
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
    return { status: res.status, datos, ms: Date.now() - t0 };
}

// ── Utilidades ───────────────────────────────────────────────────────────────

const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );

const cop = (n) => '$' + Math.round(Number(n)).toLocaleString('es-CO');

const ocultos = (obj) =>
    Object.entries(obj)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}">`)
        .join('');

const PASOS = ['Datos del huésped', 'Precio', 'Pago', 'Reserva confirmada'];

const barraPasos = (activo) => `
  <ol class="pasos">
    ${PASOS.map(
        (p, i) => `<li class="${i < activo ? 'hecho' : i === activo ? 'activo' : ''}">
        <span class="n">${i < activo ? '&#10003;' : i + 1}</span><span class="t">${esc(p)}</span>
      </li>`
    ).join('')}
  </ol>`;

/** Panel lateral que explica, en una frase, qué está pasando por detrás. */
const nota = (quien, texto) => `
  <aside class="nota">
    <span class="quien ${quien === 'TMT' ? 'tmt' : 'socio'}">${quien === 'TMT' ? 'TMT' : SOCIO_NOMBRE}</span>
    <p>${texto}</p>
  </aside>`;

/** Intercambio HTTP crudo — lo que la agencia tiene que implementar. */
const bloqueHttp = (titulo, ruta, req, status, res, ms) => `
  <details class="http">
    <summary>
      <span class="lupa">&#9881;</span> ${esc(titulo)}
      <code>POST ${esc(ruta)}</code>
      <span class="status ${status < 300 ? 'ok' : status < 500 ? 'warn' : 'err'}">HTTP ${status}</span>
      <span class="ms">${ms} ms</span>
    </summary>
    <div class="par">
      <div><h4>Lo que envía ${esc(SOCIO_NOMBRE)}</h4><pre>${esc(JSON.stringify(req, null, 2))}</pre></div>
      <div><h4>Lo que responde TMT</h4><pre>${esc(JSON.stringify(res, null, 2))}</pre></div>
    </div>
  </details>`;

const ESTILOS = `
  *{box-sizing:border-box;margin:0;padding:0}
  body{font:16px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
       background:#eef1f5;color:#16202b;-webkit-font-smoothing:antialiased}
  .top{background:#0f2436;color:#fff;padding:0 30px;height:62px;display:flex;align-items:center;gap:14px}
  .top .marca{font-size:19px;font-weight:700;letter-spacing:-.3px}
  .top .sep{opacity:.35;font-size:14px}
  .top .demo{margin-left:auto;font-size:11.5px;background:#ffffff1c;padding:5px 13px;border-radius:99px;
             letter-spacing:.06em;text-transform:uppercase;font-weight:600}
  .aviso-top{background:#fff4d6;border-bottom:1px solid #f0dca6;color:#6a4e00;
             font-size:12.5px;padding:9px 30px;text-align:center}
  .aviso-top strong{font-weight:700}

  .pasos{list-style:none;display:flex;justify-content:center;gap:0;margin:30px auto 26px;
         max-width:760px;padding:0 20px;flex-wrap:wrap}
  .pasos li{display:flex;align-items:center;gap:9px;font-size:13px;color:#93a1b0;
            padding:0 20px;position:relative}
  .pasos li:not(:last-child):after{content:'';position:absolute;right:-2px;width:22px;height:1px;
            background:#cfd8e1}
  .pasos .n{width:25px;height:25px;border-radius:50%;background:#dde4ec;color:#7d8b9a;
            display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0}
  .pasos li.activo{color:#0f2436;font-weight:700}
  .pasos li.activo .n{background:#0f2436;color:#fff}
  .pasos li.hecho{color:#1c8a58}
  .pasos li.hecho .n{background:#d5f2e3;color:#1c8a58}

  .wrap{max-width:700px;margin:0 auto 60px;padding:0 20px}
  .card{background:#fff;border-radius:16px;padding:34px;box-shadow:0 2px 14px #0f24361a}
  h1{font-size:24px;letter-spacing:-.4px;margin-bottom:7px}
  h2{font-size:20px;letter-spacing:-.3px;margin-bottom:7px}
  .sub{color:#6b7b8a;font-size:14.5px;margin-bottom:26px}

  label{display:block;font-size:11.5px;font-weight:700;color:#5a6b7a;margin:18px 0 6px;
        text-transform:uppercase;letter-spacing:.05em}
  input,select{width:100%;padding:11px 13px;border:1.5px solid #d8dfe6;border-radius:9px;
               font-size:15.5px;font-family:inherit;background:#fff;transition:border-color .15s}
  input:focus,select:focus{outline:0;border-color:#0f2436}
  .fila{display:grid;grid-template-columns:1fr 1fr;gap:16px}
  .fila3{display:grid;grid-template-columns:2fr 1fr 1fr;gap:16px}

  button{margin-top:28px;width:100%;padding:15px;border:0;border-radius:11px;background:#0f2436;
         color:#fff;font-size:16px;font-weight:600;font-family:inherit;cursor:pointer;transition:background .15s}
  button:hover{background:#1a3a55}
  button.pagar{background:#0a8f4a;font-size:17px}
  button.pagar:hover{background:#0a7d41}
  button.gris{background:#6b7b8a;font-size:14px;padding:12px}
  button.gris:hover{background:#5a6b7a}
  a.volver{display:inline-block;margin-top:20px;color:#5a6b7a;font-size:14px;text-decoration:none}
  a.volver:hover{color:#0f2436}

  .precio-box{background:linear-gradient(160deg,#f5f9ff,#eaf1fb);border:1.5px solid #d3e0f2;
              border-radius:14px;padding:26px;text-align:center;margin-bottom:8px}
  .precio-box .et{font-size:11.5px;text-transform:uppercase;letter-spacing:.08em;color:#6b7b8a;font-weight:700}
  .precio-box .total{font-size:44px;font-weight:800;color:#0f2436;letter-spacing:-1.5px;margin:6px 0}
  .precio-box .veh{font-size:14px;color:#5a6b7a}
  .desglose{display:flex;justify-content:center;gap:20px;margin-top:14px;flex-wrap:wrap;
            font-size:12.5px;color:#6b7b8a}
  .desglose b{color:#16202b;font-weight:600}

  .margen{background:#f7f9fb;border:1px solid #e4eaf0;border-radius:12px;padding:18px;margin-top:18px}
  .margen .lin{display:flex;justify-content:space-between;font-size:14px;padding:5px 0}
  .margen .lin.destaca{border-top:1px solid #e0e7ee;margin-top:7px;padding-top:11px;
                       font-weight:700;font-size:16px;color:#0a8f4a}

  .aviso{background:#fff8e6;border:1px solid #f0dca6;border-radius:11px;padding:15px 17px;
         font-size:13.5px;color:#6a4e00;margin-top:20px;line-height:1.55}
  .error{background:#fdecec;border:1.5px solid #f0b6b6;border-radius:11px;padding:18px;color:#8a1c1c;font-size:15px}

  .exito{background:linear-gradient(160deg,#f0fbf5,#e3f7ec);border:1.5px solid #b5e5cb;
         border-radius:14px;padding:30px;text-align:center;margin-bottom:22px}
  .exito .et{font-size:11.5px;text-transform:uppercase;letter-spacing:.09em;color:#1c8a58;font-weight:700}
  .exito .codigo{font-size:40px;font-weight:800;letter-spacing:5px;color:#0a5c33;
                 font-family:ui-monospace,SFMono-Regular,monospace;margin-top:8px}

  dl{display:grid;grid-template-columns:auto 1fr;gap:9px 22px;font-size:14.5px;margin-top:6px}
  dt{color:#6b7b8a} dd{font-weight:500;min-width:0;word-break:break-word}
  dd a{color:#0f2436}

  .acciones{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:24px}
  .acciones a{display:block;text-align:center;padding:14px;border-radius:11px;text-decoration:none;
              font-size:14.5px;font-weight:600;transition:.15s}
  .acciones a.crm{background:#0f2436;color:#fff}
  .acciones a.crm:hover{background:#1a3a55}
  .acciones a.track{background:#fff;color:#0f2436;border:1.5px solid #d8dfe6}
  .acciones a.track:hover{border-color:#0f2436}

  .nota{display:flex;gap:11px;align-items:flex-start;background:#f7f9fb;border-left:3px solid #0f2436;
        border-radius:0 9px 9px 0;padding:13px 15px;margin-top:22px;font-size:13.5px;color:#4a5b6a;line-height:1.55}
  .nota .quien{font-size:10px;font-weight:800;letter-spacing:.06em;padding:3px 8px;border-radius:5px;
               flex-shrink:0;margin-top:1px}
  .nota .quien.tmt{background:#0f2436;color:#fff}
  .nota .quien.socio{background:#d6a75d;color:#3d2c0a}

  details.http{background:#fbfcfd;border:1px solid #e2e8ee;border-radius:11px;margin-top:22px;font-size:13px}
  details.http summary{cursor:pointer;padding:13px 16px;display:flex;align-items:center;gap:10px;
                       font-weight:600;color:#4a5b6a;list-style:none;flex-wrap:wrap}
  details.http summary::-webkit-details-marker{display:none}
  .lupa{opacity:.5}
  details.http code{background:#eaeff4;padding:3px 8px;border-radius:5px;font-size:11.5px;font-weight:500}
  .status{font-size:10.5px;padding:3px 9px;border-radius:99px;font-weight:800;margin-left:auto}
  .status.ok{background:#d5f2e3;color:#0a5c33}
  .status.warn{background:#fdecc8;color:#7a5200}
  .status.err{background:#fbd9d9;color:#8a1c1c}
  .ms{font-size:11px;color:#93a1b0;font-weight:500}
  .par{display:grid;grid-template-columns:1fr 1fr;gap:14px;padding:0 16px 16px}
  .par h4{margin-bottom:7px;font-size:10.5px;text-transform:uppercase;color:#93a1b0;letter-spacing:.06em}
  pre{background:#0f2436;color:#dce6f0;padding:14px;border-radius:9px;overflow:auto;
      font-size:11.5px;line-height:1.55;max-height:320px}

  /* Pasarela de pago simulada */
  .checkout{background:#fff;border-radius:16px;padding:34px;box-shadow:0 2px 14px #0f24361a}
  .checkout .cab{display:flex;align-items:center;justify-content:space-between;
                 padding-bottom:18px;border-bottom:1px solid #eaeff4;margin-bottom:6px}
  .checkout .cab .m{font-size:12px;color:#93a1b0;letter-spacing:.05em;text-transform:uppercase;font-weight:700}
  .checkout .cab .v{font-size:26px;font-weight:800;letter-spacing:-.6px}
  .tarjeta{background:linear-gradient(135deg,#24405c,#0f2436);border-radius:14px;padding:22px;
           color:#fff;margin:20px 0 4px}
  .tarjeta .num{font-family:ui-monospace,monospace;font-size:19px;letter-spacing:2.5px;margin-bottom:16px}
  .tarjeta .pie{display:flex;justify-content:space-between;font-size:11.5px;opacity:.75}

  /* Overlay de "procesando pago" */
  #proc{position:fixed;inset:0;background:#0f2436f2;display:none;align-items:center;
        justify-content:center;flex-direction:column;gap:22px;z-index:99;color:#fff}
  #proc.on{display:flex}
  .spin{width:52px;height:52px;border:3.5px solid #ffffff33;border-top-color:#fff;
        border-radius:50%;animation:g .8s linear infinite}
  @keyframes g{to{transform:rotate(360deg)}}
  #proc p{font-size:17px;font-weight:600}
  #proc small{font-size:13px;opacity:.65}

  @media(max-width:720px){
    .fila,.fila3,.par,.acciones{grid-template-columns:1fr}
    .pasos li .t{display:none}
    .precio-box .total{font-size:36px}
  }
`;

const pagina = (titulo, paso, contenido, extra = '') => `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(titulo)}</title><style>${ESTILOS}</style></head><body>
<div class="top">
  <span class="marca">${esc(SOCIO_NOMBRE)}</span>
  <span class="sep">transporte al aeropuerto · operado por Transportes Medellín Travel</span>
  <span class="demo">demostración</span>
</div>
<div class="aviso-top">
  La pasarela de pago y la marca son simuladas. <strong>Las llamadas a TMT son reales</strong>:
  el precio sale del catálogo de producción y la reserva se crea de verdad en el sistema.
</div>
${barraPasos(paso)}
<div class="wrap">${contenido}</div>
${extra}
</body></html>`;

// ── Pantalla 1 · datos del huésped ───────────────────────────────────────────

function vistaFormulario(v = {}) {
    const val = (k, d = '') => esc(v[k] ?? d);
    const enUnaSemana = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
    return pagina(
        `Reserva tu traslado · ${SOCIO_NOMBRE}`,
        0,
        `<div class="card">
      <h1>Reserva tu traslado al aeropuerto</h1>
      <p class="sub">Esto es lo que vería el huésped dentro de la plataforma de ${esc(SOCIO_NOMBRE)}.</p>
      <form method="POST" action="/precio">
        <div class="fila">
          <div><label>Pasajeros</label>
            <input type="number" name="numeroPasajeros" min="1" max="40" value="${val('numeroPasajeros', '2')}" required></div>
          <div><label>Aeropuerto</label>
            <select name="aeropuertoNombre">
              <option value="JOSE_MARIA_CORDOVA">José María Córdova · JMC</option>
              <option value="OLAYA_HERRERA" ${v.aeropuertoNombre === 'OLAYA_HERRERA' ? 'selected' : ''}>Olaya Herrera</option>
            </select></div>
        </div>
        <div class="fila">
          <div><label>Fecha del vuelo</label>
            <input type="date" name="fecha" value="${val('fecha', enUnaSemana)}" required></div>
          <div><label>Hora</label>
            <input type="time" name="hora" value="${val('hora', '23:30')}" required></div>
        </div>
        <label>Tipo de traslado</label>
        <select name="aeropuertoTipo">
          <option value="DESDE">Llegada — del aeropuerto a mi alojamiento</option>
          <option value="HACIA" ${v.aeropuertoTipo === 'HACIA' ? 'selected' : ''}>Salida — de mi alojamiento al aeropuerto</option>
        </select>
        <label>Dirección del alojamiento</label>
        <input name="lugarRecogida" value="${val('lugarRecogida', 'Cra 43A #7-50, Apto 1204, El Poblado')}" required>
        <label>Número de vuelo</label>
        <input name="numeroVuelo" value="${val('numeroVuelo', 'AV8432')}">
        <div class="fila">
          <div><label>Nombre del huésped</label>
            <input name="nombreCliente" value="${val('nombreCliente', 'Demo Reunión')}" required></div>
          <div><label>WhatsApp (con indicativo)</label>
            <input name="whatsappCliente" value="${val('whatsappCliente', '+573001234567')}" required></div>
        </div>
        <label>Correo del huésped — aquí llega la confirmación de TMT</label>
        <input type="email" name="emailCliente" value="${val('emailCliente')}" placeholder="correo@ejemplo.com" required>
        <button type="submit">Consultar precio</button>
      </form>
      ${nota(
          SOCIO_NOMBRE,
          `${esc(SOCIO_NOMBRE)} captura los datos en su propia plataforma, con su marca y su diseño.
       TMT no aparece todavía: el huésped cree que está reservando con ${esc(SOCIO_NOMBRE)}, y así es.`
      )}
      <div class="aviso">
        <strong>Consultar el precio no crea nada.</strong> El paso de pago sí crea una reserva real,
        con correo al huésped y evento en el calendario de operación.
      </div>
    </div>`
    );
}

// ── Pantalla 2 · precio consultado a TMT ─────────────────────────────────────

async function vistaPrecio(f) {
    const peticion = {
        servicioId: SERVICIO_AEROPUERTO,
        numeroPasajeros: Number(f.numeroPasajeros),
        hora: f.hora,
        aeropuertoNombre: f.aeropuertoNombre,
    };
    const { status, datos, ms } = await llamarTMT('/api/socios/cotizar', peticion);
    const http = bloqueHttp('Consulta de precio a TMT', '/api/socios/cotizar', peticion, status, datos, ms);

    if (!datos.ok) {
        return pagina(
            'Sin disponibilidad',
            1,
            `<div class="card">
        <h2>No se pudo cotizar</h2>
        <p class="sub">TMT respondió con un error.</p>
        <div class="error"><strong>${esc(datos.error || 'Error desconocido')}</strong></div>
        ${nota(
            'TMT',
            status === 400
                ? 'Es un <strong>400</strong>: la petición tiene algo mal. La agencia corrige y reenvía; reintentar igual no sirve.'
                : status === 401
                  ? 'Es un <strong>401</strong>: la llave no es válida o el socio está desactivado.'
                  : 'Es un <strong>500</strong>: falla de TMT. Aquí la agencia sí debe reintentar.'
        )}
        ${http}
        <a class="volver" href="/">&larr; Cambiar los datos</a>
      </div>`
        );
    }

    const d = datos.desglose;

    return pagina(
        'Precio de tu traslado',
        1,
        `<div class="card">
      <h2>Tu traslado</h2>
      <p class="sub">${esc(datos.vehiculo.nombre)} · hasta ${datos.vehiculo.capacidadMaxima} pasajeros ·
        ${f.aeropuertoNombre === 'OLAYA_HERRERA' ? 'Olaya Herrera' : 'José María Córdova'}</p>

      <div class="precio-box">
        <div class="et">Precio del traslado</div>
        <div class="total">${cop(datos.total)}</div>
        <div class="veh">COP · vehículo completo, no por persona</div>
        <div class="desglose">
          <span>Tarifa base <b>${cop(d.precioBase)}</b></span>
          ${d.recargoNocturno > 0 ? `<span>Recargo nocturno <b>${cop(d.recargoNocturno)}</b></span>` : ''}
          ${d.precioAdicionales > 0 ? `<span>Adicionales <b>${cop(d.precioAdicionales)}</b></span>` : ''}
        </div>
      </div>

      <form method="POST" action="/pago">
        ${ocultos(f)}
        <button type="submit">Continuar al pago</button>
      </form>

      ${nota(
          'TMT',
          `El servidor de ${esc(SOCIO_NOMBRE)} nos consultó el precio y respondimos en <strong>${ms} ms</strong>.
       El precio sale del mismo catálogo que la web de TMT: si operaciones cambia una tarifa en el
       panel, ${esc(SOCIO_NOMBRE)} la ve al instante. No hay listas de precios que sincronizar.`
      )}
      ${http}
      <a class="volver" href="/">&larr; Cambiar los datos</a>
    </div>`
    );
}

// ── Pantalla 3 · pasarela de pago simulada (aquí no se llama a TMT) ─────────

function vistaPago(f, total) {
    return pagina(
        'Pago',
        2,
        `<div class="checkout">
      <div class="cab">
        <div>
          <div class="m">Total a pagar</div>
          <div class="v">${cop(total)} COP</div>
        </div>
        <div style="text-align:right">
          <div class="m">Comercio</div>
          <div style="font-weight:700;font-size:15px">${esc(SOCIO_NOMBRE)}</div>
        </div>
      </div>

      <div class="tarjeta">
        <div class="num">4242 4242 4242 4242</div>
        <div class="pie"><span>DEMO REUNIÓN</span><span>12/29</span></div>
      </div>

      <form method="POST" action="/confirmar" id="fpago">
        ${ocultos(f)}
        <div class="fila3">
          <div><label>Número de tarjeta</label><input value="4242 4242 4242 4242" readonly></div>
          <div><label>Vence</label><input value="12/29" readonly></div>
          <div><label>CVV</label><input value="123" readonly></div>
        </div>
        <button class="pagar" type="submit">Pagar ${cop(total)}</button>
      </form>

      ${nota(
          SOCIO_NOMBRE,
          `Esta pasarela es lo <strong>único simulado</strong> de la demo: en la vida real es la
       pasarela de ${esc(SOCIO_NOMBRE)}, con su propia cuenta. TMT no ve la tarjeta, no cobra
       nada aquí y no paga comisión de pasarela. El dinero entra directo a ${esc(SOCIO_NOMBRE)}.`
      )}
      ${nota(
          'TMT',
          `Todavía no sabemos nada de esta reserva. Solo cuando el pago le aprueba a
       ${esc(SOCIO_NOMBRE)}, su servidor nos la manda ya pagada.`
      )}
      <a class="volver" href="/">&larr; Cancelar</a>
    </div>`,
        `<div id="proc">
      <div class="spin"></div>
      <p>Procesando el pago…</p>
      <small>${esc(SOCIO_NOMBRE)} cobra al huésped y luego registra la reserva en TMT</small>
    </div>
    <script>
      document.getElementById('fpago').addEventListener('submit', function (e) {
        e.preventDefault();
        document.getElementById('proc').classList.add('on');
        setTimeout(function () { e.target.submit(); }, 1600);
      });
    </script>`
    );
}

// ── Pantalla 4 · la reserva queda creada en TMT ─────────────────────────────

async function vistaConfirmacion(f) {
    // refExterna: el id que la reserva tiene del lado de la agencia. Único y estable por
    // reserva — es lo que hace que un reintento no cree un segundo traslado.
    const refExterna = f.refExterna || `${SOCIO_NOMBRE.toLowerCase()}-${Date.now()}`;
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
        notas: 'Reserva creada en la demostración de la integración',
    };

    const { status, datos, ms } = await llamarTMT('/api/socios/reservas', peticion);
    const http = bloqueHttp('Registro de la reserva en TMT', '/api/socios/reservas', peticion, status, datos, ms);

    if (!datos.ok) {
        return pagina(
            'No se pudo confirmar',
            2,
            `<div class="card">
        <h2>La reserva no se creó</h2>
        <div class="error"><strong>${esc(datos.error || 'Error desconocido')}</strong></div>
        ${nota(
            'TMT',
            status >= 500
                ? `Es un <strong>500</strong>: falla nuestra. ${esc(SOCIO_NOMBRE)} debe
           <strong>reintentar con la misma refExterna</strong> — la idempotencia hace que sea
           seguro y no se duplica el traslado. Es justamente el caso en que la agencia ya le
           cobró al huésped y no puede perder la reserva.`
                : `Es un <strong>400</strong>: la petición tiene algo mal. Corregir y reenviar;
           reintentar igual no sirve.`
        )}
        ${http}
        <a class="volver" href="/">&larr; Volver</a>
      </div>`
        );
    }

    return pagina(
        '¡Traslado confirmado!',
        3,
        `<div class="card">
      <div class="exito">
        <div class="et">${datos.duplicado ? 'Ya existía · no se duplicó' : 'Traslado confirmado'}</div>
        <div class="codigo">${esc(datos.codigo)}</div>
      </div>

      <dl>
        <dt>Estado en TMT</dt>
        <dd>${esc(datos.estado)}<br><span style="color:#6b7b8a;font-weight:400;font-size:13px">
          confirmada y en la cola de asignación de conductor</span></dd>
        <dt>Servicio</dt><dd>${esc(datos.fecha)} a las ${esc(datos.hora)} · ${esc(datos.vehiculo)} · ${esc(datos.numeroPasajeros)} pasajeros</dd>
        <dt>Huésped</dt><dd>${esc(f.nombreCliente)} · ${esc(f.emailCliente)}</dd>
        <dt>Precio</dt><dd>${cop(datos.total)} COP</dd>
        <dt>Referencia de ${esc(SOCIO_NOMBRE)}</dt><dd><code>${esc(refExterna)}</code></dd>
      </dl>

      <div class="acciones">
        <a class="crm" href="${esc(API_URL)}/admin/dashboard/reservas" target="_blank">Ver en el CRM de TMT &rarr;</a>
        <a class="track" href="${esc(datos.tracking)}" target="_blank">Lo que ve el huésped &rarr;</a>
      </div>

      <div class="aviso">
        <strong>Compruébalo en vivo.</strong> Entra al CRM y busca <code>${esc(datos.codigo)}</code>:
        aparece con la etiqueta <strong>${esc(SOCIO_NOMBRE.toLowerCase())}</strong> en la columna
        “Aliado / Socio” y marcada como <strong>“No paga”</strong> — el huésped ya pagó, el conductor
        no le cobra nada. También quedó el evento en Google Calendar y le llegó el correo de
        confirmación a ${esc(f.emailCliente)}.
      </div>

      ${nota(
          'TMT',
          `Nos llegó y quedó registrada en <strong>${ms} ms</strong>. Desde aquí la reserva es
       igual a cualquier otra: se le asigna conductor, cambia de estado, sale en el calendario
       y en las estadísticas. Lo único distinto es que nadie le cobra al huésped.`
      )}

      <form method="POST" action="/confirmar">
        ${ocultos({ ...f, refExterna })}
        <button class="gris" type="submit">Reenviar la misma reserva (probar que no se duplica)</button>
      </form>
      <p style="text-align:center;color:#6b7b8a;font-size:12.5px;margin-top:9px">
        Simula un timeout de red: ${esc(SOCIO_NOMBRE)} reintenta y TMT devuelve la misma reserva,
        no una segunda.
      </p>

      ${http}
      <a class="volver" href="/">&larr; Empezar otra demostración</a>
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

        if (req.method === 'POST' && req.url === '/precio') {
            return responder(await vistaPrecio(await leerFormulario(req)));
        }

        if (req.method === 'POST' && req.url === '/pago') {
            // Se recotiza para que la pasarela muestre el precio vigente, no uno que
            // viajó por el formulario y pudo manipularse.
            const f = await leerFormulario(req);
            const { datos } = await llamarTMT('/api/socios/cotizar', {
                servicioId: SERVICIO_AEROPUERTO,
                numeroPasajeros: Number(f.numeroPasajeros),
                hora: f.hora,
                aeropuertoNombre: f.aeropuertoNombre,
            });
            if (!datos.ok) return responder(await vistaPrecio(f));
            return responder(vistaPago(f, datos.total));
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
                'Error de la demostración',
                0,
                `<div class="card"><h2>Error en el simulador</h2>
         <div class="error">${esc(e.message)}</div>
         <p class="sub" style="margin-top:14px">Es un fallo de este script de demostración, no de la API de TMT.</p>
         <a class="volver" href="/">&larr; Volver</a></div>`
            )
        );
    }
}).listen(PORT, () => {
    console.log(`\n  Demostración de la integración con ${SOCIO_NOMBRE}\n`);
    console.log(`    →  http://localhost:${PORT}\n`);
    console.log(`  API:   ${API_URL}`);
    console.log(`  Llave: …${API_KEY.slice(-6)}\n`);
    console.log(`  Pagar en la demo CREA una reserva real (correo + calendario + CRM).`);
    console.log(`  Ctrl+C para salir.\n`);
});
