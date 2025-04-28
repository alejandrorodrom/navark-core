# Navark Core - Backend

**Navark Core** es el backend oficial del juego multijugador de batalla naval **Navark**, desarrollado con **NestJS**, **Prisma ORM** y **PostgreSQL**, usando **Socket.IO** para comunicación en tiempo real.

Gestiona partidas, control de turnos, reconexión de jugadores, modos individuales y por equipos, y ranking competitivo.

---

## 🚀 Tecnologías principales

- **NestJS** (WebSocket Gateway + HTTP API)
- **Socket.IO** (Servidor WebSocket)
- **Prisma ORM + PostgreSQL** (Persistencia de datos)
- **Redis** (Sincronización de estado en tiempo real)
- **Arquitectura hexagonal** (Separación de capas limpia)

---

## 🔥 Funcionalidades principales

- Partidas multijugador de **2 a 6 jugadores**.
- Modos de juego: **individual** y **por equipos** (hasta 3 equipos).
- **Sistema de turnos** con temporizador (**30 segundos** por jugador).
- **Sistema nuclear**: desbloquea un disparo especial tras **6 aciertos**.
- **Expulsión automática** por inactividad (**3 turnos perdidos**).
- **Reconexión** automática y **reasignación de creador** si es necesario.
- **Sistema híbrido de usuarios** (invitados y registrados).
- Soporte para **modo espectador**.

---

## 📂 Estructura principal del código

| Carpeta | Propósito |
|:--------|:---------|
| `/application` | Servicios de aplicación y flujo de negocio (creación de partidas, matchmaking). |
| `/domain` | Entidades y contratos de dominio. |
| `/infrastructure` | Adaptadores: Prisma Repository, Redis services, HTTP Controller, WebSocket Gateway. |
| `/gateway/handlers` | Handlers individuales por evento WebSocket (`player:join`, `player:fire`, `game:start`, etc.). |
| `/gateway/utils` | Utilidades compartidas (manejo de Redis, lógica de salas Socket.IO). |
| `/gateway/redis` | Control granular de estado en Redis (turnos, jugadores listos, progreso nuclear, etc.). |

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
| `POST` | `/games/matchmaking` | ✅ Requiere JWT | Unirse a una partida por matchmaking. |

---

## 📚 Eventos WebSocket

### 🛅 Eventos Frontend ➜ Servidor

| Evento | Envía | Descripción |
|:-------|:------|:------------|
| `player:join` | Jugador | Solicita unirse a una partida. |
| `player:ready` | Jugador | Marca al jugador como listo. |
| `player:chooseTeam` | Jugador | Selecciona equipo en partidas por equipos. |
| `player:leave` | Jugador | Abandona la partida. |
| `creator:transfer` | Creador actual | Transferencia manual del rol de creador. |
| `game:start` | Creador actual | Solicita iniciar la partida. |
| `player:fire` | Jugador | Realiza un disparo (tipos: `simple`, `cross`, `multi`, `area`, `scan`, `nuclear`). |

### 🛅 Eventos Servidor ➜ Frontend

| Evento | Recibe | Tipo de envío | Descripción |
|:-------|:------|:----------------|:------------|
| `player:joined` | Todos en sala | Broadcast | Un jugador se une. |
| `player:joined:ack` | Jugador que envió | Individual | Confirmación de unión exitosa. |
| `spectator:joined:ack` | Espectador que se une | Individual | Confirmación de unión como espectador. |
| `join:denied` | Jugador que falló | Individual | Unión rechazada. |
| `player:ready` | Todos en sala | Broadcast | Un jugador marcó "listo". |
| `player:ready:ack` | Jugador que envió | Individual | Confirmación de "listo". |
| `all:ready` | Todos en sala | Broadcast | Todos están listos. |
| `player:teamAssigned` | Todos en sala | Broadcast | Un jugador seleccionó equipo. |
| `player:left` | Todos en sala | Broadcast | Un jugador abandonó la partida. |
| `creator:changed` | Todos en sala | Broadcast | Cambio de creador. |
| `game:start:ack` | Jugador que intentó iniciar | Individual | Resultado de intento de inicio. |
| `game:started` | Todos en sala | Broadcast | Inicio oficial de la partida. |
| `turn:changed` | Todos en sala | Broadcast | Cambio de turno. |
| `player:fired` | Todos en sala | Broadcast | Disparo ejecutado. |
| `player:fire:ack` | Jugador que disparó | Individual | Confirmación de disparo (hit/miss). |
| `nuclear:status` | Jugador | Individual | Estado del sistema nuclear. |
| `turn:timeout` | Todos en sala | Broadcast | Jugador perdió turno por inactividad. |
| `player:kicked` | Jugador expulsado | Individual | Expulsión automática. |
| `game:ended` | Todos en sala | Broadcast | Fin de partida. |
| `game:abandoned` | Todos en sala | Broadcast | Partida eliminada por quedar vacía. |

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
yarn start:dev
```
