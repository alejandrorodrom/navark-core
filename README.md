# Navark Core - Backend

**Navark Core** es el backend oficial del juego multijugador de batalla naval **Navark**, desarrollado con **NestJS**, **Prisma ORM** y **PostgreSQL**, usando **Socket.IO** para comunicación en tiempo real.

Gestiona partidas multijugador, control de turnos, disparos, reconexión de jugadores, modos individuales y por equipos, sistema nuclear, y ranking competitivo.

---

## 🚀 Tecnologías principales

- **NestJS** (WebSocket Gateway + HTTP API)
- **Socket.IO** (Servidor WebSocket)
- **Prisma ORM + PostgreSQL** (Persistencia de datos)
- **Redis** (Sincronización de estados: turnos, nuclear, jugadores)
- **Arquitectura Hexagonal** (Separación estricta entre dominio, aplicación e infraestructura)

---

## 🔥 Funcionalidades principales

- Partidas multijugador de **2 a 6 jugadores**.
- Modos de juego: **individual** y **por equipos** (hasta 3 equipos).
- **Sistema de turnos** con temporizador (**30 segundos** por turno).
- **Sistema nuclear**: desbloquea un disparo especial tras **6 aciertos consecutivos**.
- **Expulsión automática** tras **3 turnos fallidos**.
- **Sistema híbrido** de usuarios: invitados y registrados.
- **Reconexión automática** de jugadores desconectados.
- **Reasignación automática** del creador si abandona.
- **Modo espectador** en partidas públicas.
- **Sistema de eliminación por hundimiento de barcos**.

---

## 📂 Estructura principal del código

| Carpeta | Propósito |
|:--------|:----------|
| `/application` | Lógica de aplicación (servicios de negocio: crear partidas, disparar, matchmaking). |
| `/domain` | Modelos y contratos de dominio (`Board`, `Ship`, `Difficulty`, `Mode`). |
| `/infrastructure` | Adaptadores externos: Prisma (DB), Redis, HTTP Controllers, WebSocket Gateway. |
| `/gateway/handlers` | Handlers WebSocket específicos (`player:join`, `player:fire`, `start:game`, etc.). |
| `/gateway/utils` | Utilidades compartidas (`GameUtils`, `RedisUtils`). |
| `/gateway/redis` | Servicios para estados de Redis (turnos, equipos, nuclear, abandonos). |

---

## 📆 Endpoints HTTP disponibles

### 🛡️ Autenticación (`/auth`)

| Método | Ruta | Autenticación | Descripción |
|:------|:-----|:--------------|:------------|
| `POST` | `/auth/guest` | ❌ No requiere | Crear sesión como invitado. |
| `POST` | `/auth/identify` | ❌ No requiere | Identificar o registrar usuario. |
| `POST` | `/auth/refresh` | ❌ No requiere | Renovar access token. |
| `GET` | `/auth/me` | ✅ Requiere JWT | Obtener perfil del usuario autenticado. |
| `PATCH` | `/auth/me` | ✅ Requiere JWT | Actualizar perfil del usuario autenticado. |

### 🎮 Gestión de partidas (`/games`)

| Método | Ruta | Autenticación | Descripción |
|:------|:-----|:--------------|:------------|
| `POST` | `/games/manual` | ✅ Requiere JWT | Crear una partida manual. |
| `POST` | `/games/matchmaking` | ✅ Requiere JWT | Buscar y unirse a partida rápida. |

---

## 📚 Eventos WebSocket

### 🛅 Eventos Frontend ➜ Servidor

| Evento | Envía | Descripción |
|:-------|:------|:------------|
| `player:join` | Jugador | Solicita unirse a una partida. |
| `player:ready` | Jugador | Marca al jugador como listo. |
| `player:chooseTeam` | Jugador | Selecciona equipo (modo teams). |
| `player:leave` | Jugador | Sale de la partida. |
| `creator:transfer` | Creador actual | Transferir rol de creador a otro jugador. |
| `game:start` | Creador actual | Solicita iniciar la partida. |
| `player:fire` | Jugador | Realiza un disparo (tipos: `simple`, `cross`, `multi`, `area`, `scan`, `nuclear`). |

### 🛅 Eventos Servidor ➜ Frontend

| Evento | Recibe | Tipo de envío | Descripción |
|:-------|:------|:--------------|:------------|
| `player:joined` | Todos en sala | Broadcast | Nuevo jugador unido. |
| `player:joined:ack` | Jugador | Individual | Confirmación de unión exitosa. |
| `spectator:joined:ack` | Espectador que se une | Individual | Confirmación de unión como espectador. |
| `join:denied` | Jugador que falló | Individual | Unión rechazada. |
| `player:ready` | Todos en sala | Broadcast | Jugador marcado "listo". |
| `player:ready:ack` | Jugador | Individual | Confirmación de "listo". |
| `all:ready` | Todos en sala | Broadcast | Todos están listos. |
| `player:teamAssigned` | Todos en sala | Broadcast | Jugador asignado a equipo. |
| `player:left` | Todos en sala | Broadcast | Jugador abandonó. |
| `creator:changed` | Todos en sala | Broadcast | Cambio de creador. |
| `game:start:ack` | Jugador | Individual | Resultado de intento de inicio. |
| `game:started` | Todos en sala | Broadcast | Partida iniciada. |
| `turn:changed` | Todos en sala | Broadcast | Nuevo turno asignado. |
| `player:fired` | Todos en sala | Broadcast | Resultado de disparo (`hit`, `sunk`). |
| `player:fire:ack` | Jugador | Individual | Confirmación disparo realizado. |
| `player:eliminated` | Todos en sala | Broadcast | Jugador eliminado (todos sus barcos hundidos). |
| `nuclear:status` | Jugador | Individual | Estado progreso nuclear (desbloqueo). |
| `turn:timeout` | Todos en sala | Broadcast | Jugador perdió turno por inactividad. |
| `player:kicked` | Jugador | Individual | Jugador expulsado tras 3 turnos fallidos. |
| `game:ended` | Todos en sala | Broadcast | Final de partida (ganador o equipo ganador). |
| `game:abandoned` | Todos en sala | Broadcast | Partida eliminada (vacía). |

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

# Levantar el servidor
npm run start:dev
```
