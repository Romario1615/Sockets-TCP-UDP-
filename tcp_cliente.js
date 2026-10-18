// Parte 2. Cliente TCP: lee la consola, envía líneas y muestra respuestas.
const net = require('node:net');
const readline = require('node:readline');

const HOST = '127.0.0.1';
const PUERTO = Number(process.env.SOCKETS_TCP_PORT || 12345);
const socket = net.createConnection({ host: HOST, port: PUERTO });
const consola = readline.createInterface({ input: process.stdin, output: process.stdout });
let pendiente = '';
let saliendo = false;
socket.setEncoding('utf8');

socket.on('connect', () => {
  console.log(`Cliente TCP conectado a ${HOST}:${PUERTO}`);
  console.log('Escribe un mensaje o salir para terminar.');
});

consola.on('line', (mensaje) => {
  if (saliendo || socket.destroyed) return;
  console.log(`[ENVIADO] ${mensaje}`);
  socket.write(mensaje + '\n');
  if (mensaje.trim() === 'salir') {
    saliendo = true;
    consola.close();
  }
});

socket.on('data', (datos) => {
  pendiente += datos;
  const mensajes = pendiente.split('\n');
  pendiente = mensajes.pop();
  for (const mensaje of mensajes) console.log(`[SERVIDOR] ${mensaje}`);
});
consola.on('close', () => {
  process.stdin.destroy();
  socket.end();
});
socket.on('close', () => {
  console.log('Conexion TCP cerrada por el servidor.');
  consola.close();
});
socket.on('error', (error) => {
  console.error(`[ERROR TCP] ${error.message}`);
  process.exitCode = 1;
  consola.close();
});
