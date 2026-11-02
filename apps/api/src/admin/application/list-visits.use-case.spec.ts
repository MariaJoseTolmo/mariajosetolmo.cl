import { FakeClock } from '../../../test/support/fakes/fake-clock';
import { InvalidInput } from '../../shared/domain/errors';
import type {
  VisitPageQuery,
  VisitRepository,
  VisitRow,
} from '../../visits/application/ports/visit-repository.port';
import { VisitCursor } from '../../visits/domain/visit-cursor';
import { retainFrom } from '../../visits/domain/visit-retention';
import { ListVisits } from './list-visits.use-case';

const NOW = new Date('2026-03-01T10:00:00.000Z');

function rowAt(n: number): VisitRow {
  return {
    id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    kind: 'LOGIN',
    occurredAt: new Date(NOW.getTime() - n * 1000),
    company: 'Acme',
    name: 'Ana',
  };
}

function setup(rows: VisitRow[] = []): {
  useCase: ListVisits;
  queries: VisitPageQuery[];
} {
  const queries: VisitPageQuery[] = [];
  const repository: VisitRepository = {
    append: () => Promise.resolve(),
    listPage: (query) => {
      queries.push(query);
      return Promise.resolve(rows);
    },
  };
  return { useCase: new ListVisits(repository, new FakeClock(NOW)), queries };
}

describe('ListVisits', () => {
  it('uses 5 by default and asks the repository for one extra row', async () => {
    const { useCase, queries } = setup();
    const page = await useCase.execute({});
    expect(page.limit).toBe(5);
    expect(queries).toEqual([
      {
        retainFrom: retainFrom(NOW),
        kinds: ['LOGIN', 'CV_LINK'],
        before: null,
        limit: 6,
      },
    ]);
  });

  it('asks for limit + 1 when a limit is given', async () => {
    const { useCase, queries } = setup();
    const page = await useCase.execute({ limit: '2' });
    expect(page.limit).toBe(2);
    expect(queries[0]?.limit).toBe(3);
  });

  it('keeps the page and gives the cursor of its last item when another page exists', async () => {
    const rows = [rowAt(1), rowAt(2), rowAt(3)];
    const { useCase } = setup(rows);
    const page = await useCase.execute({ limit: '2' });
    expect(page.items).toEqual([rows[0], rows[1]]);
    expect(page.nextCursor).toBe(VisitCursor.from(rowAt(2)).encode());
  });

  it('has no next cursor when the repository returns at most the limit', async () => {
    const { useCase } = setup([rowAt(1), rowAt(2)]);
    const page = await useCase.execute({ limit: '2' });
    expect(page.items).toHaveLength(2);
    expect(page.nextCursor).toBeNull();
  });

  it('answers an empty page with no cursor', async () => {
    const { useCase } = setup([]);
    expect(await useCase.execute({})).toEqual({
      items: [],
      limit: 5,
      kind: null,
      nextCursor: null,
    });
  });

  it.each(['LOGIN', 'CV_LINK'] as const)('filters by kind %s', async (kind) => {
    const { useCase, queries } = setup();
    const page = await useCase.execute({ kind });
    expect(page.kind).toBe(kind);
    expect(queries[0]?.kinds).toEqual([kind]);
  });

  it('turns a cursor into the keyset position', async () => {
    const { useCase, queries } = setup();
    const cursor = VisitCursor.from(rowAt(4)).encode();
    await useCase.execute({ cursor });
    expect(queries[0]?.before).toEqual({
      occurredAt: rowAt(4).occurredAt,
      id: rowAt(4).id,
    });
  });

  it('takes the retention cut from the clock at the time of the call', async () => {
    const clock = new FakeClock(NOW);
    const queries: VisitPageQuery[] = [];
    const useCase = new ListVisits(
      {
        append: () => Promise.resolve(),
        listPage: (q) => {
          queries.push(q);
          return Promise.resolve([]);
        },
      },
      clock,
    );
    await useCase.execute({});
    const later = new Date('2026-04-01T00:00:00.000Z');
    clock.set(later);
    await useCase.execute({});
    expect(queries.map((q) => q.retainFrom)).toEqual([
      retainFrom(NOW),
      retainFrom(later),
    ]);
  });

  describe('invalid input never reaches the repository', () => {
    it.each([
      ['limit', { limit: 'abc' }],
      ['limit', { limit: '0' }],
      ['limit', { limit: '51' }],
      ['limit', { limit: ['1', '2'] }],
      ['kind', { kind: 'login' }],
      ['kind', { kind: 'OTHER' }],
      ['kind', { kind: '' }],
      ['kind', { kind: ['LOGIN', 'CV_LINK'] }],
      ['cursor', { cursor: '%%%' }],
      ['cursor', { cursor: '' }],
      ['cursor', { cursor: ['a', 'b'] }],
      ['cursor', { cursor: '<script>' }],
    ])('rejects a bad %s', async (_name, input) => {
      const { useCase, queries } = setup();
      await expect(useCase.execute(input)).rejects.toBeInstanceOf(InvalidInput);
      expect(queries).toEqual([]);
    });
  });
});
