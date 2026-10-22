import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Recruiters and the administrator. Plain SQL on purpose: one statement per
 * call, no session state, nothing that depends on a pinned connection.
 */
export class CreateUsers1792540800000 implements MigrationInterface {
  name = 'CreateUsers1792540800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email text NOT NULL,
        role text NOT NULL DEFAULT 'RECRUITER',
        company text NULL,
        name text NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        last_login_at timestamptz NULL,
        CONSTRAINT users_email_key UNIQUE (email),
        CONSTRAINT users_email_lowercase CHECK (email = lower(email)),
        CONSTRAINT users_role_valid CHECK (role IN ('RECRUITER', 'ADMIN')),
        CONSTRAINT users_company_length CHECK (char_length(company) <= 120),
        CONSTRAINT users_name_length CHECK (char_length(name) <= 120)
      )
    `);
    await queryRunner.query(
      `COMMENT ON TABLE users IS 'People who signed in with a magic link: recruiters, and the administrator.'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN users.email IS 'Normalised (trimmed, lower case); the natural key.'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN users.role IS 'Recomputed on every login from the configured administrator email; never taken from a request.'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN users.company IS 'Optional. Applied only when a magic link is verified, never when it is requested.'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN users.last_login_at IS 'Set by each successful verify.'`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE users');
  }
}
