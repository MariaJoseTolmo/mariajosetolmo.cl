import { InvalidInput } from '../../shared/domain/errors';
import type { ExperienceEntry } from '../domain/experience-entry';
import { InMemoryContentRepository } from '../../../test/support/fakes/in-memory-repositories';
import { ListExperience } from './list-experience.use-case';

const entry = (position: number): ExperienceEntry => ({
  id: `entry-${position}`,
  position,
  company: `Company ${position}`,
  role: 'Engineer',
  sector: 'Sector',
  period: '2020',
  highlights: [],
  technologies: [],
});

const seeded = (count: number): ListExperience =>
  new ListExperience(
    new InMemoryContentRepository({
      experience: Array.from({ length: count }, (_, i) => entry(i + 1)),
    }),
  );

describe('ListExperience', () => {
  it('returns an intermediate page with the last position as nextCursor', async () => {
    const page = await seeded(5).execute({ limit: '2' });
    expect(page.items.map((e) => e.position)).toEqual([1, 2]);
    expect(page.limit).toBe(2);
    expect(page.nextCursor).toBe(2);
  });

  it('continues after the cursor', async () => {
    const page = await seeded(5).execute({ limit: '2', cursor: '2' });
    expect(page.items.map((e) => e.position)).toEqual([3, 4]);
    expect(page.nextCursor).toBe(4);
  });

  it('gives a null nextCursor on the last page', async () => {
    const page = await seeded(5).execute({ limit: '2', cursor: '4' });
    expect(page.items.map((e) => e.position)).toEqual([5]);
    expect(page.nextCursor).toBeNull();
  });

  it('has no next page when the entries fit exactly in the limit', async () => {
    const page = await seeded(2).execute({ limit: '2' });
    expect(page.items).toHaveLength(2);
    expect(page.nextCursor).toBeNull();
  });

  it('defaults to limit 5 and cursor 0', async () => {
    const page = await seeded(7).execute({});
    expect(page.items.map((e) => e.position)).toEqual([1, 2, 3, 4, 5]);
    expect(page.limit).toBe(5);
    expect(page.nextCursor).toBe(5);
  });

  it.each([
    { limit: 'abc' },
    { limit: '0' },
    { limit: '51' },
    { limit: ['1', '2'] },
    { cursor: '-1' },
    { cursor: '<script>' },
  ])('rejects %j with InvalidInput', async (input) => {
    await expect(seeded(5).execute(input)).rejects.toBeInstanceOf(InvalidInput);
  });
});
