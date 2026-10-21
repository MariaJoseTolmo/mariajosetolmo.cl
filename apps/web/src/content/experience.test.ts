import { experience } from './experience';

describe('experience content', () => {
  it('has the API eyebrow from the mockup', () => {
    expect(experience.eyebrow).toBe('GET /api/v1/experience');
  });

  it('lists the five roles from newest to oldest', () => {
    expect(experience.items.map((i) => [i.company, i.period])).toEqual([
      ['Kabeli', '2026 · remoto'],
      ['Amecs', '2025 · remoto'],
      ['Accenture Chile', '2023 – 2024 · remoto'],
      ['Independiente', '2020 – 2021'],
      ['Consultoría', '2002 – 2019'],
    ]);
  });

  it('gives every role highlights and an achievement', () => {
    for (const item of experience.items) {
      expect(item.highlights.length).toBeGreaterThanOrEqual(2);
      expect(item.achievement.length).toBeGreaterThan(10);
    }
  });

  it('keeps technologies only where the approved copy has them', () => {
    expect(experience.items.map((i) => i.technologies?.length ?? 0)).toEqual([
      3, 4, 5, 0, 0,
    ]);
  });

  it('keeps the banking client as in the approved copy', () => {
    expect(experience.items[2]?.sector).toBe('Banca · cliente Banco Itaú');
  });

  it('lists five education entries from newest to oldest', () => {
    expect(experience.education.items.map((e) => e.period)).toEqual([
      '2025 · en curso',
      '2024',
      '2023',
      '2022',
      '2013',
    ]);
  });

  it('points the closing call to action at access', () => {
    expect(experience.cta.action.href).toBe('/acceso/');
  });
});
