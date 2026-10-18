// Herramienta auxiliar de verificación. La práctica manual solo usa los seis programas principales.
const { spawn } = require('node:child_process');
const net = require('node:net');
const dgram = require('node:dgram');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const RAIZ = path.resolve(__dirname, '..');
const SALIDA = path.join(RAIZ, 'evidencias');
fs.mkdirSync(SALIDA, { recursive: true });
const procesos = [];
const capturas = [];
const verificaciones = [];
const pausa = (ms) => new Promise((resolver) => setTimeout(resolver, ms));

function iniciar(archivo, nombre, args = []) {
  const hijo = spawn(process.execPath, [path.join(RAIZ, archivo), ...args], {
    cwd: RAIZ, env: process.env, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'],
  });
  const registro = { nombre, archivo, comando: ('node ' + archivo + ' ' + args.join(' ')).trim(),
    pid: hijo.pid, salida: '', hijo, terminado: false };
  hijo.stdout.setEncoding('utf8');
  hijo.stderr.setEncoding('utf8');
  hijo.stdout.on('data', (datos) => registro.salida += datos);
  hijo.stderr.on('data', (datos) => registro.salida += datos);
  registro.fin = new Promise((resolver) => hijo.on('close', (codigo) => {
    registro.terminado = true;
    registro.codigo = codigo;
    resolver(codigo);
  }));
  procesos.push(registro);
  return registro;
}

async function esperar(registro, texto, limite = 5000) {
  const inicio = Date.now();
  while (!registro.salida.includes(texto)) {
    if (registro.terminado || Date.now() - inicio > limite) {
      throw new Error(registro.nombre + ': no se observó "' + texto + '".\n' + registro.salida);
    }
    await pausa(15);
  }
}

function enviar(registro, mensaje) {
  registro.hijo.stdin.write(mensaje + '\n');
}

function resumen(registro) {
  return { nombre: registro.nombre, archivo: registro.archivo, comando: registro.comando,
    pid: registro.pid, salida: registro.salida };
}

function captura(archivo, titulo, registros, descripcion) {
  capturas.push({ archivo, titulo, descripcion, procesos: registros.map(resumen) });
}

function comprobar(nombre, observado, esperado) {
  assert.deepEqual(observado, esperado, nombre);
  verificaciones.push({ nombre, esperado, observado, resultado: 'CORRECTO' });
  console.log('OK: ' + nombre);
}

async function finalizarCliente(registro) {
  enviar(registro, 'salir');
  let alarma;
  const limite = new Promise((_, rechazar) => {
    alarma = setTimeout(() => rechazar(new Error('El cliente no terminó.')), 5000);
  });
  const codigo = await Promise.race([registro.fin, limite]);
  clearTimeout(alarma);
  comprobar(registro.nombre + ': termina con salir', codigo, 0);
}

async function pruebaTCP() {
  const servidor = iniciar('tcp_server.js', 'Servidor TCP');
  await esperar(servidor, 'Servidor TCP escuchando');
  const cliente1 = iniciar('tcp_cliente.js', 'Cliente TCP 1');
  await esperar(cliente1, 'Cliente TCP conectado');
  enviar(cliente1, 'hola servidor');
  await esperar(cliente1, '[SERVIDOR] HOLA SERVIDOR');
  comprobar('TCP: devuelve el mensaje en mayúsculas', cliente1.salida.includes('[SERVIDOR] HOLA SERVIDOR'), true);
  captura('01_tcp_un_cliente', 'TCP: comunicación con un cliente',
    [servidor, cliente1], 'El cliente envía hola servidor y recibe HOLA SERVIDOR.');

  const cliente2 = iniciar('tcp_cliente.js', 'Cliente TCP 2');
  await esperar(cliente2, 'Cliente TCP conectado');
  await esperar(servidor, 'Clientes activos: 2');
  enviar(cliente2, 'segundo cliente');
  enviar(cliente1, 'área de redes');
  await esperar(cliente2, '[SERVIDOR] SEGUNDO CLIENTE');
  await esperar(cliente1, '[SERVIDOR] ÁREA DE REDES');
  comprobar('TCP: dos clientes reciben sus respuestas',
    [cliente1.salida.includes('ÁREA DE REDES'), cliente2.salida.includes('SEGUNDO CLIENTE')], [true, true]);
  captura('02_tcp_dos_clientes', 'TCP: dos clientes simultáneos',
    [servidor, cliente1, cliente2], 'El servidor mantiene dos sockets activos y responde a cada origen.');

  await finalizarCliente(cliente1);
  enviar(cliente2, 'seguimos conectados');
  await esperar(cliente2, '[SERVIDOR] SEGUIMOS CONECTADOS');
  comprobar('TCP: salir solo cierra al cliente que lo solicita', cliente2.salida.includes('SEGUIMOS CONECTADOS'), true);
  captura('03_tcp_salir', 'TCP: cierre de un cliente',
    [servidor, cliente1, cliente2], 'El cliente 1 termina; el cliente 2 sigue intercambiando mensajes.');
  await finalizarCliente(cliente2);

  const puerto = Number(process.env.SOCKETS_TCP_PORT || 12345);
  const fragmentado = await new Promise((resolver, rechazar) => {
    const socket = net.createConnection({ host: '127.0.0.1', port: puerto });
    const datos = Buffer.from('café\nmúltiples líneas\n', 'utf8');
    let recibido = '';
    socket.setEncoding('utf8');
    const alarma = setTimeout(() => { socket.destroy(); rechazar(new Error('TCP fragmentado: tiempo agotado.')); }, 3000);
    socket.on('connect', async () => {
      socket.write(datos.subarray(0, 4));
      await pausa(30);
      socket.write(datos.subarray(4));
    });
    socket.on('data', (texto) => {
      recibido += texto;
      if (recibido.includes('MÚLTIPLES LÍNEAS\n') && !socket.writableEnded) socket.end('salir\n');
    });
    socket.on('close', () => { clearTimeout(alarma); resolver(recibido); });
    socket.on('error', rechazar);
  });
  comprobar('TCP: conserva tildes y separa mensajes fragmentados',
    [fragmentado.includes('CAFÉ\n'), fragmentado.includes('MÚLTIPLES LÍNEAS\n')], [true, true]);
}

async function pruebaUDP() {
  const servidor = iniciar('udp_server.js', 'Servidor UDP');
  await esperar(servidor, 'Servidor UDP escuchando');
  const cliente1 = iniciar('udp_cliente.js', 'Cliente UDP 1');
  await esperar(cliente1, 'Cliente UDP listo');
  enviar(cliente1, 'hola desde udp');
  await esperar(cliente1, 'Numero de palabras: 3');
  comprobar('UDP: cuenta tres palabras en hola desde udp', cliente1.salida.includes('Numero de palabras: 3'), true);
  captura('04_udp_un_cliente', 'UDP: envío y respuesta de un datagrama',
    [servidor, cliente1], 'El servidor registra la IP y el puerto del origen y devuelve el conteo.');

  const cliente2 = iniciar('udp_cliente.js', 'Cliente UDP 2');
  await esperar(cliente2, 'Cliente UDP listo');
  enviar(cliente2, '   aplicaciones   distribuidas con sockets  ');
  await esperar(cliente2, 'Numero de palabras: 4');
  enviar(cliente1, '');
  await esperar(cliente1, 'Numero de palabras: 0');
  const puerto1 = cliente1.salida.match(/Cliente UDP listo en 127\.0\.0\.1:(\d+)/)[1];
  const puerto2 = cliente2.salida.match(/Cliente UDP listo en 127\.0\.0\.1:(\d+)/)[1];
  comprobar('UDP: los clientes tienen puertos de origen distintos', puerto1 !== puerto2, true);
  comprobar('UDP: ignora espacios adicionales', cliente2.salida.includes('Numero de palabras: 4'), true);
  comprobar('UDP: un mensaje vacío tiene cero palabras', cliente1.salida.includes('Numero de palabras: 0'), true);
  captura('05_udp_dos_clientes', 'UDP: dos clientes con puertos independientes',
    [servidor, cliente1, cliente2], 'Cada respuesta vuelve al cliente que envió el datagrama.');

  const puerto = Number(process.env.SOCKETS_UDP_PORT || 12346);
  const control = dgram.createSocket('udp4');
  let respuestas = 0;
  control.on('message', () => respuestas++);
  await new Promise((resolver) => control.bind(0, '127.0.0.1', resolver));
  await new Promise((resolver, rechazar) => control.send('salir', puerto, '127.0.0.1', (error) => error ? rechazar(error) : resolver()));
  await pausa(300);
  comprobar('UDP: salir no produce respuesta en 300 ms de observación', respuestas, 0);
  const posterior = new Promise((resolver, rechazar) => {
    const alarma = setTimeout(() => rechazar(new Error('UDP dejó de responder.')), 3000);
    control.once('message', (datos) => { clearTimeout(alarma); resolver(datos.toString('utf8')); });
  });
  control.send('el servidor sigue activo', puerto, '127.0.0.1');
  comprobar('UDP: el servidor sigue atendiendo después de salir', await posterior, 'Numero de palabras: 4');
  control.close();
  await finalizarCliente(cliente1);
  await finalizarCliente(cliente2);
  captura('06_udp_salir', 'UDP: salida del cliente y continuidad del servidor',
    [servidor, cliente1, cliente2], 'Los clientes envían salir y cierran sus sockets sin esperar respuesta.');
}

async function pruebaChat() {
  const servidor = iniciar('chat_server.js', 'Servidor CHAT');
  await esperar(servidor, 'Servidor CHAT escuchando');
  const ana = iniciar('chat_cliente.js', 'Cliente Ana', ['Ana']);
  await esperar(ana, '[SISTEMA] Bienvenido, Ana.');
  const luis = iniciar('chat_cliente.js', 'Cliente Luis', ['Luis']);
  await esperar(luis, '[SISTEMA] Bienvenido, Luis.');
  await esperar(servidor, 'Usuarios: 2');
  enviar(ana, 'Hola Luis');
  await esperar(luis, '[Ana] Hola Luis');
  enviar(luis, 'Hola Ana');
  await esperar(ana, '[Luis] Hola Ana');
  comprobar('Chat: identifica el socket por el primer mensaje',
    [servidor.salida.includes('[CONEXION] Ana'), servidor.salida.includes('[CONEXION] Luis')], [true, true]);
  comprobar('Chat: hay comunicación en ambos sentidos',
    [luis.salida.includes('[Ana] Hola Luis'), ana.salida.includes('[Luis] Hola Ana')], [true, true]);
  comprobar('Chat: el emisor muestra su mensaje con [YO]',
    [ana.salida.includes('[YO] Hola Luis'), luis.salida.includes('[YO] Hola Ana')], [true, true]);
  comprobar('Chat: broadcast excluye al emisor',
    [ana.salida.includes('[Ana] Hola Luis'), luis.salida.includes('[Luis] Hola Ana')], [false, false]);
  captura('07_chat_dos_usuarios', 'Chat TCP: servidor y dos clientes identificados',
    [servidor, ana, luis], 'Ana y Luis intercambian mensajes. Cada receptor ve el nombre del emisor; el propio envío lleva [YO].');

  await finalizarCliente(ana);
  await esperar(luis, '[SISTEMA] Ana salio.');
  enviar(luis, 'sigo en el chat');
  await esperar(servidor, '[MENSAJE] Luis: sigo en el chat');
  comprobar('Chat: la salida de Ana no desconecta a Luis', luis.terminado, false);
  captura('08_chat_salir', 'Chat TCP: desconexión de un usuario',
    [servidor, ana, luis], 'El servidor elimina el socket de Ana del Map y continúa atendiendo a Luis.');
  await finalizarCliente(luis);
}

async function principal() {
  let error = null;
  try {
    await pruebaTCP();
    await pruebaUDP();
    await pruebaChat();
  } catch (fallo) {
    error = fallo.stack || String(fallo);
    console.error(error);
    process.exitCode = 1;
  } finally {
    for (const registro of procesos) {
      if (!registro.terminado) registro.hijo.kill();
    }
    await Promise.all(procesos.map((registro) => registro.fin));
    for (const registro of procesos) {
      const nombre = registro.nombre.toLowerCase().replace(/\s+/g, '_') + '.txt';
      fs.writeFileSync(path.join(SALIDA, nombre), registro.salida, 'utf8');
    }
    const reporte = { fecha_utc: new Date().toISOString(), node: process.version,
      estado: error ? 'ERROR' : 'CORRECTO', error, verificaciones, capturas };
    fs.writeFileSync(path.join(SALIDA, 'resultados.json'), JSON.stringify(reporte, null, 2), 'utf8');
    console.log('\nResultado: ' + reporte.estado + '. Verificaciones: ' + verificaciones.length + '.');
    console.log('Registros guardados en ' + SALIDA);
  }
}

principal();
