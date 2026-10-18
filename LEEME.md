# Práctica 1: sockets TCP y UDP

Esta solución sigue la guía de Aplicaciones Distribuidas, NRC 37869, y usa los temas 1, 2 y 3 descargados. Los seis programas de la práctica utilizan únicamente Node.js y sus módulos incorporados `net`, `dgram` y `readline`. Incluye un panel visual opcional para manejarlos y observar su salida real.

Integrantes:

- Romario Javier Alban Moreta
- Jersson Kevin Vera Rivas
- Millie Stefanny Alvarez Villon
- Santiago Geovanny Sanchez Camacho

## Abrir el laboratorio visual

Haz doble clic en `iniciar.bat`. También puedes abrir una terminal en esta carpeta y ejecutar:

```powershell
node panel.js
```

Se abrirá **http://127.0.0.1:8787** en el navegador. Elige TCP, UDP o Chat, pulsa **Iniciar servidor**, conecta los dos clientes y envía mensajes. Usa **Salir** en un cliente para comprobar que el otro sigue activo. **Detener** cierra los procesos de la modalidad seleccionada; cambiar de pestaña conserva los procesos de las otras modalidades.

En **Ver código** puedes consultar los seis archivos de la guía. **Instrucciones** incluye los PDF originales de los temas 1 a 3 y de la práctica. Los cuatro integrantes aparecen en **Grupo de trabajo**.

El panel ejecuta los mismos archivos de consola como procesos independientes. No simula las respuestas. El módulo `http` sirve únicamente la interfaz y sus controles locales; los mensajes de la práctica viajan por los sockets `net` y `dgram`. El código auxiliar del panel está separado de los seis programas solicitados. No necesitas máquina virtual, Kali Linux, paquetes npm ni conexión a Internet para ejecutar el laboratorio con Node.js instalado.

Cierra el panel con Ctrl+C en su terminal para terminar también sus procesos. Cerrar solo la pestaña del navegador no detiene el panel. Para usar las terminales del procedimiento siguiente, pulsa primero **Detener** en cada modalidad que hayas iniciado.

## Antes de empezar

Abre una terminal en esta carpeta y ejecuta:

```powershell
node --version
```

Node.js ya está instalado en el equipo donde se preparó la práctica. No es necesario instalar paquetes con npm. Todos los programas se ejecutan en `127.0.0.1`, es decir, en esta misma computadora.

Para abrir otra terminal en esta carpeta puedes utilizar otra pestaña del terminal de VS Code o abrir PowerShell en la misma ubicación. Mantén el servidor abierto mientras trabajas con los clientes. La misma computadora ejecuta procesos independientes que se comunican mediante sockets.

## Relación con lo estudiado

| Concepto de los temas | Aplicación en la práctica |
|---|---|
| Tema 1, sección 1.1.2: cliente-servidor | Un proceso servidor recibe mensajes de varios procesos cliente. |
| Tema 2, sección 2.1.1: modelo basado en eventos | Node.js atiende conexiones y mensajes con eventos sin bloquear la atención a los otros clientes. |
| Tema 2, sección 2.2.4: concurrencia y paralelismo | Hay varios clientes activos; esto no significa que se cree un hilo JavaScript por cliente. |
| Tema 3, sección 3.1: sockets, IP, puertos, TCP y UDP | Se crean extremos de comunicación y se intercambian mensajes. |
| Tema 3, sección 3.3: reglas del intercambio de mensajes | En TCP cada mensaje termina en un salto de línea; en el chat el primer mensaje es el nombre. |

La introducción de la guía menciona hilos. Los pasos concretos piden los módulos `net` y `dgram` y sus eventos. Esta implementación sigue esos pasos y el modelo basado en eventos del tema 2; no crea un hilo independiente por conexión.

## Parte 1 y parte 2: TCP

Abre tres terminales en esta carpeta.

**Terminal 1, servidor:**

```powershell
node tcp_server.js
```

**Terminal 2, cliente 1:**

```powershell
node tcp_cliente.js
```

Escribe `hola servidor`. El cliente debe recibir `HOLA SERVIDOR`.

**Terminal 3, cliente 2:**

```powershell
node tcp_cliente.js
```

Escribe `segundo cliente` y comprueba que recibe `SEGUNDO CLIENTE`. Regresa al primer cliente y escribe otro mensaje. El servidor debe indicar dos clientes activos.

Escribe `salir` en el primer cliente. Su conexión termina. En el segundo cliente escribe `seguimos conectados`: debe recibir `SEGUIMOS CONECTADOS`. El servidor sigue abierto. Termina también el segundo cliente con `salir` y cierra el servidor con Ctrl+C.

En esta primera parte el servidor responde a quien envió el mensaje. La comunicación entre distintos usuarios se añade después, en el chat.

## Parte 3 y parte 4: UDP

**Terminal 1, servidor:**

```powershell
node udp_server.js
```

**Terminales 2 y 3, un cliente en cada una:**

```powershell
node udp_cliente.js
```

Prueba estas entradas:

| Entrada | Respuesta esperada |
|---|---|
| `hola desde udp` | `Numero de palabras: 3` |
| `aplicaciones distribuidas con sockets` | `Numero de palabras: 4` |
| Varios espacios entre las palabras | El mismo conteo, sin palabras vacías. |
| Una línea vacía | `Numero de palabras: 0` |
| `salir` | El cliente cierra su socket; el servidor no envía una respuesta. |

Observa que el servidor imprime la IP y el puerto de cada origen. Los dos clientes tienen puertos diferentes. Cada respuesta vuelve al origen del mensaje.

UDP intercambia datagramas: no se establece una conexión como en TCP. Que las respuestas lleguen en esta prueba local no significa que UDP garantice entrega, orden o ausencia de pérdidas.

Escribe `salir` en ambos clientes. Comprueba que el servidor continúa abierto y ciérralo con Ctrl+C.

## Actividad adicional: chat TCP con identificación

**Terminal 1, servidor:**

```powershell
node chat_server.js
```

**Terminal 2, Ana:**

```powershell
node chat_cliente.js Ana
```

**Terminal 3, Luis:**

```powershell
node chat_cliente.js Luis
```

Los nombres Ana y Luis son nombres de prueba; puedes cambiarlos en el comando.

1. En Ana escribe `Hola Luis`. Ana ve `[YO] Hola Luis`; Luis recibe `[Ana] Hola Luis`.
2. En Luis escribe `Hola Ana`. Luis ve `[YO] Hola Ana`; Ana recibe `[Luis] Hola Ana`.
3. Comprueba que no aparece una segunda copia del propio mensaje con el nombre del emisor.
4. Escribe `salir` en Ana. Luis recibe el aviso de salida y puede seguir enviando mensajes al servidor.
5. Termina Luis con `salir` y el servidor con Ctrl+C.

El servidor conserva un `Map` que relaciona cada socket con un nombre. La función `broadcast(mensaje, emisor)` recorre ese mapa y escribe el mensaje en todos los sockets excepto en el del emisor. El chat de consola funciona de forma independiente del panel visual.

## Qué hace cada archivo

| Archivo | Función |
|---|---|
| `tcp_server.js` | Escuchar en el puerto TCP 12345, recibir líneas y responder en mayúsculas. |
| `tcp_cliente.js` | Leer el teclado con `readline` y enviar mensajes al servidor TCP. |
| `udp_server.js` | Escuchar en el puerto UDP 12346 y responder con el número de palabras. |
| `udp_cliente.js` | Enviar datagramas y mostrar respuestas. |
| `chat_server.js` | Escuchar en TCP 12347, asociar sockets y nombres y distribuir mensajes. |
| `chat_cliente.js` | Enviar primero el nombre y mostrar los mensajes propios con `[YO]`. |
| `panel.js` y `web/` | Panel visual auxiliar: inicia procesos y muestra sus registros. |
| `integrantes.json` | Nombres de los cuatro integrantes que muestra el panel. |
| `material/` | Guía original y PDF de los temas 1, 2 y 3. |

Se utilizan puertos distintos para poder probar las tres variantes sin que una ocupe el puerto de otra. Los clientes reciben sus propios puertos locales automáticamente.

En los programas TCP se acumula el texto recibido hasta encontrar `\n`. Es necesario porque un mensaje puede llegar dividido entre varios eventos `data`, o varios mensajes pueden llegar juntos. `setEncoding('utf8')` conserva las tildes cuando los bytes llegan separados.

## Comprobación automática opcional

Desde esta carpeta:

```powershell
node herramientas/verificar_practica.js
```

Esta herramienta auxiliar abre los servidores y dos clientes por cada modalidad, escribe las entradas de prueba y comprueba las salidas. Se verifican 21 condiciones, incluido el cierre de clientes, el conteo de espacios y la recepción de texto UTF-8 dividido entre eventos TCP. Cierra los servidores manuales y los del panel antes de ejecutarla, para liberar los puertos. Los registros de los procesos y los resultados se guardan en `evidencias/`.

Para comparar el tiempo de respuesta de TCP y UDP en esta computadora:

```powershell
node herramientas/medir_latencia.js
```

La herramienta usa puertos propios (22345 y 22346), envía 300 mensajes a cada servidor y guarda los resultados en `evidencias/latencia.json`.

Las variables `SOCKETS_TCP_PORT`, `SOCKETS_UDP_PORT` y `SOCKETS_CHAT_PORT` permiten cambiar los puertos si fuera necesario; no hace falta modificarlas para la ejecución normal.

## Referencias de consulta

La base conceptual es `Tema_01.pdf`, `Tema_02.pdf` y `Tema_03.pdf` de Aplicaciones Distribuidas y la guía original de esta práctica. Para comprobar la sintaxis de las funciones se consultó únicamente la documentación oficial de [net](https://nodejs.org/docs/latest-v24.x/api/net.html), [dgram](https://nodejs.org/docs/latest-v24.x/api/dgram.html) y [readline](https://nodejs.org/docs/latest-v24.x/api/readline.html).
