# Navark Core - Backend

**Navark Core** es el backend oficial del juego multijugador de batalla naval **Navark**, desarrollado con tecnologías
modernas para ofrecer una experiencia en tiempo real fluida, estratégica y resiliente.

---

## 🚀 Tecnologías principales

- **NestJS** (WebSocket Gateway + HTTP API, arquitectura modular)
- **Socket.IO** (Canal de comunicación bidireccional en tiempo real)
- **Prisma ORM + PostgreSQL** (Gestión robusta de datos relacionales y consultas eficientes)
- **Redis** (Memoria volátil para sincronización en tiempo real: turnos, estados, reconexiones)
- **Arquitectura Hexagonal** (Separación de responsabilidades entre `domain`, `application` e `infrastructure`)

## 🔥 Funcionalidades implementadas

- **Partidas multijugador** de **2 a 6 jugadores** simultáneos
- **Modos de juego dinámicos:**
    - **Individual**: todos contra todos (battle royale por turnos)
    - **Por equipos**: hasta 5 equipos según configuración de sala

- **Sistema de turnos inteligente:**
    - **30 segundos por turno**, gestionados por temporizador central
    - Pérdida de turno si no se dispara dentro del tiempo
    - Expulsión automática tras 3 turnos consecutivos inactivos

- **Sistema nuclear progresivo:**
    - **6 impactos consecutivos** desbloquean un ataque nuclear
    - Disparo tipo rombo con múltiples impactos

- **Reconexión automática:**
    - Conserva estado, progreso y turno activo
    - Reconecta al jugador con la misma identidad (JWT o ID)

- **Modo espectador:**
    - Observación en tiempo real sin interferencia en el juego

- **Soporte híbrido de usuarios:**
    - Invitados (sin ranking ni historial)
    - Registrados (con historial, estadísticas, personalización)

- **Limpieza automática de partidas:**
    - Si todos abandonan, la partida se elimina del sistema

- **Gestión de salas completa:**
    - Espera activa, asignación manual de equipos
    - Transferencia de creador en tiempo real
    - Validaciones estrictas antes de iniciar partida

- **Estadísticas de jugador:**
    - Individuales por partida
    - Globales acumuladas (rankings, precisión, victorias)

## 📂 Estructura del Proyecto

| Carpeta           | Propósito                                                             |
|-------------------|-----------------------------------------------------------------------|
| `/application`    | Lógica de negocio: creación, disparos, control de turnos, reconexión. |
| `/domain`         | Modelos del dominio (`Board`, `Shot`, `Ship`, etc.).                  |
| `/infrastructure` | Adaptadores externos: Prisma, Redis, Gateway WebSocket.               |

## 📆 Endpoints HTTP implementados

### 🛡️ Autenticación (`/auth`)

| Método | Ruta             | JWT | Descripción                                            |
|--------|------------------|-----|--------------------------------------------------------|
| POST   | `/auth/guest`    | ❌   | Crea una sesión temporal como jugador invitado.        |
| POST   | `/auth/identify` | ❌   | Identifica a un usuario registrado o crea uno nuevo.   |
| POST   | `/auth/refresh`  | ❌   | Renueva el `access_token` usando el token de refresco. |
| GET    | `/auth/me`       | ✅   | Obtiene los datos completos del usuario autenticado.   |
| PATCH  | `/auth/me`       | ✅   | Actualiza la información del perfil del usuario.       |

---

### 🎮 Gestión de Partidas (`/games`)

| Método | Ruta                 | JWT | Descripción                                                      |
|--------|----------------------|-----|------------------------------------------------------------------|
| POST   | `/games/manual`      | ✅   | Crea una partida personalizada con opciones configurables.       |
| POST   | `/games/matchmaking` | ✅   | Busca y une al usuario a una partida disponible automáticamente. |

---

### 📊 Estadísticas (`/stats`)

| Método | Ruta                            | JWT | Descripción                                                                 |
|--------|---------------------------------|-----|-----------------------------------------------------------------------------|
| GET    | `/stats/games/{gameId}/players` | ✅   | Estadísticas individuales de todos los jugadores de una partida finalizada. |
| GET    | `/stats/users/{userId}/global`  | ✅   | Estadísticas acumuladas públicas o privadas de un usuario.                  |
| GET    | `/stats/me/global`              | ✅   | Estadísticas acumuladas del usuario autenticado.                            |
| GET    | `/stats/me/games`               | ✅   | Historial de partidas del usuario autenticado con estadísticas por juego.   |

## 📚 Flujos del Juego Detallados

### Creación y Unión a Partidas

**1. Creación de una partida personalizada:**

- Desde la pantalla principal, selecciona "Crear partida manual" para iniciar el proceso.
- Se abrirá un formulario con las siguientes opciones configurables:
    - **Número de jugadores**: selecciona entre 2 y 6 participantes máximos.
    - **Modo de juego**: elige entre "Individual" (todos contra todos) o "Equipos" (colaborativo).
    - **Tamaño del tablero**: determina las dimensiones (10x10 por defecto).
    - **Privacidad**: configura si la partida es pública o privada con contraseña.
    - **Tiempo por turno**: ajusta la duración máxima de cada turno (30 segundos por defecto).
- Al confirmar la configuración, el sistema crea la sala de espera y te asigna automáticamente como administrador.
- La partida quedará visible en la lista pública (si no es privada) para que otros jugadores puedan unirse.

**2. Unirse a partidas existentes:**

- **Desde la lista de partidas**: visualiza todas las partidas públicas disponibles con sus detalles (jugadores
  actuales, modo, estado). Selecciona una y haz clic en "Unirse".
- **Mediante código**: introduce el código único de la partida en la opción "Unirse con código" para acceder
  directamente.
- **Emparejamiento automático**: usa "Unión rápida" para que el sistema te asigne automáticamente a una partida
  compatible con tus preferencias.
- **Partidas privadas**: introduce la contraseña requerida cuando te unas a una partida protegida.

**3. Sala de espera y preparación:**

- Una vez dentro de la sala, verás el panel de jugadores con todos los participantes actuales.
- **Estado de preparación**: marca la casilla "Estoy listo" cuando hayas terminado de revisar la configuración.
- **Chat de sala**: comunícate con otros jugadores mientras esperan que la partida comience.
- **Selección de equipo**: si el modo es "Por equipos", selecciona a cuál quieres unirte desde el panel lateral.
- **Información de la partida**: visualiza los detalles completos de la configuración en la parte superior.
- **Contador de jugadores**: muestra cuántos participantes faltan para alcanzar el mínimo necesario.

**4. Gestión de la sala (para el creador):**

- Como administrador/creador puedes:
    - **Iniciar la partida**: cuando todos los jugadores estén listos y se cumpla el mínimo requerido.
    - **Ajustar configuración**: modificar parámetros antes de iniciar (modo, tamaño, etc.).
    - **Expulsar jugadores**: eliminar participantes problemáticos de la sala.
    - **Transferir administración**: ceder el control a otro jugador si necesitas salir.
    - **Cancelar la partida**: disolver la sala completamente si es necesario.

**5. Transferencia de control:**

- Si como creador necesitas salir, usa "Transferir administración" desde el menú de opciones.
- Selecciona al jugador destinatario de los permisos de administrador en la lista desplegable.
- Confirma la transferencia y el sistema notificará a todos los participantes del cambio.
- El nuevo administrador recibirá todas las herramientas y permisos para gestionar la sala.

### Flotas y niveles de dificultad

Cada participante recibe una flota de barcos distribuidos aleatoriamente en su tablero. La composición de la flota varía
según el nivel de dificultad seleccionado:

#### Flota estándar (dificultad fácil)

- 1 portaaviones (5 casillas)
- 1 acorazado (4 casillas)
- 1 crucero (3 casillas)
- 2 destructores (2 casillas cada uno)
- 2 submarinos (1 casilla cada uno)

#### Flota intermedia (dificultad media)

- 2 acorazados (4 casillas cada uno)
- 2 cruceros (3 casillas cada uno)
- 2 destructores (2 casillas cada uno)
- 1 submarino (1 casilla)

#### Flota avanzada (dificultad difícil)

- 1 acorazado (4 casillas)
- 1 crucero (3 casillas)
- 2 destructores (2 casillas cada uno)
- 1 submarino (1 casilla)

La dificultad aumenta no solo por el número y tamaño de los barcos, sino también por la reducción total de casillas
ocupadas, lo que hace más desafiante encontrar los barcos enemigos en el tablero.

### Mecánicas de Juego y Sistema de Turnos

**1. Inicialización de la partida:**

- Cuando el administrador inicia la partida, ocurre la siguiente secuencia:
    - El sistema genera un tablero para cada jugador con dimensiones según la configuración.
    - Se distribuyen los diferentes tipos de barcos para cada participante.
    - Los barcos se colocan automáticamente en posiciones aleatorias (horizontal o vertical).
    - Se selecciona aleatoriamente al primer jugador para comenzar la ronda de turnos.
    - Cada jugador visualiza su propio tablero con sus barcos y un tablero de disparo para cada oponente.
    - En modo equipos, también puedes ver la disposición de barcos de tus aliados.

**2. Sistema de turnos y tiempo:**

- El jugador activo recibe una notificación visual destacada cuando es su turno.
- Se inicia un temporizador visible de 30 segundos para realizar la acción.
- Durante este tiempo, el jugador debe seleccionar coordenadas y confirmar su disparo.
- **Advertencias automáticas** a los 10 y 5 segundos restantes.
- Si el tiempo se agota sin acción, se considera turno perdido y pasa al siguiente jugador.
- Tres turnos perdidos consecutivos resultan en la expulsión automática por inactividad.

**3. Mecánica de disparos:**

- Para realizar un disparo:
    - Selecciona el tablero del oponente objetivo (en modo individual o por equipos).
    - Elige las coordenadas exactas haciendo clic en la celda deseada.
    - Confirma la acción con el botón "Disparar" para ejecutar el ataque.
    - El sistema procesa el disparo y muestra el resultado a todos los jugadores.

- **Resultados posibles:**
    - **Agua**: el disparo no impacta ningún barco (se marca como círculo azul).
    - **Impacto**: el disparo golpea parte de un barco (se marca como X roja).
    - **Hundido**: el disparo completa la destrucción de un barco entero (se destacan todas sus casillas).

- **Sistema de turnos:**
    - Al finalizar un disparo, el turno pasa al siguiente jugador, independientemente del resultado.
    - Este flujo mantiene un ritmo dinámico de juego, donde cada jugador debe planificar cuidadosamente su único disparo
      por turno.

**4. Sistema de arma nuclear:**

- **Desbloqueo progresivo:**
    - Cada acierto consecutivo con disparos normales incrementa tu contador nuclear.
    - Al alcanzar 6 impactos directos consecutivos, desbloqueas el arma nuclear.
    - Un indicador visual muestra claramente tu progreso actual (0-6).
    - Al desbloquear el arma, recibes una notificación destacada y cambia la interfaz de disparo.

- **Uso del arma nuclear:**
    - Cuando está disponible, puedes cambiar al "Modo nuclear" desde la interfaz.
    - Selecciona la coordenada central del área de impacto 3x3.
    - Al confirmar, el disparo nuclear afecta simultáneamente 9 casillas (3x3).
    - Cada casilla dentro del área se procesa individualmente (puede resultar en múltiples impactos).
    - Después de usar el arma nuclear, el contador se reinicia y debes volver a acumular 6 aciertos.
    - Si fallas un disparo normal en cualquier momento, tu progreso nuclear se reinicia a cero.

**5. Hundimiento de barcos y eliminación:**

- **Proceso de hundimiento:**
    - Un barco se considera hundido cuando todas sus partes han sido impactadas.
    - Al hundir un barco, se muestra una animación especial y se notifica a todos los jugadores.
    - Se revelan todas las casillas del barco hundido, incluso las que no habían sido impactadas.
    - Después de hundir un barco, el turno pasa al siguiente jugador.

- **Eliminación de jugadores:**
    - Cuando todos los barcos de un jugador son hundidos, queda eliminado de la partida.
    - Se muestra una notificación global informando la eliminación.
    - El jugador eliminado puede permanecer como espectador para observar el resto de la partida.
    - En modo individual, el jugador ocupa automáticamente el último puesto disponible del ranking.
    - En modo equipos, el equipo continúa activo mientras quede al menos un miembro con barcos.

**6. Sistema de espectadores:**

- Los espectadores pueden:
    - Ver todos los tableros de los jugadores activos en tiempo real.
    - Observar los disparos y resultados de cada acción.
    - Participar en el chat general sin interferir en la partida.
    - Recibir todas las notificaciones y estadísticas del progreso.
    - Unirse en cualquier momento, incluso con la partida ya iniciada.

**7. Finalización de la partida:**

- **Condiciones de victoria:**
    - **Modo individual**: el último jugador con barcos a flote gana la partida.
    - **Modo equipos**: el último equipo con al menos un miembro activo es el ganador.

- **Pantalla de resultados:**
    - Al finalizar la partida, el sistema genera estadísticas detalladas para cada jugador:
        - **Disparos totales**: número total de disparos realizados
        - **Disparos exitosos**: cantidad de disparos que impactaron barcos enemigos
        - **Precisión**: porcentaje de aciertos (calculado con 2 decimales)
        - **Barcos hundidos**: cantidad de barcos enemigos destruidos completamente
        - **Estado final**: indicador de si el jugador ganó o fue eliminado
        - **Turnos jugados**: número de veces que el jugador tuvo su turno
        - **Barcos restantes**: número de barcos propios que quedaron sin hundir
        - **Racha máxima**: mayor secuencia consecutiva de aciertos lograda
        - **Análisis por tipo de disparo**: desglose de la cantidad de cada tipo de disparo utilizado
    - Estas estadísticas se envían a todos los clientes mediante el evento `game:ended` para su visualización.

### Sistema de Reconexión y Gestión de Abandonos

**1. Mecanismo de reconexión automática:**

- Si pierdes conexión durante una partida activa, el sistema:
    - Mantiene tu sesión activa durante un período de gracia (2 minutos).
    - Conserva intacto el estado de tu tablero, barcos y progreso.
    - Al volver a conectarte, detecta automáticamente la partida pendiente.
    - Te reincorpora exactamente en el mismo estado, sin perder información.
    - Si era tu turno, el tiempo restante continúa desde donde se interrumpió.
    - Recibes una notificación con resumen de los eventos ocurridos durante tu ausencia.

**2. Gestión de abandonos voluntarios:**

- Para abandonar una partida en curso:
    - Abre el menú de opciones y selecciona "Abandonar partida".
    - Confirma la acción en el diálogo de verificación.
    - El sistema te desvincula completamente de la partida.
    - No podrás volver a unirte a esa misma sesión de juego.
    - En modo individual, automáticamente ocupas la última posición disponible.
    - En modo equipos, tus barcos restantes quedan inactivos (no pueden ser controlados).

**3. Reasignación de creador:**

- Si el creador/administrador abandona la partida:
    - El sistema identifica automáticamente al siguiente jugador por orden de entrada.
    - Le asigna todos los privilegios y herramientas de administración.
    - Notifica a todos los participantes del cambio de administrador.
    - La partida continúa sin interrupciones con el nuevo líder.
    - Si el abandono ocurre en la sala de espera, el nuevo creador puede modificar configuraciones.

**4. Cierre automático de partidas:**

- Una partida se cierra automáticamente cuando:
    - Todos los jugadores han abandonado la sesión.
    - La partida ha permanecido inactiva más de 10 minutos.
    - Se produce un error crítico que impide su continuación.
    - El sistema notifica a cualquier participante que intente reconectarse que la partida ya no existe.
    - Se liberan todos los recursos asociados para optimizar el rendimiento del servidor.

## 🌐 Sistema de Comunicación en Tiempo Real

### 🛥️ Eventos del Cliente → Servidor

| Evento              | Payload                      | Descripción                                            |
|---------------------|------------------------------|--------------------------------------------------------|
| `player:join`       | `{ gameId, role? }`          | Solicitud para unirse como jugador o espectador.       |
| `player:ready`      | `{ gameId }`                 | Marcar al jugador como preparado para iniciar.         |
| `player:chooseTeam` | `{ gameId, team }`           | Selección de equipo en el modo correspondiente.        |
| `player:leave`      | `{ gameId }`                 | Notificación de abandono voluntario de la partida.     |
| `creator:transfer`  | `{ gameId, targetUserId }`   | Transferencia del rol de administrador a otro jugador. |
| `game:start`        | `{ gameId }`                 | Solicitud del administrador para iniciar la partida.   |
| `player:fire`       | `{ gameId, x, y, shotType }` | Ejecución de un disparo en coordenadas específicas.    |

### 🛥️ Eventos del Servidor → Cliente

#### Gestión de Sala y Conexiones

| Evento                 | Payload                                                  | Descripción                                                        |
|------------------------|----------------------------------------------------------|--------------------------------------------------------------------|
| `player:joined`        | `{ socketId }`                                           | Un nuevo jugador se ha unido a la sala.                            |
| `player:joined:ack`    | `{ success, room?, createdById?, reconnected?, error? }` | Confirmación de ingreso como jugador, con posible reconexión.      |
| `spectator:joined:ack` | `{ success, room?, createdById?, reconnected?, error? }` | Confirmación de ingreso como espectador.                           |
| `join:denied`          | `{ reason }`                                             | Rechazo de unión a partida (llena, iniciada, expulsado, etc).      |
| `player:left`          | `{ userId, nickname }`                                   | Notificación de que un jugador salió o abandonó la partida.        |
| `creator:changed`      | `{ newCreatorUserId, newCreatorNickname }`               | El rol de administrador ha sido reasignado automáticamente.        |
| `creator:transfer:ack` | `{ success, error? }`                                    | Confirmación del intento de transferencia de rol de administrador. |

#### Sistema de Turnos y Timeouts

| Evento          | Payload      | Descripción                                                                 |
|-----------------|--------------|-----------------------------------------------------------------------------|
| `turn:changed`  | `{ userId }` | Nuevo turno asignado a un jugador.                                          |
| `turn:timeout`  | `{ userId }` | Jugador no actuó a tiempo (10s) y perdió su turno.                          |
| `player:kicked` | `{ reason }` | Jugador expulsado automáticamente tras 3 turnos perdidos o abandono manual. |

#### Disparos y Combate

| Evento              | Payload                                        | Descripción                                                               |
|---------------------|------------------------------------------------|---------------------------------------------------------------------------|
| `player:fired`      | `{ shooterUserId, x, y, hit, sunk, shotType }` | Resultado de disparo transmitido a todos (impacto, hundimiento, agua).    |
| `player:fire:ack`   | `{ success, hit?, sunk?, error? }`             | Confirmación privada del disparo ejecutado (solo al jugador que disparó). |
| `player:eliminated` | `{ userId }`                                   | Jugador eliminado por perder todos sus barcos.                            |
| `nuclear:status`    | `{ progress, hasNuclear, used }`               | Estado del arma nuclear del jugador (carga actual, disponible o usada).   |

#### Estado y Finalización

| Evento           | Payload                                        | Descripción                                                      |
|------------------|------------------------------------------------|------------------------------------------------------------------|
| `game:started`   | `{ gameId }`                                   | La partida ha comenzado oficialmente.                            |
| `game:start:ack` | `{ success, error? }`                          | Confirmación del intento de iniciar la partida por el creador.   |
| `game:ended`     | `{ mode, winnerUserId?, winningTeam?, stats }` | Resultado final de la partida con estadísticas por jugador.      |
| `game:abandoned` | `null`                                         | La partida fue cancelada por abandono de todos los jugadores.    |
| `board:update`   | `{ board: { size, ships, shots, myShips } }`   | Actualización visual del tablero actual del jugador autenticado. |

#### Preparación y Sincronización

| Evento                | Payload                | Descripción                                                            |
|-----------------------|------------------------|------------------------------------------------------------------------|
| `player:ready:ack`    | `{ success }`          | Confirmación de que el estado "listo" fue registrado.                  |
| `player:ready:notify` | `{ socketId }`         | Notificación general de que un jugador está listo.                     |
| `all:ready`           | `null`                 | Todos los jugadores están listos para comenzar.                        |
| `player:teamAssigned` | `{ userId, team }`     | Confirmación de equipo asignado correctamente (modo por equipos).      |
| `player:reconnected`  | `{ userId, nickname }` | Un jugador se ha reconectado exitosamente a la partida.                |
| `reconnect:ack`       | `{ success }`          | Confirmación al jugador de que su reconexión fue exitosa.              |
| `reconnect:failed`    | `{ reason }`           | La reconexión falló (jugador no estaba en la partida o fue expulsado). |
| `error`               | `{ message, code? }`   | Mensaje genérico de error enviado al cliente.                          |

## 🧪 Instalación y ejecución local

```
# Clonar el repositorio
git clone https://github.com/tu-usuario/navark-core.git
cd navark-core

# Instalar dependencias
npm install

# Copiar y configurar las variables de entorno
cp .env.example .env

# Aplicar migraciones Prisma
npx prisma migrate dev

# Iniciar servidor en modo desarrollo
npm run start:dev
```

---

**Navark Core** - ¡La batalla naval definitiva!
