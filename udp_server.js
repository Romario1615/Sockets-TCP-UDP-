// Parte 3. Servidor UDP: cuenta palabras y responde al origen del datagrama.
const dgram = require('node:dgram');

const HOST = '127.0.0.1';
const PUERTO = Number(process.env.SOCKETS_UDP_PORT || 12346);
const servidor = dgram.createSocket('udp4');

servidor.on('message', (datos, origen) => {
  const mensaje = datos.toString('utf8').trim();
  console.log(`[RECIBIDO ${origen.address}:${origen.port}] ${mensaje}`);
  if (mensaje === 'salir') {
    console.log('[SALIR] No se envia respuesta. El servidor sigue escuchando.');
    return;
  }
  const cantidad = mensaje === '' ? 0 : mensaje.split(/\s+/).length;
  const respuesta = `Numero de palabras: ${cantidad}`;
  servidor.send(respuesta, origen.port, origen.address, (error) => {
    if (error) console.error(`[ERROR ENVIO UDP] ${error.message}`);
    else console.log(`[RESPUESTA ${origen.address}:${origen.port}] ${respuesta}`);
  });
});

servidor.on('error', (error) => {
  console.error(`[ERROR SERVIDOR UDP] ${error.message}`);
  servidor.close();
  process.exitCode = 1;
});
servidor.on('listening', () => {
  console.log(`Servidor UDP escuchando en ${HOST}:${servidor.address().port}`);
});
servidor.bind(PUERTO, HOST);
