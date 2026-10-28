import {
  contentViolations,
  findContentDrift,
  stripSqlPlaceholders,
} from './content-rules';

// Mutable fixtures; they stay assignable to the readonly parameters.
interface Entry {
  id: string;
  company: string;
  sector: string;
  role: string;
  period: string;
  highlights: string[];
  technologies?: string[];
}
interface WebContent {
  experience: Entry[];
  stack: { id: string; items: string[] }[];
}
interface ServedContent {
  experience: Entry[];
  skills: { level: string; skills: string[] }[];
}

const web = (): WebContent => ({
  experience: [
    {
      id: 'alpha',
      company: 'Alpha Corp',
      sector: 'Mining',
      role: 'Backend Developer',
      period: '2026 · remote',
      highlights: ['Built things.'],
      technologies: ['Node.js'],
    },
    {
      id: 'beta',
      company: 'Beta Ltd',
      sector: 'Banking',
      role: 'Backend Developer',
      period: '2025 · remote',
      highlights: ['Shipped services.', 'Wrote docs.'],
      // technologies intentionally missing: the web treats it as optional.
    },
  ],
  stack: [
    { id: 'avanzado', items: ['JavaScript', 'PostgreSQL'] },
    { id: 'produccion', items: ['Redis · TypeORM'] },
    { id: 'arquitectura', items: ['SOLID'] },
    { id: 'aprendiendo', items: ['Python'] },
  ],
});

const served = (): ServedContent => ({
  experience: [
    {
      id: 'alpha',
      company: 'Alpha Corp',
      sector: 'Mining',
      role: 'Backend Developer',
      period: '2026 · remote',
      highlights: ['Built things.'],
      technologies: ['Node.js'],
    },
    {
      id: 'beta',
      company: 'Beta Ltd',
      sector: 'Banking',
      role: 'Backend Developer',
      period: '2025 · remote',
      highlights: ['Shipped services.', 'Wrote docs.'],
      technologies: [],
    },
  ],
  skills: [
    { level: 'advanced', skills: ['JavaScript', 'PostgreSQL'] },
    { level: 'production', skills: ['Redis · TypeORM'] },
    { level: 'architecture', skills: ['SOLID'] },
    { level: 'learning', skills: ['Python'] },
  ],
});

describe('findContentDrift', () => {
  it('returns no drift when served content mirrors the web, treating missing technologies as []', () => {
    expect(findContentDrift(web(), served())).toEqual([]);
  });

  it('reports a missing company', () => {
    const s = served();
    s.experience.pop();
    expect(findContentDrift(web(), s)).toEqual([
      'experience ids differ (web: alpha,beta; served: alpha)',
      'experience "beta" is not served',
    ]);
  });

  it('reports ids out of order', () => {
    const s = served();
    s.experience.reverse();
    const drift = findContentDrift(web(), s);
    expect(drift.length).toBeGreaterThan(0);
    expect(drift.every((m) => m.length > 0)).toBe(true);
  });

  it('reports a changed company name', () => {
    const s = served();
    s.experience[0]!.company = 'Alpha Corporation';
    expect(findContentDrift(web(), s).join('\n')).toContain('alpha');
  });

  it('reports a changed field of an entry (highlights)', () => {
    const s = served();
    s.experience[1]!.highlights = ['Shipped services.'];
    expect(findContentDrift(web(), s)).toEqual([
      'experience "beta" highlights differ',
    ]);
  });

  it('reports technologies served where the web has none', () => {
    const s = served();
    s.experience[1]!.technologies = ['Extra'];
    expect(findContentDrift(web(), s)).toEqual([
      'experience "beta" technologies differ',
    ]);
  });

  it('reports a missing skill level', () => {
    const s = served();
    s.skills = s.skills.filter((g) => g.level !== 'learning');
    expect(findContentDrift(web(), s).join('\n')).toContain('learning');
  });

  it('reports a changed skill', () => {
    const s = served();
    s.skills[0] = { level: 'advanced', skills: ['JavaScript', 'MySQL'] };
    expect(findContentDrift(web(), s).join('\n')).toContain('advanced');
  });

  it('reports skills out of order within a level', () => {
    const s = served();
    s.skills[0] = { level: 'advanced', skills: ['PostgreSQL', 'JavaScript'] };
    expect(findContentDrift(web(), s)).toEqual([
      'skill level "advanced" items differ or are out of order',
    ]);
  });

  it('reports an unknown web stack column', () => {
    const w = web();
    w.stack.push({ id: 'mystery', items: ['X'] });
    expect(findContentDrift(w, served()).join('\n')).toContain('mystery');
  });
});

describe('contentViolations', () => {
  it.each([
    ['salary', 'Pretensión de renta: $2.500.000', 'sueldo|salario'],
    ['currency code', 'Sueldo 3000000 CLP', 'CLP'],
    ['phone', 'Llámame al +56 9 1234 5678', '\\+56'],
    ['availability', 'Disponible desde el 1 de marzo', 'disponib'],
    ['email', 'Escribe a someone@example.test', '@'],
    ['CV pdf', 'Descarga cv-maria.pdf', 'pdf|docx?|odt'],
    ['CV docx upper case', 'CV.DOCX', 'pdf|docx?|odt'],
    ['CV odt', 'resume.odt', 'pdf|docx?|odt'],
    ['CV doc', 'resume.doc', 'pdf|docx?|odt'],
    ['bare mobile', 'fono 56912345678', '9\\d{8}'],
    ['plus mobile', 'fono +56912345678', '9\\d{8}'],
    ['parenthesised prefix', 'fono (+56) 9 1234 5678', '\\(\\+?56\\)'],
    ['salary without separators', 'sueldo 1500000 pesos', 'sueldo|salario'],
    ['salary with keyword', 'Pretensión de renta 1.500.000', 'sueldo|salario'],
  ])('flags %s', (_name, text, rule) => {
    const violations = contentViolations(text);
    expect(violations).not.toEqual([]);
    expect(violations.some((violation) => violation.includes(rule))).toBe(true);
  });

  it.each([
    'Accenture Chile',
    'Banco Itaú',
    'Kabeli · Amecs',
    'openToWork: true',
    '2023 – 2024 · remoto',
    'timestamp 1792800000000',
    'sueldo a convenir',
    'rentabilidad 1500000',
  ])('does not flag %s', (text) => {
    expect(contentViolations(text)).toEqual([]);
  });
});

describe('stripSqlPlaceholders', () => {
  it.each(['$1000', '$1.000.000', '$ 1.000.000', '$1.500'])(
    'keeps the amount %s detectable',
    (amount) => {
      expect(
        contentViolations(stripSqlPlaceholders(`x ${amount} y`)),
      ).toContain(String(/\$\s?\d/));
    },
  );

  it.each(['VALUES ($1, $2)', 'WHERE id = $12', '($1,$2,$3)', '$9;'])(
    'removes placeholders in %s',
    (sql) => {
      expect(contentViolations(stripSqlPlaceholders(sql))).toEqual([]);
      expect(stripSqlPlaceholders(sql)).not.toMatch(/\$\d/);
    },
  );
});
