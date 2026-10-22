import type { MigrationInterface } from 'typeorm';
import { CreateUsers1792540800000 } from './1792540800000-users';

export const MIGRATIONS: (new () => MigrationInterface)[] = [
  CreateUsers1792540800000,
];
