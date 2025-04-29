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
|:--------|:----------|
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
|:------|:-----|:--------------|:------------|
| `POST` | `/auth/guest` | ❌ | Crear sesión como invitado. |
| `POST` | `/auth/identify` | ❌ | Identificar usuario registrado o nuevo. |
| `POST` | `/auth/refresh` | ❌ | Renovar `access_token`. |
| `GET` | `/auth/me` | ✅ | Obtener datos del usuario actual. |
| `PATCH` | `/auth/me` | ✅ | Actualizar perfil del usuario actual. |

### 🎮 Gestión de partidas (`/games`)

| Método | Ruta | Requiere JWT | Descripción |
|:------|:-----|:--------------|:------------|
| `POST` | `/games/manual` | ✅ | Crear partida manual especificando opciones. |
| `POST` | `/games/matchmaking` | ✅ | Buscar y unirse automáticamente a partida rápida disponible. |

---

## 📚 Eventos WebSocket

### 🛥️ Eventos enviados por el **Frontend** ➔ **Servidor**

| Evento | Datos enviados | Descripción |
|:-------|:----------------|:------------|
| `player:join` | `gameId`, `role` | Solicitar unirse como jugador o espectador. |
| `player:ready` | `gameId` | Marcar jugador como listo. |
| `player:chooseTeam` | `gameId`, `team` | Seleccionar equipo en modo equipos. |
| `player:leave` | `gameId` | Abandonar voluntariamente la partida. |
| `creator:transfer` | `gameId`, `newCreatorUserId` | Transferir rol de creador a otro jugador. |
| `game:start` | `gameId` | Solicitar inicio de partida si todos están listos. |
| `player:fire` | `gameId`, `x`, `y`, `shotType` | Realizar disparo (simple, cross, multi, area, scan, nuclear). |

### 🛥️ Eventos enviados por el **Servidor** ➔ **Frontend**

| Evento | Datos enviados | Tipo de envío | Descripción |
|:-------|:---------------|:--------------|:------------|
| `player:joined` | `socketId` | Broadcast | Un nuevo jugador se unió. |
| `player:joined:ack` | `{ success, room, createdById }` | Individual | Confirmación de unión exitosa. |
| `spectator:joined:ack` | `{ success, room, createdById }` | Individual | Confirmación de unión como espectador. |
| `join:denied` | `{ reason }` | Individual | Motivo de rechazo de unión. |
| `player:ready` | `socketId` | Broadcast | Jugador marcado como listo. |
| `player:ready:ack` | `{ success }` | Individual | Confirmación de jugador listo. |
| `all:ready` | N/A | Broadcast | Todos los jugadores están listos. |
| `player:teamAssigned` | `{ socketId, team }` | Broadcast | Jugador asignado a un equipo. |
| `player:left` | `{ userId, nickname }` | Broadcast | Un jugador abandonó. |
| `creator:changed` | `{ newCreatorUserId, newCreatorNickname }` | Broadcast | Se asignó nuevo creador. |
| `game:start:ack` | `{ success, error? }` | Individual | Resultado de intento de inicio de partida. |
| `game:started` | `{ gameId }` | Broadcast | Partida iniciada oficialmente. |
| `turn:changed` | `{ userId }` | Broadcast | Nuevo jugador en turno. |
| `player:fired` | `{ shooterUserId, x, y, hit, sunk }` | Broadcast | Resultado del disparo. |
| `player:fire:ack` | `{ success, hit, sunk }` | Individual | Confirmación disparo enviado correctamente. |
| `player:eliminated` | `{ userId }` | Broadcast | Jugador eliminado de la partida. |
| `nuclear:status` | `{ progress, hasNuclear, used }` | Individual | Estado del progreso para desbloquear nuclear. |
| `turn:timeout` | `{ userId }` | Broadcast | Jugador perdió turno por inactividad. |
| `player:kicked` | `{ reason }` | Individual | Jugador expulsado por inactividad. |
| `game:ended` | `{ mode, winnerUserId? | winningTeam? }` | Broadcast | Final de partida con ganador o equipo ganador. |
| `game:abandoned` | N/A | Broadcast | Partida eliminada por quedar vacía. |

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
```

