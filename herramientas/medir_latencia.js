// Herramienta auxiliar: mide el tiempo de ida y vuelta (RTT) de los servidores de la práctica.
// Uso: node herramientas/medir_latencia.js  (usa puertos propios; no interfiere con el panel)
const net = require('node:net');
const dgram = require('node:dgram');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const RAIZ = path.join(__dirname, '..');
const PT = 22345, PU = 22346, N = 300;
const env = { ...process.env, SOCKETS_TCP_PORT: String(PT), SOCKETS_UDP_PORT: String(PU) };
const hijos = ['tcp_server.js', 'udp_server.js'].map((f) => spawn(process.execPath, [path.join(RAIZ, f)], { env, stdio: 'ignore' }));
const ns = () => Number(process.hrtime.bigint()) / 1e6;
const stats = (v) => {
  const s = [...v].sort((a, b) => a - b);
  const q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  return { muestras: s.length, media_ms: +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(3), mediana_ms: +q(0.5).toFixed(3), p95_ms: +q(0.95).toFixed(3), min_ms: +s[0].toFixed(3), max_ms: +s[s.length - 1].toFixed(3) };
};

function tcp() {
  return new Promise((resolve) => {
    const rtt = []; let i = 0, t0;
    const c = net.createConnection({ host: '127.0.0.1', port: PT });
    c.setEncoding('utf8'); c.setNoDelay(true);
    const enviar = () => { t0 = ns(); c.write('mensaje de prueba ' + i + '\n'); };
    c.on('connect', enviar);
    c.on('data', () => { if (i >= N) return; rtt.push(ns() - t0); if (++i < N) enviar(); else { c.end('salir\n'); resolve(rtt); } });
  });
}
function udp() {
  return new Promise((resolve) => {
    const rtt = []; let i = 0, t0;
    const s = dgram.createSocket('udp4');
    const enviar = () => { t0 = ns(); s.send('mensaje de prueba ' + i, PU, '127.0.0.1'); };
    s.on('message', () => { rtt.push(ns() - t0); if (++i < N) enviar(); else { s.close(); resolve(rtt); } });
    s.bind(0, '127.0.0.1', enviar);
  });
}
(async () => {
  await new Promise((r) => setTimeout(r, 800));
  await tcp(); await udp(); // calentamiento
  const rt = await tcp(); const ru = await udp();
  const salida = { fecha_utc: new Date().toISOString(), node: process.version, viajes_por_prueba: N, tcp: stats(rt), udp: stats(ru), tcp_rtt: rt, udp_rtt: ru };
  fs.writeFileSync(path.join(RAIZ, 'evidencias', 'latencia.json'), JSON.stringify(salida));
  console.log('TCP', salida.tcp); console.log('UDP', salida.udp);
  hijos.forEach((h) => h.kill());
  process.exit(0);
})();
