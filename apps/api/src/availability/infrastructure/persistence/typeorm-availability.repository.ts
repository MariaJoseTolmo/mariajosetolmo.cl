import type { DataSource } from 'typeorm';
import { withDatabase } from '../../../shared/infrastructure/persistence/database-errors';
import { ensureInitialized } from '../../../shared/infrastructure/persistence/lazy-initialize';
import type { AvailabilityRepository } from '../../application/ports/availability-repository.port';
import type { Availability } from '../../domain/availability';

interface AvailabilityRow {
  modality: string;
  start_label: string;
  salary: string;
}

const SELECT = `SELECT modality, start_label, salary FROM availability WHERE id = 1`;

export class TypeOrmAvailabilityRepository implements AvailabilityRepository {
  constructor(private readonly dataSource: DataSource) {}

  get(): Promise<Availability> {
    return withDatabase(async () => {
      await ensureInitialized(this.dataSource);
      const rows = await this.dataSource.query<AvailabilityRow[]>(SELECT);
      const row = rows[0];
      // The migration seeds the row and a CHECK keeps it single. If someone
      // deleted it, fail closed rather than invent values for recruiters.
      if (!row) throw new MissingAvailability();
      return {
        modality: row.modality,
        start: row.start_label,
        salary: row.salary,
      };
    });
  }
}

class MissingAvailability extends Error {
  constructor() {
    super('availability row (id = 1) is missing');
  }
}
