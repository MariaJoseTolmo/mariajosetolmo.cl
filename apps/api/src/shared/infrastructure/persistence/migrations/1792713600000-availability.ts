import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * What recruiters see about availability: a single row. Plain SQL on purpose
 * (one statement per call, no session state, pooler friendly).
 *
 * The seed is a placeholder. The real values are loaded out of band with an
 * UPDATE by the owner and are never committed to the repository.
 */
export class CreateAvailability1792713600000 implements MigrationInterface {
  name = 'CreateAvailability1792713600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE availability (
        id smallint PRIMARY KEY DEFAULT 1,
        modality text NOT NULL,
        start_label text NOT NULL,
        salary text NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT availability_single_row CHECK (id = 1)
      )
    `);
    await queryRunner.query(`
      INSERT INTO availability (id, modality, start_label, salary)
      VALUES (1, '[dato de ejemplo]', '[dato de ejemplo]', '[dato de ejemplo]')
      ON CONFLICT DO NOTHING
    `);
    await queryRunner.query(
      `COMMENT ON TABLE availability IS 'Single row (id = 1) with the availability shown to signed-in recruiters. The seed is a placeholder; real values are loaded out of band.'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN availability.modality IS 'Free-text work modality label.'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN availability.start_label IS 'Free-text start date label (exposed to clients as "start").'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN availability.salary IS 'Free-text salary expectation label.'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN availability.updated_at IS 'Set by the manual UPDATE that loads the real values.'`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE availability');
  }
}
