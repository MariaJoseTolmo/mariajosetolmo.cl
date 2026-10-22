import { Global, Module } from '@nestjs/common';
import { CLOCK } from '../application/ports/clock.port';
import { ID_GENERATOR } from '../application/ports/id-generator.port';
import { RANDOM_SOURCE } from '../application/ports/random-source.port';
import { CryptoIdGenerator } from './crypto-id.generator';
import { CryptoRandomSource } from './crypto-random.source';
import { SystemClock } from './system-clock';

@Global()
@Module({
  providers: [
    { provide: CLOCK, useClass: SystemClock },
    { provide: RANDOM_SOURCE, useClass: CryptoRandomSource },
    { provide: ID_GENERATOR, useClass: CryptoIdGenerator },
  ],
  exports: [CLOCK, RANDOM_SOURCE, ID_GENERATOR],
})
export class SharedModule {}
