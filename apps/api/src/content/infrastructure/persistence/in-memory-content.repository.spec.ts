import { InfrastructureUnavailable } from '../../../shared/domain/errors';
import type { ExperienceEntry } from '../../domain/experience-entry';
import type { Profile } from '../../domain/profile';
import { InMemoryContentRepository } from './in-memory-content.repository';

const entry = (position: number): ExperienceEntry => ({
  id: `entry-${position}`,
  position,
  company: `Company ${position}`,
  role: 'Engineer',
  sector: 'Sector',
  period: '2020 - 2021',
  highlights: ['Did a thing'],
  technologies: ['TypeScript'],
});

const profile: Profile = {
  name: 'Ana Example',
  role: 'Engineer',
  architecture: 'Hexagonal',
  domains: ['web'],
  openToWork: true,
};

describe('InMemoryContentRepository', () => {
  describe('getProfile', () => {
    it('returns the seeded profile', async () => {
      const repo = new InMemoryContentRepository({ profile });
      await expect(repo.getProfile()).resolves.toEqual(profile);
    });

    it('rejects with an infrastructure error when there is no profile', async () => {
      const repo = new InMemoryContentRepository();
      await expect(repo.getProfile()).rejects.toBeInstanceOf(
        InfrastructureUnavailable,
      );
    });
  });

  describe('listExperience', () => {
    const repo = new InMemoryContentRepository({
      // Seeded out of order on purpose: the repository sorts by position.
      experience: [entry(3), entry(1), entry(2), entry(5), entry(4)],
    });

    it('returns up to limit + 1 entries ordered by position', async () => {
      const rows = await repo.listExperience(0, 2);
      expect(rows.map((r) => r.position)).toEqual([1, 2, 3]);
    });

    it('applies the keyset position > after', async () => {
      const rows = await repo.listExperience(2, 2);
      expect(rows.map((r) => r.position)).toEqual([3, 4, 5]);
    });

    it('returns what is left on the last page', async () => {
      const rows = await repo.listExperience(4, 5);
      expect(rows.map((r) => r.position)).toEqual([5]);
    });

    it('returns an empty page beyond the last position', async () => {
      const rows = await repo.listExperience(Number.MAX_SAFE_INTEGER, 5);
      expect(rows).toEqual([]);
    });
  });

  describe('listSkills', () => {
    const repo = new InMemoryContentRepository({
      skills: [
        { level: 'production', skills: ['NestJS', 'Postgres'] },
        { level: 'advanced', skills: ['TypeScript'] },
      ],
    });

    it('returns the four levels in fixed order, empty ones included', async () => {
      const groups = await repo.listSkills(null);
      expect(groups).toEqual([
        { level: 'advanced', skills: ['TypeScript'] },
        { level: 'production', skills: ['NestJS', 'Postgres'] },
        { level: 'architecture', skills: [] },
        { level: 'learning', skills: [] },
      ]);
    });

    it('returns a single group for a level', async () => {
      await expect(repo.listSkills('production')).resolves.toEqual([
        { level: 'production', skills: ['NestJS', 'Postgres'] },
      ]);
    });

    it('returns an empty group for a level without rows', async () => {
      await expect(repo.listSkills('learning')).resolves.toEqual([
        { level: 'learning', skills: [] },
      ]);
    });
  });
});
