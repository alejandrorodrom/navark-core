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
| `/gateway/utils`      | Utilidades para Redis y gestión de partidas (`LobbyManagerService`, `RedisCleanerService`).  |

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

### Sistema de Eventos

El sistema de eventos WebSocket está organizado en los siguientes componentes principales:

1. **GameGateway**: Punto de entrada principal para todos los eventos WebSocket
2. **SocketServerAdapter**: Gestiona la emisión de eventos a clientes específicos o salas
3. **Handlers Especializados**:
  - `ConnectionHandler`: Gestión de conexiones/desconexiones
  - `JoinHandler`: Unión a partidas
  - `FireHandler`: Sistema de disparos
  - `LeaveHandler`: Abandonar partidas
  - `CreatorHandler`: Gestión del creador
  - `StartGameHandler`: Inicio de partida
  - `ReconnectHandler`: Reconexión de jugadores

4. **Servicios de Control**:
  - `TurnOrchestratorService`: Control de turnos y victoria
  - `TurnTimeoutService`: Gestión de timeouts (30s)
  - `PlayerEliminationService`: Eliminación de jugadores
  - `RedisCleanerService`: Limpieza de estados

### 🛥️ Eventos del Cliente ➜ Servidor

| Evento              | Payload                           | Descripción                                                  |
|---------------------|-----------------------------------|--------------------------------------------------------------|
| `player:join`       | `{ gameId, role }`                | Unirse a una partida como jugador o espectador.              |
| `player:ready`      | `{ gameId }`                      | Marcar al jugador como listo.                                |
| `player:chooseTeam` | `{ gameId, team }`                | Elegir equipo (modo por equipos).                            |
| `player:leave`      | `{ gameId }`                      | Abandonar la partida.                                        |
| `creator:transfer`  | `{ gameId, targetUserId }`        | Transferir la propiedad de creador de sala.                  |
| `game:start`        | `{ gameId }`                      | Solicitar el inicio de la partida.                           |
| `player:fire`       | `{ gameId, x, y, shotType }`      | Ejecutar un disparo en una celda específica.                 |

### 🛥️ Eventos del Servidor ➜ Cliente

#### Gestión de Sala y Conexiones
| Evento                 | Payload                                           | Descripción                                                   |
|------------------------|---------------------------------------------------|---------------------------------------------------------------|
| `player:joined`        | `{ socketId }`                                    | Un jugador se ha unido a la sala.                             |
| `player:joined:ack`    | `{ success, room, createdById, reconnected? }`    | Confirmación de unión como jugador.                           |
| `spectator:joined:ack` | `{ success, room, createdById, reconnected? }`    | Confirmación de unión como espectador.                        |
| `join:denied`          | `{ reason }`                                      | Rechazo de unión a la partida.                                |
| `player:left`          | `{ userId, nickname }`                            | Un jugador ha salido de la partida.                           |
| `creator:changed`      | `{ newCreatorUserId, newCreatorNickname }`        | Se ha asignado un nuevo creador de partida.                   |

#### Sistema de Turnos y Timeouts
| Evento                 | Payload                                           | Descripción                                                   |
|------------------------|---------------------------------------------------|---------------------------------------------------------------|
| `turn:changed`         | `{ userId }`                                      | Turno asignado a un nuevo jugador.                            |
| `turn:timeout`         | `{ userId }`                                      | Jugador no disparó a tiempo (30 segundos).                    |
| `player:kicked`        | `{ reason }`                                      | Jugador expulsado por inactividad (3 turnos perdidos).        |

#### Disparos y Combate
| Evento                 | Payload                                           | Descripción                                                   |
|------------------------|---------------------------------------------------|---------------------------------------------------------------|
| `player:fired`         | `{ shooterUserId, x, y, hit, sunk }`              | Resultado de un disparo realizado.                            |
| `player:fire:ack`      | `{ success, hit, sunk }`                          | Confirmación individual del disparo.                          |
| `player:eliminated`    | `{ userId }`                                      | Jugador eliminado por perder todos sus barcos.                |
| `nuclear:status`       | `{ progress, hasNuclear, used }`                  | Estado del arma nuclear (6 aciertos consecutivos).            |

#### Estado y Finalización
| Evento                 | Payload                                           | Descripción                                                   |
|------------------------|---------------------------------------------------|---------------------------------------------------------------|
| `game:started`         | `{ gameId }`                                      | La partida ha comenzado oficialmente.                         |
| `game:ended`           | `{ mode, winnerUserId?, winningTeam?, stats }`    | Fin de partida con ganadores y estadísticas.                  |
| `game:abandoned`       | `N/A`                                             | Partida eliminada por abandono total.                         |
| `board:update`         | `{ board: { size, ships, shots, myShips } }`      | Estado actualizado del tablero personal.                      |

#### Preparación y Sincronización
| Evento                 | Payload                                           | Descripción                                                   |
|------------------------|---------------------------------------------------|---------------------------------------------------------------|
| `player:ready`         | `{ socketId }`                                    | Jugador marcado como listo.                                   |
| `player:ready:ack`     | `{ success }`                                     | Confirmación de estado listo.                                 |
| `all:ready`            | `N/A`                                             | Todos los jugadores están listos.                             |
| `player:teamAssigned`  | `{ socketId, team }`                              | Equipo asignado a un jugador.                                |
| `player:reconnected`   | `{ userId, nickname }`                            | Jugador reconectado exitosamente.                             |
| `reconnect:ack`        | `{ success }`                                     | Confirmación de reconexión.                                   |
| `reconnect:failed`     | `{ reason }`                                      | Error en la reconexión.                                       |

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
```
