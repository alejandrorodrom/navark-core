# Navark Core - Backend

**Navark Core** es el backend oficial del juego multijugador de batalla naval **Navark**, desarrollado con **NestJS**, **Prisma ORM**, **PostgreSQL**, **Socket.IO** y **Redis**, siguiendo **arquitectura hexagonal** para una separación estricta de responsabilidades.

---

## 🚀 Tecnologías principales

- **NestJS** (WebSocket Gateway + HTTP API)
- **Socket.IO** (Servidor WebSocket en tiempo real)
- **Prisma ORM + PostgreSQL** (Persistencia de datos estructurada)
- **Redis** (Sincronización en memoria: turnos, jugadores, equipos, disparos nucleares)
- **Arquitectura Hexagonal** (Separación estricta: `domain` / `application` / `infrastructure`)

---

## 🔥 Funcionalidades principales

- Partidas multijugador de **2 a 6 jugadores** simultáneos.
- Modos de juego:
  - **Individual** (todos contra todos).
  - **Por equipos** (hasta **3 equipos** configurables).
- **Sistema de turnos** con límite de **30 segundos** por acción.
- **Sistema nuclear**:
  - Desbloquea **bomba nuclear** tras **6 aciertos consecutivos** con disparos simples.
- **Sistema de expulsión automática**:
  - Jugadores inactivos por **3 turnos** consecutivos son expulsados.
- **Reconexión automática**:
  - Jugadores desconectados pueden reincorporarse si no han sido eliminados.
- **Reasignación de creador**:
  - Si el creador abandona, se asigna un nuevo líder automáticamente.
- **Modo espectador**:
  - Observadores pueden unirse a partidas en progreso.
- **Sistema de eliminación**:
  - Un jugador es eliminado si **todos sus barcos** son destruidos.
- **Sistema híbrido de usuarios**:
  - **Usuarios registrados** y **usuarios invitados** comparten partidas.

---

## 📂 Estructura principal del proyecto

| Carpeta | Propósito |
|--------|-----------|
| `/application` | Lógica de aplicación: servicios como creación de partidas, disparo, control de turnos. |
| `/domain` | Modelos de dominio (`Board`, `Ship`, `Shot`, `Difficulty`, `Mode`, `ShotType`). |
| `/infrastructure` | Adaptadores externos: Prisma ORM, Redis Services, WebSocket Gateway. |
| `/gateway/handlers` | Handlers de eventos WebSocket (`player:join`, `player:fire`, `game:start`, etc.). |
| `/gateway/redis` | Servicios de Redis para estados de juego (ready, turn, team, nuclear, player state). |
| `/gateway/utils` | Utilidades de Redis y Socket.IO (`GameUtils`, `RedisUtils`). |

---

## 📆 Endpoints HTTP disponibles

### 🛡️ Autenticación (`/auth`)

| Método | Ruta | Requiere JWT | Descripción |
|--------|------|--------------|-------------|
| `POST` | `/auth/guest` | ❌ | Crear sesión como invitado. |
| `POST` | `/auth/identify` | ❌ | Identificar usuario registrado o nuevo. |
| `POST` | `/auth/refresh` | ❌ | Renovar `access_token`. |
| `GET`  | `/auth/me` | ✅ | Obtener datos del usuario actual. |
| `PATCH`| `/auth/me` | ✅ | Actualizar perfil del usuario actual. |

### 🎮 Gestión de partidas (`/games`)

| Método | Ruta | Requiere JWT | Descripción |
|--------|------|--------------|-------------|
| `POST` | `/games/manual` | ✅ | Crear partida manual especificando opciones. |
| `POST` | `/games/matchmaking` | ✅ | Buscar y unirse automáticamente a partida rápida disponible. |

---

## 📚 Eventos WebSocket

### 🛥️ Eventos enviados por el **Frontend** ➔ **Servidor**

| Evento | Datos enviados | Descripción |
|--------|----------------|-------------|
| `player:join` | `{ gameId, role }` | Unirse a una partida como jugador o espectador. |
| `player:ready` | `{ gameId }` | Marcar jugador como listo para iniciar. |
| `player:chooseTeam` | `{ gameId, team }` | Seleccionar equipo en modo de juego por equipos. |
| `player:leave` | `{ gameId }` | Salir voluntariamente de la partida. |
| `creator:transfer` | `{ gameId, newCreatorUserId }` | Transferir el rol de creador a otro jugador. |
| `game:start` | `{ gameId }` | Solicitar inicio oficial de la partida. |
| `player:fire` | `{ gameId, x, y, shotType }` | Realizar disparo en una posición específica. |

### 🛥️ Eventos enviados por el **Servidor** ➔ **Frontend**

| Evento | Datos enviados | Tipo de envío | Descripción |
|--------|----------------|----------------|-------------|
| `player:joined` | `{ socketId }` | Broadcast | Nuevo jugador se unió a la partida. |
| `player:joined:ack` | `{ success, room, createdById, reconnected? }` | Individual | Confirmación de unión del jugador. |
| `spectator:joined:ack` | `{ success, room, createdById, reconnected? }` | Individual | Confirmación de unión como espectador. |
| `join:denied` | `{ reason }` | Individual | Unión rechazada con mensaje. |
| `player:ready` | `{ socketId }` | Broadcast | Jugador marcado como listo. |
| `player:ready:ack` | `{ success }` | Individual | Confirmación de estado "listo". |
| `all:ready` | N/A | Broadcast | Todos los jugadores están listos. |
| `player:teamAssigned` | `{ socketId, team }` | Broadcast | Jugador asignado a un equipo. |
| `player:left` | `{ userId, nickname }` | Broadcast | Jugador abandonó la partida. |
| `creator:changed` | `{ newCreatorUserId, newCreatorNickname }` | Broadcast | Nuevo creador asignado automáticamente. |
| `game:start:ack` | `{ success, error? }` | Individual | Resultado de la solicitud de inicio. |
| `game:started` | `{ gameId }` | Broadcast | Partida oficialmente iniciada. |
| `turn:changed` | `{ userId }` | Broadcast | Es turno de un nuevo jugador. |
| `player:fired` | `{ shooterUserId, x, y, hit, sunk }` | Broadcast | Resultado del disparo. |
| `player:fire:ack` | `{ success, hit, sunk }` | Individual | Confirmación del disparo del jugador. |
| `player:eliminated` | `{ userId }` | Broadcast | Jugador eliminado de la partida. |
| `nuclear:status` | `{ progress, hasNuclear, used }` | Individual | Estado del disparo nuclear del jugador. |
| `turn:timeout` | `{ userId }` | Broadcast | Jugador perdió su turno por inactividad. |
| `player:kicked` | `{ reason }` | Individual | Jugador expulsado automáticamente. |
| `game:ended` | `{ mode, winnerUserId?, winningTeam? }` | Broadcast | Fin de partida con ganador. |
| `game:abandoned` | N/A | Broadcast | La partida fue eliminada por quedar vacía. |
| `player:reconnected` | `{ userId, nickname }` | Broadcast | Jugador reconectado exitosamente. |
| `reconnect:ack` | `{ success }` | Individual | Confirmación de reconexión exitosa. |
| `reconnect:failed` | `{ reason }` | Individual | Reconexión fallida, requiere nuevo `join`. |
| `board:update` | `{ board: { size, ships, shots, myShips } }` | Individual | Estado completo del tablero del jugador. |

---

## 🔧 Instalación y ejecución local

```bash
# Clonar el proyecto
git clone https://github.com/tu-usuario/navark-core.git
cd navark-core

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env

# Aplicar migraciones Prisma
npx prisma migrate dev

# Levantar el servidor en modo desarrollo
npm run start:dev
