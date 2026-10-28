import type { MigrationInterface, QueryRunner } from 'typeorm';

interface SeedExperience {
  readonly id: string;
  readonly company: string;
  readonly sector: string;
  readonly role: string;
  readonly period: string;
  readonly highlights: readonly string[];
  readonly technologies: readonly string[];
}

// Mirror of apps/web/src/content/experience.ts (public text only), in site
// order. Position 1..n is the keyset order of the API.
const EXPERIENCE: readonly SeedExperience[] = [
  {
    id: 'kabeli',
    company: 'Kabeli',
    sector: 'Minería',
    role: 'Desarrolladora Backend',
    period: '2026 · remoto',
    highlights: [
      'Desarrollo agéntico de software con Claude Code.',
      'Aplicación de Spec-Driven Development.',
      'Desarrollo de un proyecto para el rubro minero.',
    ],
    technologies: ['Claude Code', 'Spec-Driven', 'Node.js'],
  },
  {
    id: 'amecs',
    company: 'Amecs',
    sector: 'Minería',
    role: 'Desarrolladora Backend',
    period: '2025 · remoto',
    highlights: [
      'Desarrollé microservicios consumidores de APIs externas.',
      'Migré microservicios de Java a Node.js.',
      'Realicé modificaciones de componentes en React.',
    ],
    technologies: ['Node.js', 'Java', 'React', 'APIs REST'],
  },
  {
    id: 'accenture',
    company: 'Accenture Chile',
    sector: 'Banca · cliente Banco Itaú',
    role: 'Desarrolladora Backend Node.js',
    period: '2023 – 2024 · remoto',
    highlights: [
      'Desarrollé y mejoré microservicios con Node.js y NestJS.',
      'Implementé Swagger para documentar APIs internas y externas.',
      'Desarrollé y consumí APIs REST con manejo de datos cifrados y reestructuración de información.',
      'Gestioné pipelines de CI/CD en GitHub, monitoreados con Jenkins, para desplegar en QA y producción.',
    ],
    technologies: [
      'NestJS',
      'Swagger',
      'GitHub Actions',
      'Jenkins',
      'IBM API Connect',
    ],
  },
  {
    id: 'independiente',
    company: 'Independiente',
    sector: 'Plataforma inclusiva',
    role: 'Desarrolladora Frontend JavaScript',
    period: '2020 – 2021',
    highlights: [
      'Desarrollé el frontend del MVP en JavaScript vanilla.',
      'Implementé el backend con PHP y MySQL.',
    ],
    technologies: [],
  },
  {
    id: 'consultoria',
    company: 'Consultoría',
    sector: 'Construcción y minería',
    role: 'Coordinadora CAD/BIM',
    period: '2002 – 2019',
    highlights: [
      'Desarrollé modelos virtuales de edificaciones complejas.',
      'Realicé simulaciones de desempeño estructural y planificación de obra.',
      'Uso avanzado de Revit, Navisworks, AutoCAD y Civil 3D.',
    ],
    technologies: [],
  },
];

// Mirror of apps/web/src/content/stack.ts: avanzado -> advanced,
// produccion -> production, arquitectura -> architecture, aprendiendo -> learning.
const SKILLS: readonly { level: string; names: readonly string[] }[] = [
  {
    level: 'advanced',
    names: ['JavaScript', 'Node.js', 'NestJS', 'PostgreSQL'],
  },
  {
    level: 'production',
    names: [
      'TypeScript · Express.js',
      'Kafka en local / SQS en producción',
      'Redis · TypeORM',
      'JWT · OAuth · Swagger',
      'Docker · Jest · CI/CD',
    ],
  },
  {
    level: 'architecture',
    names: [
      'Hexagonal · Microservicios',
      'SOLID · Código limpio',
      'Spec-Driven Development',
      'Scrum · Kanban',
    ],
  },
  {
    level: 'learning',
    names: [
      'AWS (Cloud Computing): aprendiendo, aplicado en este proyecto',
      'Java · Spring Boot',
      'Python',
    ],
  },
];

/**
 * Public content for recruiters: one profile row, the experience entries and
 * the skills by level. Plain SQL on purpose (one statement per call, no
 * session state, pooler friendly). The seed mirrors `apps/web/src/content`;
 * it holds no salary, availability, contact data or CV file references.
 */
export class CreateContent1792800000000 implements MigrationInterface {
  name = 'CreateContent1792800000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE profile (
        id smallint PRIMARY KEY DEFAULT 1,
        name text NOT NULL,
        role text NOT NULL,
        architecture text NOT NULL,
        domains text[] NOT NULL,
        open_to_work boolean NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT profile_single_row CHECK (id = 1)
      )
    `);
    await queryRunner.query(`
      CREATE TABLE experience (
        id text PRIMARY KEY,
        position smallint NOT NULL,
        company text NOT NULL,
        sector text NOT NULL,
        role text NOT NULL,
        period_label text NOT NULL,
        highlights text[] NOT NULL,
        technologies text[] NOT NULL DEFAULT '{}',
        CONSTRAINT experience_position_unique UNIQUE (position),
        CONSTRAINT experience_position_positive CHECK (position > 0),
        CONSTRAINT experience_id_format CHECK (id ~ '^[a-z0-9-]+$')
      )
    `);
    await queryRunner.query(`
      CREATE TABLE skill (
        level text NOT NULL,
        position smallint NOT NULL,
        name text NOT NULL,
        PRIMARY KEY (level, position),
        CONSTRAINT skill_level_known CHECK (level IN ('advanced', 'production', 'architecture', 'learning')),
        CONSTRAINT skill_position_positive CHECK (position > 0),
        CONSTRAINT skill_level_name_unique UNIQUE (level, name)
      )
    `);

    await queryRunner.query(
      `INSERT INTO profile (id, name, role, architecture, domains, open_to_work)
       VALUES (1, $1, $2, $3, $4, $5)`,
      [
        'María José Tolmo',
        'Backend Developer',
        'hexagonal',
        ['banca', 'minería'],
        true,
      ],
    );

    const experienceParams: unknown[] = [];
    const experienceRows = EXPERIENCE.map((entry, index) => {
      const base = experienceParams.length;
      experienceParams.push(
        entry.id,
        index + 1,
        entry.company,
        entry.sector,
        entry.role,
        entry.period,
        [...entry.highlights],
        [...entry.technologies],
      );
      const slots = Array.from({ length: 8 }, (_, i) => `$${base + i + 1}`);
      return `(${slots.join(', ')})`;
    });
    await queryRunner.query(
      `INSERT INTO experience (id, position, company, sector, role, period_label, highlights, technologies)
       VALUES ${experienceRows.join(', ')}`,
      experienceParams,
    );

    const skillParams: unknown[] = [];
    const skillRows = SKILLS.flatMap(({ level, names }) =>
      names.map((name, index) => {
        const base = skillParams.length;
        skillParams.push(level, index + 1, name);
        return `($${base + 1}, $${base + 2}, $${base + 3})`;
      }),
    );
    await queryRunner.query(
      `INSERT INTO skill (level, position, name) VALUES ${skillRows.join(', ')}`,
      skillParams,
    );

    await queryRunner.query(
      `COMMENT ON TABLE profile IS 'Single row (id = 1): the public profile shown to signed-in recruiters. Mirror of apps/web/src/content.'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN profile.open_to_work IS 'Plain boolean flag. Dates and availability details never live here.'`,
    );
    await queryRunner.query(
      `COMMENT ON TABLE experience IS 'Public work history shown to signed-in recruiters. Mirror of apps/web/src/content/experience.ts.'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN experience.position IS 'Stable keyset order of the listing (1..n, site order). Never exposed by the API.'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN experience.period_label IS 'Free-text period label (exposed to clients as "period").'`,
    );
    await queryRunner.query(
      `COMMENT ON TABLE skill IS 'Public skills grouped by level. Mirror of apps/web/src/content/stack.ts.'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN skill.position IS 'Order of the skill inside its level (1..n, site order). Never exposed by the API.'`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE skill');
    await queryRunner.query('DROP TABLE experience');
    await queryRunner.query('DROP TABLE profile');
  }
}
