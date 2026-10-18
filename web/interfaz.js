'use strict';

// Este archivo solo controla el panel. Los mensajes los procesan los programas
// tcp_*, udp_* y chat_* en procesos Node independientes.
const $ = (id) => document.getElementById(id);
const modalidades = {
  tcp: {
    etiqueta: 'TCP', parte: 'PARTES 1 Y 2 DE LA GUÍA', titulo: 'Mensajes en mayúsculas',
    descripcion: 'Conecta dos clientes y comprueba cómo el servidor responde a cada mensaje.',
    servidor: 'tcp_server.js', cliente: 'tcp_cliente.js',
    funcion: 'Transforma cada mensaje recibido a mayúsculas.',
    concepto: 'TCP mantiene una conexión entre cada cliente y el servidor. Cada respuesta vuelve por el socket del cliente que envió el mensaje.',
    notas: ['El servidor responde en mayúsculas.', 'Mantiene su propia conexión.'],
    ejemplos: ['Hola servidor, somos el grupo de trabajo', 'Segundo cliente conectado'],
    paso: 'Comprueba la respuesta en mayúsculas',
  },
  udp: {
    etiqueta: 'UDP', parte: 'PARTES 3 Y 4 DE LA GUÍA', titulo: 'Conteo de palabras',
    descripcion: 'Envía datagramas desde dos clientes y observa el conteo de cada mensaje.',
    servidor: 'udp_server.js', cliente: 'udp_cliente.js',
    funcion: 'Cuenta las palabras y responde al puerto de origen. No responde a salir.',
    concepto: 'UDP envía datagramas sin establecer una conexión. El servidor usa la IP y el puerto de origen para responder; UDP no garantiza la entrega ni el orden.',
    notas: ['Prueba también una línea vacía.', 'Cada cliente usa su propio puerto.'],
    ejemplos: ['hola desde udp', 'aplicaciones   distribuidas con sockets'],
    paso: 'Compara el conteo de palabras',
  },
  chat: {
    etiqueta: 'CHAT / TCP', parte: 'ACTIVIDAD ADICIONAL DE LA GUÍA', titulo: 'Chat con usuarios identificados',
    descripcion: 'Identifica a cada usuario e intercambia mensajes entre dos clientes TCP.',
    servidor: 'chat_server.js', cliente: 'chat_cliente.js',
    funcion: 'Asocia cada socket a un nombre y reenvía sus mensajes a los otros usuarios.',
    concepto: 'El primer mensaje identifica al usuario. El servidor guarda su nombre en un Map y reenvía cada mensaje a los demás sockets. El emisor ve su propio mensaje con [YO].',
    notas: ['Tus mensajes aparecen con [YO].', 'Recibe los mensajes del otro usuario.'],
    ejemplos: ['Hola, ¿listos para la práctica?', 'Sí, ya estamos comunicándonos por TCP'],
    paso: 'Revisa [YO] y el nombre del emisor',
  },
};
let modo = 'tcp';
let ultimoEstado = null;
let ocupado = false;
let consultando = false;
let disponible = true;
let temporizadorToast;

function mostrarError(mensaje) {
  $('error-banner').textContent = mensaje || '';
  $('error-banner').hidden = !mensaje;
}

function aviso(mensaje) {
  clearTimeout(temporizadorToast);
  $('toast').textContent = mensaje;
  $('toast').hidden = false;
  temporizadorToast = setTimeout(() => { $('toast').hidden = true; }, 3200);
}

async function solicitar(ruta, datos) {
  const respuesta = await fetch(ruta, datos ? {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos),
  } : {});
  const contenido = await respuesta.json();
  if (!respuesta.ok) throw new Error(contenido.error || 'No se pudo completar la operación.');
  return contenido;
}

function bitacora(id, texto, vacio) {
  const elemento = $(id);
  const contenido = texto || vacio;
  if (elemento.textContent === contenido) return;
  const alFinal = elemento.scrollHeight - elemento.scrollTop - elemento.clientHeight < 35;
  elemento.textContent = contenido;
  elemento.classList.toggle('empty-console', !texto);
  if (alFinal || !texto) elemento.scrollTop = elemento.scrollHeight;
}

function insignia(id, proceso, esServidor = false) {
  const elemento = $(id);
  const estado = proceso.estado;
  elemento.textContent = estado === 'activo' ? (esServidor ? 'Escuchando' : modo === 'udp' ? 'Listo' : 'Conectado')
    : estado === 'iniciando' ? 'Iniciando…' : estado === 'error' ? 'Error'
      : proceso.pid ? 'Finalizado' : esServidor ? 'Sin iniciar' : 'Desconectado';
  elemento.className = 'connection-badge' + (estado === 'activo' ? ' active' : estado === 'iniciando' ? ' starting' : estado === 'error' ? ' error' : '');
}

function dibujar() {
  if (!ultimoEstado) return;
  const grupo = ultimoEstado.modos[modo];
  const config = modalidades[modo];
  const servidor = grupo.servidor;
  const activos = grupo.clientes.filter((c) => c.listo).length;
  const mensajes = (servidor.log.match(modo === 'chat' ? /\[MENSAJE\]/g : /\[RECIBIDO/g) || []).length;
  const bloqueado = ocupado || !disponible;

  $('server-status').textContent = !disponible ? 'Sin conexión' : servidor.listo ? 'Escuchando' : servidor.estado === 'iniciando' ? 'Iniciando…' : servidor.estado === 'error' ? 'Error' : servidor.pid ? 'Detenido' : 'Sin iniciar';
  $('server-detail').textContent = servidor.listo ? 'Puerto ' + grupo.puerto + ' disponible' : servidor.estado === 'error' ? 'Revisa el registro del servidor' : 'Listo para comenzar';
  $('server-dot').classList.toggle('active', servidor.listo && disponible);
  $('client-count').textContent = activos;
  $('message-count').textContent = mensajes;
  $('metric-protocol').textContent = config.etiqueta;
  $('address-chip').textContent = ultimoEstado.direccion + ' : ' + grupo.puerto;
  $('start-button').disabled = bloqueado || ['activo', 'iniciando'].includes(servidor.estado);
  $('stop-button').disabled = bloqueado || !['activo', 'iniciando'].includes(servidor.estado);
  insignia('server-badge', servidor, true);
  $('server-pid').textContent = servidor.pid ? 'NODE · PID ' + servidor.pid : 'CONSOLA DEL SERVIDOR';
  bitacora('server-log', servidor.log, 'Inicia el servidor para escuchar mensajes.');

  grupo.clientes.forEach((cliente, indice) => {
    const prefijo = 'client' + (indice + 1);
    const ejecutando = ['activo', 'iniciando'].includes(cliente.estado);
    $(prefijo + '-title').textContent = modo === 'chat' && cliente.nombre ? cliente.nombre : 'Cliente ' + (indice + 1);
    $(prefijo + '-connect').disabled = bloqueado || !servidor.listo || ejecutando;
    $(prefijo + '-exit').disabled = bloqueado || !cliente.listo;
    $(prefijo + '-message').disabled = bloqueado || !cliente.listo;
    $(prefijo + '-send').disabled = bloqueado || !cliente.listo;
    $(prefijo + '-name').disabled = bloqueado || ejecutando;
    $(prefijo + '-pid').textContent = cliente.pid ? 'NODE · PID ' + cliente.pid : 'CONSOLA DEL CLIENTE';
    insignia(prefijo + '-badge', cliente);
    bitacora(prefijo + '-log', cliente.log, indice === 0 ? 'Conecta este cliente para enviar un mensaje.' : 'Conecta un segundo cliente para comparar.');
  });
  // Se conservan los pasos completados durante cada ejecución del servidor.
  const claves = grupo.servidor.pid || 'inicial';
  const progreso = avances[modo];
  if (progreso.pid !== claves) { progreso.pid = claves; progreso.pasos = [false, false, false, false]; }
  const observados = [servidor.listo, activos === 2, mensajes > 0,
    grupo.clientes.some((c) => /\[(?:ENVIADO|YO)\] salir/.test(c.log))];
  observados.forEach((valor, i) => {
    progreso.pasos[i] ||= valor;
    $('step' + (i + 1)).classList.toggle('done', progreso.pasos[i]);
  });
}
const avances = Object.fromEntries(Object.keys(modalidades).map((clave) => [clave, { pid: null, pasos: [false, false, false, false] }]));

function seleccionarModalidad(nueva) {
  modo = nueva;
  const config = modalidades[modo];
  document.querySelectorAll('[data-modo]').forEach((boton) => {
    boton.classList.toggle('active', boton.dataset.modo === modo);
    if (boton.dataset.modo === modo) boton.setAttribute('aria-current', 'page');
    else boton.removeAttribute('aria-current');
  });
  $('protocol-tag').textContent = config.etiqueta;
  $('part-label').textContent = config.parte;
  $('mode-title').textContent = config.titulo;
  $('mode-description').textContent = config.descripcion;
  $('server-file').textContent = config.servidor;
  $('server-purpose').textContent = config.funcion;
  $('concept-text').textContent = config.concepto;
  $('step3-detail').textContent = config.paso;
  [1, 2].forEach((numero) => {
    $('client' + numero + '-file').textContent = config.cliente;
    $('client' + numero + '-name-label').hidden = modo !== 'chat';
    $('client' + numero + '-note').textContent = config.notas[numero - 1];
    $('client' + numero + '-message').value = '';
    $('client' + numero + '-message').placeholder = modo === 'udp' ? 'Mensaje o línea vacía...' : 'Escribe un mensaje...';
  });
  mostrarError('');
  dibujar();
}

async function accion(ruta, datos = {}) {
  if (ocupado) return false;
  ocupado = true;
  mostrarError('');
  dibujar();
  try {
    ultimoEstado = await solicitar('/api/' + ruta, { modo, ...datos });
    disponible = true;
    return true;
  } catch (error) {
    mostrarError(error.message === 'Failed to fetch' ? 'No hay conexión con el panel. Inicia de nuevo iniciar.bat.' : error.message);
    return false;
  } finally {
    ocupado = false;
    dibujar();
  }
}

async function actualizar() {
  if (consultando || ocupado) return;
  consultando = true;
  try {
    ultimoEstado = await solicitar('/api/estado');
    if (!disponible) mostrarError('');
    disponible = true;
    dibujar();
    mostrarIntegrantes(ultimoEstado.integrantes);
  } catch (_) {
    disponible = false;
    mostrarError('No hay conexión con el panel. Ejecuta iniciar.bat para volver a abrirlo.');
    dibujar();
  } finally { consultando = false; }
}

function mostrarIntegrantes(nombres) {
  if ($('team-list').childElementCount) return;
  nombres.forEach((nombre) => {
    const fila = document.createElement('div'); fila.className = 'team-person';
    const avatar = document.createElement('span'); avatar.className = 'person-avatar';
    const partes = nombre.split(' '); avatar.textContent = partes[0][0] + partes[2][0];
    const texto = document.createElement('strong'); texto.textContent = nombre;
    fila.append(avatar, texto); $('team-list').append(fila);
  });
}

async function cargarCodigo() {
  $('source-code').textContent = 'Cargando…';
  try {
    const codigo = await solicitar('/api/codigo?archivo=' + encodeURIComponent($('code-file').value));
    $('source-code').textContent = codigo.codigo;
  } catch (error) { $('source-code').textContent = error.message; }
}

document.querySelectorAll('[data-modo]').forEach((boton) => boton.addEventListener('click', () => seleccionarModalidad(boton.dataset.modo)));
$('start-button').addEventListener('click', () => accion('iniciar'));
$('stop-button').addEventListener('click', () => accion('detener'));
[1, 2].forEach((cliente) => {
  $('client' + cliente + '-connect').addEventListener('click', () => accion('conectar', { cliente, nombre: $('client' + cliente + '-name').value }));
  $('client' + cliente + '-exit').addEventListener('click', () => accion('salir', { cliente }));
});
document.querySelectorAll('.message-form').forEach((formulario) => formulario.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const cliente = Number(formulario.dataset.cliente);
  const entrada = $('client' + cliente + '-message');
  const mensaje = entrada.value;
  if (await accion('enviar', { cliente, mensaje })) { entrada.value = ''; if (!entrada.disabled) entrada.focus(); }
}));
document.querySelectorAll('.example-button').forEach((boton) => boton.addEventListener('click', () => {
  const cliente = Number(boton.dataset.cliente);
  const entrada = $('client' + cliente + '-message');
  entrada.value = modalidades[modo].ejemplos[cliente - 1];
  if (!entrada.disabled) entrada.focus();
  else aviso('Conecta el cliente para enviar el ejemplo.');
}));
['instructions-button', 'theory-button', 'concept-button'].forEach((id) => $(id).addEventListener('click', () => $('instructions-dialog').showModal()));
$('team-button').addEventListener('click', () => $('team-dialog').showModal());
$('mobile-team-button').addEventListener('click', () => $('team-dialog').showModal());
$('code-button').addEventListener('click', () => {
  $('code-file').value = modalidades[modo].servidor;
  $('code-dialog').showModal();
  cargarCodigo();
});
$('code-file').addEventListener('change', cargarCodigo);
$('copy-code').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText($('source-code').textContent); aviso('Código copiado.'); }
  catch (_) { aviso('Selecciona el código para copiarlo desde el visor.'); }
});
document.querySelectorAll('[data-cerrar]').forEach((boton) => boton.addEventListener('click', () => $(boton.dataset.cerrar).close()));
document.querySelectorAll('dialog').forEach((dialogo) => dialogo.addEventListener('click', (evento) => {
  if (evento.target !== dialogo) return;
  const rect = dialogo.getBoundingClientRect();
  if (evento.clientX < rect.left || evento.clientX > rect.right || evento.clientY < rect.top || evento.clientY > rect.bottom) dialogo.close();
}));
actualizar();
setInterval(actualizar, 650);
