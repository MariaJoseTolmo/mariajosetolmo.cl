import type {
  NewRefreshToken,
  RefreshTokenRepository,
} from '../../application/ports/refresh-token-repository.port';

/** Holds sessions in memory until the Postgres repository replaces it. */
export class InMemoryRefreshTokenRepository implements RefreshTokenRepository {
  private readonly rows: NewRefreshToken[] = [];

  create(row: NewRefreshToken): Promise<void> {
    this.rows.push(row);
    return Promise.resolve();
  }

  all(): readonly NewRefreshToken[] {
    return this.rows;
  }
}
