import { InvalidInput } from '../../shared/domain/errors';
import { InMemoryContentRepository } from '../../../test/support/fakes/in-memory-repositories';
import { ListSkills } from './list-skills.use-case';

const useCase = new ListSkills(
  new InMemoryContentRepository({
    skills: [
      { level: 'learning', skills: ['Rust'] },
      { level: 'advanced', skills: ['TypeScript', 'Angular'] },
    ],
  }),
);

describe('ListSkills', () => {
  it('returns one group for a level', async () => {
    await expect(useCase.execute({ level: 'advanced' })).resolves.toEqual({
      level: 'advanced',
      skills: ['TypeScript', 'Angular'],
    });
  });

  it('returns an empty group for a level without skills', async () => {
    await expect(useCase.execute({ level: 'production' })).resolves.toEqual({
      level: 'production',
      skills: [],
    });
  });

  it('returns the four levels in fixed order without a level', async () => {
    const result = await useCase.execute({});
    expect(result).toEqual({
      levels: [
        { level: 'advanced', skills: ['TypeScript', 'Angular'] },
        { level: 'production', skills: [] },
        { level: 'architecture', skills: [] },
        { level: 'learning', skills: ['Rust'] },
      ],
    });
  });

  it.each(['expert', '', ['advanced', 'learning']])(
    'rejects level %j with InvalidInput',
    async (level) => {
      await expect(useCase.execute({ level })).rejects.toBeInstanceOf(
        InvalidInput,
      );
    },
  );
});
