# Navark Core

**Navark Core** es el backend oficial del juego multijugador de batalla naval, desarrollado con NestJS, Prisma y PostgreSQL. Este servicio gestiona la lógica principal del juego, incluyendo partidas, equipos, tipos de disparo, turnos, reconexión y ranking.

## 🚀 Tecnologías principales

- NestJS (backend HTTP + WebSocket)
- Prisma ORM + PostgreSQL
- Redis (matchmaking y sincronización Socket.IO)
- Socket.IO (tiempo real)
- Arquitectura hexagonal aplicada

## 🔑 Características

- Partidas multijugador de 2 a 6 jugadores
- Modos: todos contra todos, por equipos, espectador
- Lógica de disparos con tipos personalizados
- Control de turnos y timeout por jugador
- Reconexión automática
- Sistema híbrido de usuarios (invitado y registrado)
- Ranking, historial y estadísticas por jugador
- Detección de abandono e inactividad

## 🛠️ Instalación

```bash
# Clonar repositorio
git clone https://github.com/tu-usuario/navark-core.git
cd navark-core

# Instalar dependencias
npm install

# Configurar entorno
cp .env.example .env

# Ejecutar migraciones
npx prisma migrate dev

# Iniciar servidor
npm run start:dev
```

## 📂 Estructura

- `src/domain/` – Entidades, lógica de negocio
- `src/application/` – Casos de uso
- `src/infrastructure/` – WebSocket, Redis, Repositorios
- `src/gateway/` – Eventos en tiempo real (Socket.IO)

## 📄 Licencia

Este proyecto está licenciado bajo la [MIT License](./LICENSE).
