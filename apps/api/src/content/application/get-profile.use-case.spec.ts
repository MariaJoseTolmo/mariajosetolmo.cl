import { InfrastructureUnavailable } from '../../shared/domain/errors';
import { InMemoryContentRepository } from '../../../test/support/fakes/in-memory-repositories';
import { GetProfile } from './get-profile.use-case';

describe('GetProfile', () => {
  it('returns the profile held by the repository', async () => {
    const profile = {
      name: 'Ana Example',
      role: 'Engineer',
      architecture: 'Hexagonal',
      domains: ['web', 'data'],
      openToWork: false,
    };
    const useCase = new GetProfile(new InMemoryContentRepository({ profile }));
    await expect(useCase.execute()).resolves.toEqual(profile);
  });

  it('propagates the repository error', async () => {
    const useCase = new GetProfile(new InMemoryContentRepository());
    await expect(useCase.execute()).rejects.toBeInstanceOf(
      InfrastructureUnavailable,
    );
  });
});
