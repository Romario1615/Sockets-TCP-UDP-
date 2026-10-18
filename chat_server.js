// Actividad adicional. Chat TCP con Map<socket, nombre> y broadcast.
const net = require('node:net');

const HOST = '127.0.0.1';
const PUERTO = Number(process.env.SOCKETS_CHAT_PORT || 12347);
const clientes = new Map();

function broadcast(mensaje, emisor) {
  for (const [socket] of clientes) {
    if (socket !== emisor && !socket.destroyed && socket.writable) socket.write(mensaje + '\n');
  }
}

const servidor = net.createServer((socket) => {
  socket.setEncoding('utf8');
  let pendiente = '';
  let saliendo = false;

  socket.on('data', (datos) => {
    pendiente += datos;
    const mensajes = pendiente.split('\n');
    pendiente = mensajes.pop();
    for (const linea of mensajes) {
      if (saliendo) return;
      const mensaje = linea.replace(/\r$/, '');

      // El primer mensaje identifica al usuario de este socket.
      if (!clientes.has(socket)) {
        const nombre = mensaje.trim();
        if (nombre === '') {
          saliendo = true;
          socket.end('[SISTEMA] El nombre no puede estar vacio.\n');
          return;
        }
        clientes.set(socket, nombre);
        console.log(`[CONEXION] ${nombre} (${socket.remoteAddress}:${socket.remotePort}). Usuarios: ${clientes.size}`);
        socket.write(`[SISTEMA] Bienvenido, ${nombre}.\n`);
        broadcast(`[SISTEMA] ${nombre} se conecto.`, socket);
        continue;
      }

      const nombre = clientes.get(socket);
      if (mensaje.trim() === 'salir') {
        saliendo = true;
        socket.end('[SISTEMA] Hasta luego.\n');
        return;
      }
      console.log(`[MENSAJE] ${nombre}: ${mensaje}`);
      broadcast(`[${nombre}] ${mensaje}`, socket);
    }
  });

  socket.on('close', () => {
    const nombre = clientes.get(socket);
    clientes.delete(socket);
    if (nombre) {
      console.log(`[CIERRE] ${nombre}. Usuarios: ${clientes.size}`);
      broadcast(`[SISTEMA] ${nombre} salio.`, socket);
    }
  });
  socket.on('error', (error) => console.error(`[ERROR CHAT CLIENTE] ${error.message}`));
});

servidor.on('error', (error) => {
  console.error(`[ERROR SERVIDOR CHAT] ${error.message}`);
  process.exitCode = 1;
});
servidor.listen(PUERTO, HOST, () => {
  console.log(`Servidor CHAT escuchando en ${HOST}:${servidor.address().port}`);
});
