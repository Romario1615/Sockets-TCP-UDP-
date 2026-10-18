// Parte 1. Servidor TCP: responde en mayúsculas y atiende varios clientes.
const net = require('node:net');

const HOST = '127.0.0.1';
const PUERTO = Number(process.env.SOCKETS_TCP_PORT || 12345);
const clientes = new Set();

const servidor = net.createServer((socket) => {
  clientes.add(socket);
  const direccion = `${socket.remoteAddress}:${socket.remotePort}`;
  console.log(`[CONEXION] ${direccion}. Clientes activos: ${clientes.size}`);
  socket.setEncoding('utf8');
  let pendiente = '';
  let saliendo = false;

  socket.on('data', (datos) => {
    // TCP transporta un flujo: un envío puede llegar en varios fragmentos.
    // En esta práctica cada mensaje termina con un salto de línea (\n).
    pendiente += datos;
    const mensajes = pendiente.split('\n');
    pendiente = mensajes.pop();

    for (const linea of mensajes) {
      if (saliendo) return;
      const mensaje = linea.replace(/\r$/, '');
      console.log(`[RECIBIDO ${direccion}] ${mensaje}`);
      if (mensaje.trim() === 'salir') {
        saliendo = true;
        socket.end('Conexion TCP cerrada.\n');
        return;
      }
      const respuesta = mensaje.toUpperCase();
      socket.write(respuesta + '\n');
      console.log(`[RESPUESTA ${direccion}] ${respuesta}`);
    }
  });

  socket.on('close', () => {
    clientes.delete(socket);
    console.log(`[CIERRE] ${direccion}. Clientes activos: ${clientes.size}`);
  });
  socket.on('error', (error) => console.error(`[ERROR CLIENTE] ${error.message}`));
});

servidor.on('error', (error) => {
  console.error(`[ERROR SERVIDOR TCP] ${error.message}`);
  process.exitCode = 1;
});
servidor.listen(PUERTO, HOST, () => {
  console.log(`Servidor TCP escuchando en ${HOST}:${servidor.address().port}`);
});
