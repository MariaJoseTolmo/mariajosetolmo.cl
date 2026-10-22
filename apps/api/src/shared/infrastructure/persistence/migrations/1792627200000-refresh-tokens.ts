import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Refresh tokens: one row per issued token, never the token itself. Plain SQL
 * on purpose (one statement per call, no session state, pooler friendly).
 */
export class CreateRefreshTokens1792627200000 implements MigrationInterface {
  name = 'CreateRefreshTokens1792627200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE refresh_tokens (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        family_id uuid NOT NULL,
        token_hash bytea NOT NULL,
        expires_at timestamptz NOT NULL,
        used_at timestamptz NULL,
        revoked_at timestamptz NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT refresh_tokens_token_hash_key UNIQUE (token_hash),
        CONSTRAINT refresh_tokens_token_hash_length CHECK (octet_length(token_hash) = 32)
      )
    `);
    await queryRunner.query(
      'CREATE INDEX refresh_tokens_family_id_idx ON refresh_tokens (family_id)',
    );
    await queryRunner.query(
      'CREATE INDEX refresh_tokens_user_id_idx ON refresh_tokens (user_id)',
    );
    await queryRunner.query(
      `COMMENT ON TABLE refresh_tokens IS 'Opaque refresh tokens of recruiter sessions; only the sha256 of each token is kept.'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN refresh_tokens.family_id IS 'All tokens rotated from one login share it; reuse of a spent token revokes the whole family.'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN refresh_tokens.token_hash IS 'sha256 of the token (32 bytes). The token itself is never stored.'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN refresh_tokens.expires_at IS 'Absolute end of the session (login + 7 days); rotation copies it, never extends it.'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN refresh_tokens.used_at IS 'Set once, atomically, when the token is rotated; a later presentation is reuse.'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN refresh_tokens.revoked_at IS 'Set on every token of a family when the family is revoked (reuse or logout).'`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE refresh_tokens');
  }
}
