import type { MigrationInterface } from 'typeorm';
import { CreateUsers1792540800000 } from './1792540800000-users';
import { CreateRefreshTokens1792627200000 } from './1792627200000-refresh-tokens';
import { CreateAvailability1792713600000 } from './1792713600000-availability';
import { CreateContent1792800000000 } from './1792800000000-content';

export const MIGRATIONS: (new () => MigrationInterface)[] = [
  CreateUsers1792540800000,
  CreateRefreshTokens1792627200000,
  CreateAvailability1792713600000,
  CreateContent1792800000000,
];
