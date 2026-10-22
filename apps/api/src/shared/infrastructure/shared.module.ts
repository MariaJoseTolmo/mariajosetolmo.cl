import { Global, Module, type OnModuleDestroy, Inject } from '@nestjs/common';
import type { Redis } from 'ioredis';
import type { DataSource } from 'typeorm';
import { APP_SECRETS, type Secrets } from '../../config/secrets.port';
import { CLOCK } from '../application/ports/clock.port';
import { ID_GENERATOR } from '../application/ports/id-generator.port';
import { LOGGER, type Logger } from '../application/ports/logger.port';
import { RANDOM_SOURCE } from '../application/ports/random-source.port';
import { CryptoIdGenerator } from './crypto-id.generator';
import { CryptoRandomSource } from './crypto-random.source';
import { NestLogger } from './nest-logger';
import { createRedisClient, REDIS_CLIENT } from './redis/redis-client.factory';
import {
  createDataSource,
  DATA_SOURCE,
} from './persistence/data-source.factory';
import { SystemClock } from './system-clock';

/** Closes the connections the module opened when the app shuts down. */
class ConnectionShutdown implements OnModuleDestroy {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @Inject(DATA_SOURCE) private readonly dataSource: DataSource,
  ) {}

  async onModuleDestroy(): Promise<void> {
    this.redis.disconnect();
    if (this.dataSource.isInitialized) await this.dataSource.destroy();
  }
}

@Global()
@Module({
  providers: [
    { provide: CLOCK, useClass: SystemClock },
    { provide: RANDOM_SOURCE, useClass: CryptoRandomSource },
    { provide: ID_GENERATOR, useClass: CryptoIdGenerator },
    { provide: LOGGER, useClass: NestLogger },
    {
      provide: REDIS_CLIENT,
      useFactory: (secrets: Secrets, logger: Logger): Redis => {
        const client = createRedisClient(secrets.redisUrl);
        // Without a listener ioredis prints the raw error (host included).
        client.on('error', (error: Error) =>
          logger.error(`Redis error: ${error.name}`),
        );
        return client;
      },
      inject: [APP_SECRETS, LOGGER],
    },
    {
      provide: DATA_SOURCE,
      // Registered unopened: repositories open it on first use (lazy-initialize.ts),
      // so a down or cold Postgres never stops the API from booting.
      useFactory: (secrets: Secrets): DataSource =>
        createDataSource(secrets.databaseUrl),
      inject: [APP_SECRETS],
    },
    ConnectionShutdown,
  ],
  exports: [
    CLOCK,
    RANDOM_SOURCE,
    ID_GENERATOR,
    LOGGER,
    REDIS_CLIENT,
    DATA_SOURCE,
  ],
})
export class SharedModule {}
