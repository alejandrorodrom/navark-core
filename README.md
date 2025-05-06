# Navark Core - Backend

**Navark Core** es el backend oficial del juego multijugador de batalla naval **Navark**, desarrollado con tecnologías
modernas para ofrecer una experiencia en tiempo real fluida y robusta.

---

## 🚀 Tecnologías principales

- **NestJS** (WebSocket Gateway + HTTP API)
- **Socket.IO** (Servidor WebSocket en tiempo real)
- **Prisma ORM + PostgreSQL** (Persistencia de datos estructurada)
- **Redis** (Sincronización de estados en memoria: turnos, jugadores, equipos, disparos nucleares)
- **Arquitectura Hexagonal** (separación en capas: `domain` / `application` / `infrastructure`)

## 🔥 Funcionalidades implementadas

- **Partidas multijugador** con capacidad para **2 a 6 jugadores**
- **Modos de juego versátiles:**
    - **Individual**: todos contra todos en batalla campal
    - **Por equipos**: colaboración estratégica entre aliados

- **Sistema de turnos avanzado** con límite de **30 segundos** por jugador
- **Arma nuclear especial**: desbloqueada al lograr **6 aciertos consecutivos**
- **Gestión automática de jugadores:**
    - Expulsión tras 3 turnos de inactividad
    - Reconexión inteligente si la partida sigue activa
    - Reasignación del rol de creador si el anfitrión abandona

- **Modo espectador** para unirse como observador sin participar
- **Eliminación automática** de jugadores sin barcos restantes
- **Soporte híbrido de usuarios** (registrados e invitados)
- **Estadísticas detalladas** al finalizar cada partida

## 📂 Estructura del proyecto

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

### 🎮 Gestión de Partidas (`/games`)

| Método | Ruta                 | JWT | Descripción                                                      |
|--------|----------------------|-----|------------------------------------------------------------------|
| POST   | `/games/manual`      | ✅   | Crea una partida personalizada con opciones configurables.       |
| POST   | `/games/matchmaking` | ✅   | Busca y une al usuario a una partida disponible automáticamente. |

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

Cada participante recibe una flota de barcos distribuidos aleatoriamente en su tablero. La composición de la flota varía según el nivel de dificultad seleccionado:

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

La dificultad aumenta no solo por el número y tamaño de los barcos, sino también por la reducción total de casillas ocupadas, lo que hace más desafiante encontrar los barcos enemigos en el tablero.

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

| Evento                 | Payload                                                  | Descripción                                      |
|------------------------|----------------------------------------------------------|--------------------------------------------------|
| `player:joined`        | `{ socketId }`                                           | Notificación de nuevo jugador unido a la sala.   |
| `player:joined:ack`    | `{ success, room?, createdById?, reconnected?, error? }` | Confirmación de unión exitosa como jugador.      |
| `spectator:joined:ack` | `{ success, room?, createdById?, reconnected?, error? }` | Confirmación de unión exitosa como espectador.   |
| `join:denied`          | `{ reason }`                                             | Rechazo de solicitud de unión con motivo.        |
| `player:left`          | `{ userId, nickname }`                                   | Notificación de salida de un jugador.            |
| `creator:changed`      | `{ newCreatorUserId, newCreatorNickname }`               | Aviso de cambio de administrador de la partida.  |
| `creator:transfer:ack` | `{ success, error? }`                                    | Confirmación de transferencia de administración. |

#### Sistema de Turnos y Timeouts

| Evento          | Payload      | Descripción                                            |
|-----------------|--------------|--------------------------------------------------------|
| `turn:changed`  | `{ userId }` | Notificación de cambio de turno al siguiente jugador.  |
| `turn:timeout`  | `{ userId }` | Aviso de tiempo agotado sin acción del jugador actual. |
| `player:kicked` | `{ reason }` | Notificación de expulsión por inactividad prolongada.  |

#### Disparos y Combate

| Evento              | Payload                              | Descripción                                          |
|---------------------|--------------------------------------|------------------------------------------------------|
| `player:fired`      | `{ shooterUserId, x, y, hit, sunk }` | Transmisión del resultado de un disparo a todos.     |
| `player:fire:ack`   | `{ success, hit?, sunk?, error? }`   | Confirmación personal del resultado de tu disparo.   |
| `player:eliminated` | `{ userId }`                         | Notificación de jugador eliminado por pérdida total. |
| `nuclear:status`    | `{ progress, hasNuclear, used }`     | Actualización del estado del arma nuclear personal.  |

#### Estado y Finalización

| Evento           | Payload                                        | Descripción                                      |
|------------------|------------------------------------------------|--------------------------------------------------|
| `game:started`   | `{ gameId }`                                   | Aviso de inicio oficial de la partida a todos.   |
| `game:start:ack` | `{ success, error? }`                          | Confirmación personal de inicio exitoso.         |
| `game:ended`     | `{ mode, winnerUserId?, winningTeam?, stats }` | Notificación de fin con resultados completos.    |
| `game:abandoned` | `null`                                         | Aviso de partida cancelada por abandono general. |
| `board:update`   | `{ board: { size, ships, shots, myShips } }`   | Actualización del estado actual de tu tablero.   |

#### Preparación y Sincronización

| Evento                | Payload                | Descripción                                         |
|-----------------------|------------------------|-----------------------------------------------------|
| `player:ready`        | `{ socketId }`         | Aviso de jugador marcado como listo.                |
| `player:ready:ack`    | `{ success }`          | Confirmación personal de estado listo registrado.   |
| `player:ready:notify` | `{ socketId }`         | Notificación global de jugador preparado.           |
| `all:ready`           | `null`                 | Aviso de que todos los participantes están listos.  |
| `player:teamAssigned` | `{ socketId, team }`   | Confirmación de asignación exitosa de equipo.       |
| `player:reconnected`  | `{ userId, nickname }` | Notificación de jugador que ha vuelto a conectarse. |
| `reconnect:ack`       | `{ success }`          | Confirmación personal de reconexión exitosa.        |
| `reconnect:failed`    | `{ reason }`           | Aviso de fallo en intento de reconexión.            |
| `error`               | `{ message, code? }`   | Notificación de error en operación solicitada.      |
| `heartbeat`           | `null`                 | Señal periódica para verificar conexión activa.     |

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

## 🔜 Próximas funcionalidades

- **Sistema de chat integrado** para comunicación durante la partida
- **Personalización de barcos** con diferentes habilidades especiales
- **Modo torneo** para competiciones organizadas
- **Sistema de logros** con recompensas desbloqueables
- **Panel de estadísticas globales** para seguimiento de progreso

---

**Navark Core** - ¡La batalla naval definitiva!
