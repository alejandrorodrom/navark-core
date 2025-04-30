# Navark Core - Backend

**Navark Core** es el backend oficial del juego multijugador de batalla naval **Navark**, desarrollado con **NestJS**, **Prisma ORM**, **PostgreSQL**, **Socket.IO** y **Redis**, siguiendo arquitectura hexagonal para una separación estricta de responsabilidades.

---

## 🚀 Tecnologías principales

- **NestJS** (WebSocket Gateway + HTTP API)
- **Socket.IO** (Servidor WebSocket en tiempo real)
- **Prisma ORM + PostgreSQL** (Persistencia de datos estructurada)
- **Redis** (Sincronización de estados en memoria: turnos, jugadores, equipos, disparos nucleares)
- **Arquitectura Hexagonal** (`domain` / `application` / `infrastructure`)

---

## 🔥 Funcionalidades principales

- Partidas multijugador con **2 a 6 jugadores**.
- Modos de juego:
  - **Individual** (todos contra todos)
  - **Por equipos** (configurables)
- **Sistema de turnos** con límite de **30 segundos** por jugador.
- **Sistema nuclear**: desbloqueado tras **6 aciertos consecutivos** con disparos simples.
- **Expulsión automática** por inactividad (3 turnos).
- **Reconexión automática**: permite volver a la partida si no fue eliminada.
- **Reasignación automática de creador** al abandonar.
- **Modo espectador**: permite unirse como observador sin participar.
- **Eliminación automática** al perder todos los barcos.
- **Soporte híbrido de usuarios**: registrados e invitados.
- **Estadísticas completas por jugador** al finalizar la partida.

---

## 📂 Estructura del proyecto

| Carpeta               | Propósito                                                                 |
|-----------------------|---------------------------------------------------------------------------|
| `/application`        | Lógica de negocio: creación, disparos, control de turnos, reconexión.     |
| `/domain`             | Modelos del dominio (`Board`, `Shot`, `Ship`, etc.).                      |
| `/infrastructure`     | Adaptadores externos: Prisma, Redis, Gateway WebSocket.                   |
| `/gateway/handlers`   | Handlers de eventos WebSocket (`player:join`, `player:fire`, etc.).       |
| `/gateway/redis`      | Servicios Redis para sincronización de estado (`ready`, `turn`, `team`, etc.). |
| `/gateway/utils`      | Utilidades para Redis y gestión de partidas (`GameUtils`, `RedisUtils`).  |

---

## 📆 Endpoints HTTP

### 🛡️ Autenticación (`/auth`)

| Método | Ruta             | JWT | Descripción                                 |
|--------|------------------|-----|---------------------------------------------|
| POST   | `/auth/guest`    | ❌  | Crear sesión como invitado.                 |
| POST   | `/auth/identify` | ❌  | Identificar usuario registrado o nuevo.     |
| POST   | `/auth/refresh`  | ❌  | Renovar `access_token`.                     |
| GET    | `/auth/me`       | ✅  | Obtener datos del usuario actual.           |
| PATCH  | `/auth/me`       | ✅  | Actualizar perfil del usuario.              |

### 🎮 Partidas (`/games`)

| Método | Ruta                | JWT | Descripción                                             |
|--------|---------------------|-----|---------------------------------------------------------|
| POST   | `/games/manual`     | ✅  | Crear partida manual con configuración personalizada.   |
| POST   | `/games/matchmaking`| ✅  | Unirse automáticamente a una partida disponible.        |

---

## 📚 Eventos WebSocket

### 🛥️ Eventos del Cliente ➜ Servidor

| Evento              | Payload                           | Descripción                                                  |
|---------------------|-----------------------------------|--------------------------------------------------------------|
| `player:join`       | `{ gameId, role }`                | Unirse a una partida como jugador o espectador.              |
| `player:ready`      | `{ gameId }`                      | Marcar al jugador como listo.                                |
| `player:chooseTeam` | `{ gameId, team }`                | Elegir equipo (modo por equipos).                            |
| `player:leave`      | `{ gameId }`                      | Abandonar la partida.                                        |
| `creator:transfer`  | `{ gameId, newCreatorUserId }`    | Transferir la propiedad de creador de sala.                  |
| `game:start`        | `{ gameId }`                      | Solicitar el inicio de la partida.                           |
| `player:fire`       | `{ gameId, x, y, shotType }`      | Ejecutar un disparo en una celda específica.                 |

### 🛥️ Eventos del Servidor ➜ Cliente

| Evento                 | Payload                                           | Tipo       | Descripción                                                   |
|------------------------|---------------------------------------------------|------------|---------------------------------------------------------------|
| `player:joined`        | `{ socketId }`                                    | Broadcast  | Un jugador se ha unido a la sala.                             |
| `player:joined:ack`    | `{ success, room, createdById, reconnected? }`    | Individual | Confirmación de unión como jugador.                           |
| `spectator:joined:ack` | `{ success, room, createdById, reconnected? }`    | Individual | Confirmación de unión como espectador.                        |
| `join:denied`          | `{ reason }`                                      | Individual | Rechazo de unión a la partida.                                |
| `player:ready`         | `{ socketId }`                                    | Broadcast  | Un jugador se ha marcado como listo.                          |
| `player:ready:ack`     | `{ success }`                                     | Individual | Confirmación del cambio de estado a listo.                    |
| `all:ready`            | `N/A`                                             | Broadcast  | Todos los jugadores están listos.                             |
| `player:teamAssigned`  | `{ socketId, team }`                              | Broadcast  | Asignación de equipo a un jugador.                            |
| `player:left`          | `{ userId, nickname }`                            | Broadcast  | Un jugador ha salido de la partida.                           |
| `creator:changed`      | `{ newCreatorUserId, newCreatorNickname }`        | Broadcast  | Se ha asignado un nuevo creador de partida.                  |
| `game:start:ack`       | `{ success, error? }`                             | Individual | Confirmación del inicio o error.                              |
| `game:started`         | `{ gameId }`                                      | Broadcast  | La partida ha comenzado oficialmente.                         |
| `turn:changed`         | `{ userId }`                                      | Broadcast  | Turno asignado a un nuevo jugador.                            |
| `player:fired`         | `{ shooterUserId, x, y, hit, sunk }`              | Broadcast  | Resultado de un disparo emitido.                              |
| `player:fire:ack`      | `{ success, hit, sunk }`                          | Individual | Confirmación del disparo.                                     |
| `player:eliminated`    | `{ userId }`                                      | Broadcast  | Un jugador ha sido eliminado (sin barcos).                    |
| `nuclear:status`       | `{ progress, hasNuclear, used }`                  | Individual | Estado del disparo nuclear del jugador.                       |
| `turn:timeout`         | `{ userId }`                                      | Broadcast  | Un jugador no disparó a tiempo y fue penalizado.              |
| `player:kicked`        | `{ reason }`                                      | Individual | Jugador fue expulsado automáticamente por inactividad.        |
| `game:ended`           | `{ mode, winnerUserId?, winningTeam?, stats }`    | Broadcast  | Final de partida con detalle de ganadores y estadísticas.     |
| `game:abandoned`       | `N/A`                                             | Broadcast  | La partida fue eliminada por abandono total.                  |
| `player:reconnected`   | `{ userId, nickname }`                            | Broadcast  | Un jugador reconectó correctamente.                           |
| `reconnect:ack`        | `{ success }`                                     | Individual | Reconexión exitosa confirmada.                                |
| `reconnect:failed`     | `{ reason }`                                      | Individual | Error de reconexión, se debe reingresar.                      |
| `board:update`         | `{ board: { size, ships, shots, myShips } }`      | Individual | Estado completo del tablero personal del jugador.             |

---

## 🧪 Instalación y ejecución local

```bash
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
