// Parte 4. Cliente UDP: envía datagramas y muestra el conteo recibido.
const dgram = require('node:dgram');
const readline = require('node:readline');

const HOST = '127.0.0.1';
const PUERTO = Number(process.env.SOCKETS_UDP_PORT || 12346);
const socket = dgram.createSocket('udp4');
let consola;
let cerrado = false;
let saliendo = false;

function cerrar() {
  if (cerrado) return;
  cerrado = true;
  if (consola) consola.close();
  process.stdin.destroy();
  socket.close();
}

socket.on('listening', () => {
  console.log(`Cliente UDP listo en ${HOST}:${socket.address().port}. Destino: ${HOST}:${PUERTO}`);
  console.log('Escribe un mensaje o salir para terminar.');
  consola = readline.createInterface({ input: process.stdin, output: process.stdout });
  consola.on('line', (mensaje) => {
    if (cerrado || saliendo) return;
    console.log(`[ENVIADO] ${mensaje}`);
    saliendo = mensaje.trim() === 'salir';
    socket.send(mensaje, PUERTO, HOST, (error) => {
      if (error) console.error(`[ERROR ENVIO UDP] ${error.message}`);
      // El datagrama de salida se envía antes de cerrar el socket local.
      if (saliendo) cerrar();
    });
  });
  consola.on('close', cerrar);
});

socket.on('message', (datos, origen) => {
  console.log(`[SERVIDOR ${origen.address}:${origen.port}] ${datos.toString('utf8')}`);
});
socket.on('close', () => console.log('Socket UDP del cliente cerrado.'));
socket.on('error', (error) => {
  console.error(`[ERROR UDP] ${error.message}`);
  process.exitCode = 1;
  cerrar();
});
socket.bind(0, HOST); // El sistema asigna un puerto diferente a cada cliente.
