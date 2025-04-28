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
| `/gateway/handlers` | Handlers individuales por evento WebSocket (player:join, player:fire, game:start, etc.). |
| `/gateway/utils` | Utilidades compartidas (manejo de Redis, salas Socket.IO). |
| `/gateway/redis` | Control granular de estado en Redis (turnos, jugadores listos, progreso nuclear, etc.). |

---

## 📚 Eventos WebSocket

### Eventos Frontend ➜ Servidor

| Evento | Envía | Descripción |
|:-------|:------|:------------|
| `player:join` | Jugador | Solicita unirse a una partida. |
| `player:ready` | Jugador | Marca al jugador como listo. |
| `player:chooseTeam` | Jugador | Selecciona equipo en partidas por equipos. |
| `player:leave` | Jugador | Abandona la partida. |
| `creator:transfer` | Creador actual | Transferencia manual del rol de creador a otro jugador. |
| `game:start` | Creador actual | Solicita iniciar la partida. |
| `player:fire` | Jugador | Realiza un disparo. Tipos de `shotType`: `simple`, `cross`, `multi`, `area`, `scan`, `nuclear`. |

### Eventos Servidor ➜ Frontend

| Evento | Recibe | Tipo de envío | Descripción |
|:-------|:------|:----------------|:------------|
| `player:joined` | Todos en sala | Broadcast | Un jugador se une. |
| `player:joined:ack` | Jugador que envió | Individual | Confirmación de unirse a la sala. |
| `player:ready` | Todos en sala | Broadcast | Un jugador se declara listo. |
| `player:ready:ack` | Jugador que envió | Individual | Confirmación de "listo" propio. |
| `all:ready` | Todos en sala | Broadcast | Todos los jugadores están listos. |
| `player:teamAssigned` | Todos en sala | Broadcast | Un jugador seleccionó un equipo. |
| `player:left` | Todos en sala | Broadcast | Un jugador abandonó la partida. |
| `creator:changed` | Todos en sala | Broadcast | El creador fue reasignado (manual o automático). |
| `game:start:ack` | Jugador que envió | Individual | Resultado del intento de iniciar la partida. |
| `game:started` | Todos en sala | Broadcast | La partida comenzó oficialmente. |
| `turn:changed` | Todos en sala | Broadcast | Cambio de turno a otro jugador. |
| `player:fired` | Todos en sala | Broadcast | Un disparo fue ejecutado. |
| `player:fire:ack` | Jugador que disparó | Individual | Confirmación de disparo propio. |
| `nuclear:status` | Jugador | Individual | Actualización de progreso nuclear. |
| `turn:timeout` | Todos en sala | Broadcast | Turno perdido por inactividad. |
| `player:kicked` | Jugador expulsado | Individual | Expulsión por 3 turnos fallidos. |
| `game:ended` | Todos en sala | Broadcast | Fin de partida y resultados. |
| `game:abandoned` | Todos en sala | Broadcast | Partida eliminada por quedarse vacía. |

---

## 🔧 🛠️ Instalación y ejecución local

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

---

## 🛡️ Seguridad y control de estado

- El control de turnos, disparos, desbloqueos nucleares y tiempos límites se realiza **exclusivamente en backend**.
- Redis administra:
  - Jugadores listos (`ready`).
  - Equipos asignados (`teams`).
  - Turno actual (`turn`).
  - Progreso nuclear (`nuclear`).
  - Jugadores abandonados (`abandoned`).

El frontend **no puede alterar** estados críticos de la partida.

---

## 📄 Licencia

Este proyecto está bajo la [MIT License](./LICENSE).

---

# 💚 Proyecto 100% Open Source

Desarrollado con pasión para crear la mejor experiencia de batalla naval en tiempo real.

