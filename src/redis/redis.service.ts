import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: Redis;

  constructor() {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) throw new Error('Falta REDIS_URL en el archivo .env');

    this.client = new Redis(redisUrl);

    void this.client
      .ping()
      .then(() => console.log('Redis conectado correctamente'));
  }

  getClient(): Redis {
    return this.client;
  }

  async onModuleDestroy() {
    await this.client.quit();
  }
}
