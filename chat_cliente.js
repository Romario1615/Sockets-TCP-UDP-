// Actividad adicional. El nombre se envía primero: node chat_cliente.js Ana
const net = require('node:net');
const readline = require('node:readline');

const HOST = '127.0.0.1';
const PUERTO = Number(process.env.SOCKETS_CHAT_PORT || 12347);
const nombre = process.argv[2] || 'Usuario';
const socket = net.createConnection({ host: HOST, port: PUERTO });
const consola = readline.createInterface({ input: process.stdin, output: process.stdout });
let pendiente = '';
let saliendo = false;
let conectado = false;
socket.setEncoding('utf8');

socket.on('connect', () => {
  conectado = true;
  socket.write(nombre + '\n');
  console.log(`Cliente CHAT conectado a ${HOST}:${PUERTO} como ${nombre}`);
  console.log('Escribe un mensaje o salir para terminar.');
});

consola.on('line', (mensaje) => {
  if (!conectado || saliendo || socket.destroyed) return;
  console.log(`[YO] ${mensaje}`);
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
  for (const mensaje of mensajes) console.log(mensaje);
});
consola.on('close', () => {
  process.stdin.destroy();
  socket.end();
});
socket.on('close', () => {
  console.log('Conexion del chat cerrada.');
  consola.close();
});
socket.on('error', (error) => {
  console.error(`[ERROR CHAT] ${error.message}`);
  process.exitCode = 1;
  consola.close();
});
