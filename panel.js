// Panel visual auxiliar. Los seis programas principales conservan los sockets
// net/dgram de la guía; este panel escribe en sus consolas y muestra su salida real.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const HOST = '127.0.0.1';
const PUERTO_PANEL = Number(process.env.SOCKETS_PANEL_PORT || 8787);
const RAIZ = __dirname;
const integrantes = JSON.parse(fs.readFileSync(path.join(RAIZ, 'integrantes.json'), 'utf8'));
const definiciones = {
  tcp: { puerto: Number(process.env.SOCKETS_TCP_PORT || 12345), servidor: 'tcp_server.js', cliente: 'tcp_cliente.js' },
  udp: { puerto: Number(process.env.SOCKETS_UDP_PORT || 12346), servidor: 'udp_server.js', cliente: 'udp_cliente.js' },
  chat: { puerto: Number(process.env.SOCKETS_CHAT_PORT || 12347), servidor: 'chat_server.js', cliente: 'chat_cliente.js' },
};
const grupos = Object.fromEntries(Object.keys(definiciones).map((modo) => [modo, { servidor: null, clientes: [null, null] }]));
const archivosCodigo = Object.values(definiciones).flatMap((d) => [d.servidor, d.cliente]);
const procesosPropios = new Set();
const pausa = (ms) => new Promise((resolver) => setTimeout(resolver, ms));

function iniciarProceso(archivo, nombre, args = []) {
  const hijo = spawn(process.execPath, [path.join(RAIZ, archivo), ...args], {
    cwd: RAIZ, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'], env: process.env,
  });
  procesosPropios.add(hijo);
  const registro = { hijo, archivo, nombre, pid: hijo.pid, estado: 'iniciando', log: '', listo: false, codigo: null };
  const agregar = (datos) => {
    registro.log = (registro.log + datos).slice(-40000);
    if (/escuchando en|Cliente TCP conectado|Cliente UDP listo|Cliente CHAT conectado/.test(registro.log)) {
      registro.listo = true;
      registro.estado = 'activo';
    }
  };
  hijo.stdout.setEncoding('utf8');
  hijo.stderr.setEncoding('utf8');
  hijo.stdout.on('data', agregar);
  hijo.stderr.on('data', agregar);
  hijo.stdin.on('error', (error) => agregar('\n[ERROR ENTRADA] ' + error.message + '\n'));
  hijo.on('error', (error) => {
    agregar('[ERROR PROCESO] ' + error.message + '\n');
    registro.estado = 'error';
    registro.listo = false;
  });
  hijo.on('close', (codigo) => {
    procesosPropios.delete(hijo);
    registro.codigo = codigo;
    registro.estado = codigo && codigo !== 0 ? 'error' : 'detenido';
    registro.listo = false;
  });
  return registro;
}

function serializar(registro) {
  if (!registro) return { estado: 'detenido', listo: false, log: '', pid: null };
  const { archivo, nombre, pid, estado, listo, codigo, log } = registro;
  return { archivo, nombre, pid, estado, listo, codigo, log };
}

function estado() {
  return { integrantes, direccion: HOST, modos: Object.fromEntries(Object.entries(grupos).map(([modo, grupo]) =>
    [modo, { puerto: definiciones[modo].puerto, servidor: serializar(grupo.servidor), clientes: grupo.clientes.map(serializar) }])) };
}

function vivo(registro) {
  return registro && registro.hijo.exitCode === null && registro.hijo.signalCode === null && !registro.hijo.killed;
}

async function escribir(registro, mensaje) {
  if (!vivo(registro) || !registro.listo || registro.hijo.stdin.destroyed) {
    throw new Error('El cliente todavía no está conectado.');
  }
  await new Promise((resolver, rechazar) => registro.hijo.stdin.write(mensaje + '\n', (error) => error ? rechazar(error) : resolver()));
}

async function detener(grupo) {
  for (const cliente of grupo.clientes) {
    if (vivo(cliente) && cliente.listo) {
      try { await escribir(cliente, 'salir'); } catch (_) { /* El proceso puede haber terminado al cerrar la conexión. */ }
    }
  }
  await pausa(180);
  for (const registro of [...grupo.clientes, grupo.servidor]) {
    if (vivo(registro)) registro.hijo.kill();
  }
}

function responder(res, codigo, contenido, tipo = 'application/json; charset=utf-8') {
  const cuerpo = Buffer.isBuffer(contenido) ? contenido : Buffer.from(contenido, 'utf8');
  res.writeHead(codigo, { 'Content-Type': tipo, 'Content-Length': cuerpo.length, 'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'" });
  res.end(cuerpo);
}

function json(res, codigo, value) { responder(res, codigo, JSON.stringify(value)); }

async function leerJSON(req) {
  if (!String(req.headers['content-type'] || '').startsWith('application/json')) throw new Error('Se requiere una solicitud JSON.');
  const partes = [];
  let longitud = 0;
  for await (const parte of req) {
    longitud += parte.length;
    if (longitud > 4096) throw new Error('La solicitud es demasiado grande.');
    partes.push(parte);
  }
  const valor = JSON.parse(Buffer.concat(partes).toString('utf8') || '{}');
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) throw new Error('Solicitud no válida.');
  return valor;
}

const servidor = http.createServer(async (req, res) => {
  const puerto = servidor.address().port;
  const hosts = new Set([HOST + ':' + puerto, 'localhost:' + puerto]);
  if (!hosts.has(req.headers.host) || (req.headers.origin && !hosts.has(req.headers.origin.replace('http://', '')))) {
    json(res, 403, { error: 'El laboratorio solo admite solicitudes locales.' });
    return;
  }
  const url = new URL(req.url, 'http://' + HOST + ':' + puerto);
  try {
    if (req.method === 'GET' && url.pathname === '/api/estado') return json(res, 200, estado());
    if (req.method === 'GET' && url.pathname === '/api/codigo') {
      const archivo = url.searchParams.get('archivo');
      if (!archivosCodigo.includes(archivo)) return json(res, 404, { error: 'Archivo no disponible.' });
      return json(res, 200, { archivo, codigo: fs.readFileSync(path.join(RAIZ, archivo), 'utf8') });
    }
    const materiales = { '/material/guia': 'Guia_original.pdf', '/material/1': 'Tema_01.pdf',
      '/material/2': 'Tema_02.pdf', '/material/3': 'Tema_03.pdf' };
    if (req.method === 'GET' && Object.prototype.hasOwnProperty.call(materiales, url.pathname)) {
      return responder(res, 200, fs.readFileSync(path.join(RAIZ, 'material', materiales[url.pathname])), 'application/pdf');
    }
    const estaticos = { '/': ['index.html', 'text/html; charset=utf-8'],
      '/interfaz.js': ['interfaz.js', 'text/javascript; charset=utf-8'], '/estilos.css': ['estilos.css', 'text/css; charset=utf-8'],
      '/espe.png': ['espe.png', 'image/png'] };
    if (req.method === 'GET' && estaticos[url.pathname]) {
      const [archivo, tipo] = estaticos[url.pathname];
      return responder(res, 200, fs.readFileSync(path.join(RAIZ, 'web', archivo)), tipo);
    }
    if (req.method !== 'POST' || !['/api/iniciar', '/api/conectar', '/api/enviar', '/api/salir', '/api/detener'].includes(url.pathname)) {
      return json(res, 404, { error: 'Recurso no encontrado.' });
    }
    const datos = await leerJSON(req);
    if (!Object.prototype.hasOwnProperty.call(definiciones, datos.modo)) throw new Error('Selecciona TCP, UDP o chat.');
    const grupo = grupos[datos.modo], definicion = definiciones[datos.modo];
    if (url.pathname === '/api/iniciar') {
      if (!vivo(grupo.servidor)) grupo.servidor = iniciarProceso(definicion.servidor, 'Servidor ' + datos.modo.toUpperCase());
    } else if (url.pathname === '/api/detener') {
      await detener(grupo);
    } else {
      if (datos.cliente !== 1 && datos.cliente !== 2) throw new Error('Cliente no válido.');
      const indice = datos.cliente - 1;
      if (url.pathname === '/api/conectar') {
        if (!grupo.servidor || !grupo.servidor.listo || !vivo(grupo.servidor)) throw new Error('Inicia primero el servidor.');
        if (!vivo(grupo.clientes[indice])) {
          const nombre = typeof datos.nombre === 'string' ? datos.nombre.trim() : 'Usuario ' + datos.cliente;
          if (datos.modo === 'chat' && (!nombre || nombre.length > 40 || /[\r\n]/.test(nombre))) throw new Error('Usa un nombre de 1 a 40 caracteres.');
          grupo.clientes[indice] = iniciarProceso(definicion.cliente, nombre, datos.modo === 'chat' ? [nombre] : []);
        }
      } else if (url.pathname === '/api/salir') {
        await escribir(grupo.clientes[indice], 'salir');
      } else {
        if (typeof datos.mensaje !== 'string' || datos.mensaje.length > 1000 || /[\r\n]/.test(datos.mensaje)) throw new Error('Envía una sola línea de hasta 1000 caracteres.');
        await escribir(grupo.clientes[indice], datos.mensaje);
      }
    }
    json(res, 200, estado());
  } catch (error) {
    if (!res.headersSent) json(res, 400, { error: error.message });
  }
});

function cerrar() {
  for (const hijo of procesosPropios) hijo.kill();
  servidor.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1500).unref();
}
process.on('SIGINT', cerrar);
process.on('SIGTERM', cerrar);
process.on('exit', () => { for (const hijo of procesosPropios) hijo.kill(); });
servidor.on('error', (error) => {
  console.error('No se pudo abrir el panel: ' + error.message);
  process.exitCode = 1;
});
servidor.listen(PUERTO_PANEL, HOST, () => {
  const direccion = 'http://' + HOST + ':' + servidor.address().port;
  console.log('Laboratorio de sockets: ' + direccion);
  console.log('Pulsa Ctrl+C para cerrar el panel y sus procesos.');
  if (!process.argv.includes('--no-browser') && process.platform === 'win32') {
    spawn('cmd.exe', ['/c', 'start', '', direccion], { windowsHide: true, stdio: 'ignore' }).on('error', () => {});
  }
});
