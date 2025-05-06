# Navark Core - Backend

**Navark Core** es el backend oficial del juego multijugador de batalla naval **Navark**, desarrollado con **NestJS**, *
*Prisma ORM**, **PostgreSQL**, **Socket.IO** y **Redis**, siguiendo arquitectura hexagonal para una separación estricta
de responsabilidades.

---

## 🚀 Tecnologías principales

- **NestJS** (WebSocket Gateway + HTTP API)
- **Socket.IO** (Servidor WebSocket en tiempo real)
- **Prisma ORM + PostgreSQL** (Persistencia de datos estructurada)
- **Redis** (Sincronización de estados en memoria: turnos, jugadores, equipos, disparos nucleares)
- **Arquitectura Hexagonal** (`domain` / `application` / `infrastructure`)

## 🔥 Funcionalidades principales

- Partidas multijugador con **2 a 6 jugadores**.
- Modos de juego:
    - **Individual** (todos contra todos)
    - **Por equipos** (configurables)

- **Sistema de turnos** con límite de **30 segundos** por jugador.
- **Sistema de aciertos consecutivos**: un jugador mantiene su turno mientras siga acertando disparos.
- **Sistema nuclear**: desbloqueado tras **6 aciertos consecutivos** con disparos simples.
- **Expulsión automática** por inactividad (3 turnos).
- **Reconexión automática**: permite volver a la partida si no fue eliminada.
- **Reasignación automática de creador** al abandonar.
- **Modo espectador**: permite unirse como observador sin participar.
- **Eliminación automática** al perder todos los barcos.
- **Soporte híbrido de usuarios**: registrados e invitados.
- **Estadísticas completas por jugador** al finalizar la partida.

## 📂 Estructura del proyecto

| Carpeta                     | Propósito                                                                                    |
|-----------------------------|----------------------------------------------------------------------------------------------|
| `/application`              | Lógica de negocio: creación, disparos, control de turnos, reconexión.                        |
| `/domain`                   | Modelos del dominio (, `Shot`, , etc.). `Board``Ship`                                        |
| `/infrastructure`           | Adaptadores externos: Prisma, Redis, Gateway WebSocket.                                      |

## 📆 Endpoints HTTP

### 🛡️ Autenticación (`/auth`)

| Método | Ruta             | JWT | Descripción                             |
|--------|------------------|-----|-----------------------------------------|
| POST   | `/auth/guest`    | ❌   | Crear sesión como invitado.             |
| POST   | `/auth/identify` | ❌   | Identificar usuario registrado o nuevo. |
| POST   | `/auth/refresh`  | ❌   | Renovar `access_token`.                 |
| GET    | `/auth/me`       | ✅   | Obtener datos del usuario actual.       |
| PATCH  | `/auth/me`       | ✅   | Actualizar perfil del usuario.          |

### 🎮 Partidas (`/games`)

| Método | Ruta                 | JWT | Descripción                                           |
|--------|----------------------|-----|-------------------------------------------------------|
| POST   | `/games/manual`      | ✅   | Crear partida manual con configuración personalizada. |
| POST   | `/games/matchmaking` | ✅   | Unirse automáticamente a una partida disponible.      |

## 📚 Manual de Jugador de Navark - Guía de Flujos del Juego

### Flujo de conexión y acceso al juego

**1. Creación de una partida:**
- Ingresa a la página principal y selecciona "Crear partida manual".
- Configura las opciones de tu partida: número de jugadores (2-6), modo de juego (individual o equipos) y tamaño del tablero.
- Al confirmar, la partida quedará creada y tú serás el administrador (creador).

**2. Unirse a una partida:**
- Puedes unirte a una partida existente desde la lista disponible en la pantalla principal.
- También puedes usar "Unión automática" para que el sistema te encuentre una partida disponible.
- Al unirte, serás recibido en la sala de espera donde podrás ver a los demás jugadores.

**3. Preparación en la sala de espera:**
- Todos los jugadores deben marcar la casilla "Estoy listo" para que la partida pueda comenzar.
- Si estás en modo equipos, podrás seleccionar a qué equipo quieres unirte.
- El creador de la sala es el único que puede iniciar la partida cuando todos están listos.

**4. Transferencia de administración:**
- Si eres el creador de la sala y necesitas salir, puedes transferir el control a otro jugador.
- Solo selecciona "Transferir administración" y elige al jugador que tomará tu lugar.
- El nuevo administrador tendrá todos los permisos para iniciar la partida o realizar ajustes.

### Flujo de juego y sistema de turnos

**1. Inicio de la partida:**
- Cuando el administrador inicia la partida, el sistema distribuye aleatoriamente los barcos para todos los jugadores.
- El primer turno se asigna también de forma aleatoria a uno de los participantes.
- Cada jugador puede ver sus propios barcos y, en modo equipos, también los de sus compañeros.

**2. Realización de disparos:**
- Durante tu turno, tienes 30 segundos para seleccionar una casilla del tablero y disparar.
- Puedes elegir entre disparos normales (una casilla) o, si lo has desbloqueado, disparos nucleares (área de 3x3).
- Después de seleccionar la casilla, haz clic en "Disparar" para confirmar tu acción.

**3. Sistema de turnos con ventaja por acierto:**
- Si tu disparo acierta en un barco enemigo, mantienes el turno y puedes disparar nuevamente.
- Si fallas (el disparo cae en agua), el turno pasa automáticamente al siguiente jugador.
- Esta mecánica permite realizar disparos consecutivos mientras sigas acertando, lo que puede dar una ventaja estratégica importante.

**4. Sistema de arma nuclear:**
- Cuando aciertas 6 disparos normales consecutivos, desbloqueas el arma nuclear.
- El arma nuclear te permite disparar a un área de 3x3 casillas de una sola vez.
- Después de usar el arma nuclear, deberás volver a conseguir 6 aciertos para desbloquearla nuevamente.
- Si fallas un disparo normal en cualquier momento, tu progreso hacia el arma nuclear se reinicia a cero.

**5. Hundimiento de barcos:**
- Un barco se hunde cuando todas sus partes han sido impactadas.
- Cuando hundes un barco, recibirás una notificación especial y seguirás manteniendo el turno.
- Si un jugador pierde todos sus barcos, es eliminado automáticamente de la partida.

**6. Eliminación de jugadores:**
- Cuando se eliminan todos tus barcos, quedas fuera de la partida pero puedes permanecer como espectador.
- Si un jugador no realiza su acción durante 3 turnos consecutivos, es expulsado por inactividad.
- En modo equipos, tu equipo sigue en juego mientras al menos uno de los miembros tenga barcos.

**7. Victória y fin del juego:**
- En modo individual: gana el último jugador con barcos restantes.
- En modo equipos: gana el último equipo con al menos un barco en juego.
- Al finalizar la partida, se muestran estadísticas detalladas sobre disparos, aciertos y barcos hundidos.

### Reconexión y abandonos

**1. Reconexión automática:**
- Si pierdes la conexión durante una partida, puedes volver a entrar y el juego te reconectará automáticamente.
- Tu posición, barcos y progreso se mantienen intactos al reconectar.
- No perderás tu turno si te reconectas antes de que se agote el tiempo de espera.

**2. Abandono voluntario:**
- Si decides abandonar una partida en curso, selecciona "Abandonar partida".
- Al abandonar, no podrás volver a unirte a esa misma partida.
- Si eras el creador, el sistema asignará automáticamente a otro jugador como administrador.

**3. Partidas abandonadas:**
- Si todos los jugadores abandonan una partida, esta se elimina automáticamente.
- Las estadísticas de partidas abandonadas no se guardan en los registros de jugadores.
- El sistema libera los recursos para optimizar el rendimiento del servidor.

### 🛥️ Eventos del Cliente ➜ Servidor

| Evento              | Payload                      | Descripción                                     |
|---------------------|------------------------------|-------------------------------------------------|
| `player:join`       | `{ gameId, role? }`          | Unirse a una partida como jugador o espectador. |
| `player:ready`      | `{ gameId }`                 | Marcar al jugador como listo.                   |
| `player:chooseTeam` | `{ gameId, team }`           | Elegir equipo (modo por equipos).               |
| `player:leave`      | `{ gameId }`                 | Abandonar la partida.                           |
| `creator:transfer`  | `{ gameId, targetUserId }`   | Transferir la propiedad de creador de sala.     |
| `game:start`        | `{ gameId }`                 | Solicitar el inicio de la partida.              |
| `player:fire`       | `{ gameId, x, y, shotType }` | Ejecutar un disparo en una celda específica.    |

### 🛥️ Eventos del Servidor ➜ Cliente

#### Gestión de Sala y Conexiones

| Evento                 | Payload                                                  | Descripción                                      |
|------------------------|----------------------------------------------------------|--------------------------------------------------|
| `player:joined`        | `{ socketId }`                                           | Un jugador se ha unido a la sala.                |
| `player:joined:ack`    | `{ success, room?, createdById?, reconnected?, error? }` | Confirmación de unión como jugador.              |
| `spectator:joined:ack` | `{ success, room?, createdById?, reconnected?, error? }` | Confirmación de unión como espectador.           |
| `join:denied`          | `{ reason }`                                             | Rechazo de unión a la partida.                   |
| `player:left`          | `{ userId, nickname }`                                   | Un jugador ha salido de la partida.              |
| `creator:changed`      | `{ newCreatorUserId, newCreatorNickname }`               | Se ha asignado un nuevo creador de partida.      |
| `creator:transfer:ack` | `{ success, error? }`                                    | Confirmación de transferencia de rol de creador. |

#### Sistema de Turnos y Timeouts

| Evento          | Payload      | Descripción                                            |
|-----------------|--------------|--------------------------------------------------------|
| `turn:changed`  | `{ userId }` | Turno asignado a un nuevo jugador.                     |
| `turn:timeout`  | `{ userId }` | Jugador no disparó a tiempo (30 segundos).             |
| `player:kicked` | `{ reason }` | Jugador expulsado por inactividad (3 turnos perdidos). |

#### Disparos y Combate

| Evento              | Payload                              | Descripción                                        |
|---------------------|--------------------------------------|----------------------------------------------------|
| `player:fired`      | `{ shooterUserId, x, y, hit, sunk }` | Resultado de un disparo realizado.                 |
| `player:fire:ack`   | `{ success, hit?, sunk?, error? }`   | Confirmación individual del disparo.               |
| `player:eliminated` | `{ userId }`                         | Jugador eliminado por perder todos sus barcos.     |
| `nuclear:status`    | `{ progress, hasNuclear, used }`     | Estado del arma nuclear (6 aciertos consecutivos). |

#### Estado y Finalización

| Evento           | Payload                                        | Descripción                                  |
|------------------|------------------------------------------------|----------------------------------------------|
| `game:started`   | `{ gameId }`                                   | La partida ha comenzado oficialmente.        |
| `game:start:ack` | `{ success, error? }`                          | Confirmación de inicio de partida.           |
| `game:ended`     | `{ mode, winnerUserId?, winningTeam?, stats }` | Fin de partida con ganadores y estadísticas. |
| `game:abandoned` | `null`                                         | Partida eliminada por abandono total.        |
| `board:update`   | `{ board: { size, ships, shots, myShips } }`   | Estado actualizado del tablero personal.     |

#### Preparación y Sincronización

| Evento                | Payload                | Descripción                                    |
|-----------------------|------------------------|------------------------------------------------|
| `player:ready`        | `{ socketId }`         | Jugador marcado como listo.                    |
| `player:ready:ack`    | `{ success }`          | Confirmación de estado listo.                  |
| `player:ready:notify` | `{ socketId }`         | Notificación de jugador marcado como listo.    |
| `all:ready`           | `null`                 | Todos los jugadores están listos.              |
| `player:teamAssigned` | `{ socketId, team }`   | Equipo asignado a un jugador.                  |
| `player:reconnected`  | `{ userId, nickname }` | Jugador reconectado exitosamente.              |
| `reconnect:ack`       | `{ success }`          | Confirmación de reconexión.                    |
| `reconnect:failed`    | `{ reason }`           | Error en la reconexión.                        |
| `error`               | `{ message, code? }`   | Error general en operación solicitada.         |
| `heartbeat`           | `null`                 | Señal de latido para mantener conexión activa. |

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
