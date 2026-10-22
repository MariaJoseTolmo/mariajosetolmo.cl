import type { MigrationInterface } from 'typeorm';
import { CreateUsers1792540800000 } from './1792540800000-users';
import { CreateRefreshTokens1792627200000 } from './1792627200000-refresh-tokens';

export const MIGRATIONS: (new () => MigrationInterface)[] = [
  CreateUsers1792540800000,
  CreateRefreshTokens1792627200000,
];
