import type {
  VisitPageQuery,
  VisitRepository,
} from '../../src/visits/application/ports/visit-repository.port';
import { VisitCursor } from '../../src/visits/domain/visit-cursor';
import type { VisitEvent } from '../../src/visits/domain/visit-event';
import type { VisitKind } from '../../src/visits/domain/visit-kind';

/** What the contract needs from an adapter, whatever backs it. */
export interface VisitRepositoryHarness {
  readonly repo: VisitRepository;
  /** Creates a user and returns its id. */
  addUser(profile: {
    company: string | null;
    name: string | null;
  }): Promise<string>;
  /** Deletes the user the way the store does (Postgres cascades its events). */
  removeUser(userId: string): Promise<void>;
  /** Puts an event straight in, without the purge of `append`. */
  seed(event: VisitEvent): Promise<void>;
}

const BASE = Date.parse('2026-06-30T12:00:00.000Z');
const RETAIN_FROM = new Date(BASE - 180 * 24 * 60 * 60 * 1000);
const ALL: readonly VisitKind[] = ['LOGIN', 'CV_LINK'];

/** A lowercase uuid whose order follows `n` (so ties break predictably). */
export const uuid = (n: number): string =>
  `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const at = (offsetMs: number): Date => new Date(BASE + offsetMs);

/**
 * Shared behaviour of `VisitRepository.listPage`: runs against the in-memory
 * adapter (unit) and the TypeORM one (integration), so they cannot drift.
 * `setup` runs before each test and must give an empty store.
 */
export function describeVisitRepositoryContract(
  label: string,
  setup: () => Promise<VisitRepositoryHarness>,
): void {
  describe(`${label}: listPage contract`, () => {
    let h: VisitRepositoryHarness;
    let userId: string;
    beforeEach(async () => {
      h = await setup();
      userId = await h.addUser({ company: 'Acme', name: 'Ana' });
    });

    const event = (
      n: number,
      occurredAt: Date,
      kind: VisitKind = 'LOGIN',
      owner?: string,
    ): VisitEvent => ({
      id: uuid(n),
      userId: owner ?? userId,
      kind,
      occurredAt,
    });

    const page = (over: Partial<VisitPageQuery> = {}) =>
      h.repo.listPage({
        retainFrom: RETAIN_FROM,
        kinds: ALL,
        before: null,
        limit: 50,
        ...over,
      });

    const ids = async (over: Partial<VisitPageQuery> = {}): Promise<string[]> =>
      (await page(over)).map((row) => row.id);

    it('returns an empty page when there is nothing', async () => {
      await expect(page()).resolves.toEqual([]);
    });

    it('orders by occurredAt descending, then id descending', async () => {
      await h.seed(event(1, at(0)));
      await h.seed(event(2, at(2000)));
      await h.seed(event(3, at(1000)));
      await h.seed(event(5, at(1000)));
      await h.seed(event(4, at(1000)));
      expect(await ids()).toEqual([
        uuid(2),
        uuid(5),
        uuid(4),
        uuid(3),
        uuid(1),
      ]);
    });

    it('returns the id, kind, instant and the current company and name', async () => {
      await h.seed(event(1, at(123), 'CV_LINK'));
      await expect(page()).resolves.toEqual([
        {
          id: uuid(1),
          kind: 'CV_LINK',
          occurredAt: at(123),
          company: 'Acme',
          name: 'Ana',
        },
      ]);
    });

    it('gives null for a company or name the user never set', async () => {
      const bare = await h.addUser({ company: null, name: null });
      await h.seed(event(1, at(0), 'LOGIN', bare));
      const [row] = await page();
      expect(row?.company).toBeNull();
      expect(row?.name).toBeNull();
    });

    it('honours the limit it is given (the caller asks for size + 1)', async () => {
      for (let n = 1; n <= 7; n += 1) await h.seed(event(n, at(n * 1000)));
      expect(await page({ limit: 3 })).toHaveLength(3);
      expect(await page({ limit: 8 })).toHaveLength(7);
    });

    it('pages 7 events with 3 tied through a cursor without skipping or repeating', async () => {
      const tie = at(5000);
      await h.seed(event(1, at(1000)));
      await h.seed(event(2, at(2000)));
      await h.seed(event(3, tie));
      await h.seed(event(4, tie));
      await h.seed(event(5, tie));
      await h.seed(event(6, at(6000)));
      await h.seed(event(7, at(7000)));
      const size = 2;
      const seen: string[] = [];
      let before: VisitPageQuery['before'] = null;
      for (let guard = 0; guard < 10; guard += 1) {
        const rows = await page({ before, limit: size + 1 });
        const shown = rows.slice(0, size);
        seen.push(...shown.map((row) => row.id));
        if (rows.length <= size) break;
        const last = shown[shown.length - 1];
        if (last === undefined) throw new Error('empty page with a next page');
        const cursor = VisitCursor.parse(VisitCursor.from(last).encode());
        before = cursor && { occurredAt: cursor.occurredAt, id: cursor.id };
      }
      expect(seen).toEqual([
        uuid(7),
        uuid(6),
        uuid(5),
        uuid(4),
        uuid(3),
        uuid(2),
        uuid(1),
      ]);
    });

    it('lists strictly before the position: the event itself is not repeated', async () => {
      await h.seed(event(1, at(1000)));
      await h.seed(event(2, at(1000)));
      expect(
        await ids({ before: { occurredAt: at(1000), id: uuid(2) } }),
      ).toEqual([uuid(1)]);
      expect(
        await ids({ before: { occurredAt: at(1000), id: uuid(1) } }),
      ).toEqual([]);
    });

    it('keeps millisecond precision through cursor, query and cursor', async () => {
      await h.seed(event(1, at(122)));
      await h.seed(event(2, at(123)));
      await h.seed(event(3, at(124)));
      const first = await page({ limit: 1 });
      expect(first.map((r) => r.occurredAt.getTime())).toEqual([BASE + 124]);
      const second = await page({ limit: 1, before: cursorOf(first[0]) });
      expect(second.map((r) => r.occurredAt.getTime())).toEqual([BASE + 123]);
      const third = await page({ limit: 5, before: cursorOf(second[0]) });
      expect(third.map((r) => r.occurredAt.getTime())).toEqual([BASE + 122]);
    });

    it('starts the first page at any instant, however far ahead', async () => {
      await h.seed(event(1, new Date('2999-01-01T00:00:00.000Z')));
      expect(await ids()).toEqual([uuid(1)]);
    });

    it('filters by kind', async () => {
      await h.seed(event(1, at(1000), 'LOGIN'));
      await h.seed(event(2, at(2000), 'CV_LINK'));
      expect(await ids({ kinds: ['CV_LINK'] })).toEqual([uuid(2)]);
      expect(await ids({ kinds: ['LOGIN'] })).toEqual([uuid(1)]);
      expect(await ids({ kinds: ALL })).toEqual([uuid(2), uuid(1)]);
    });

    it('leaves out events older than retainFrom even if nothing purged them, and keeps the boundary', async () => {
      await h.seed(event(1, new Date(RETAIN_FROM.getTime() - 1)));
      await h.seed(event(2, RETAIN_FROM));
      expect(await ids()).toEqual([uuid(2)]);
    });

    it('leaves out the events of a user that no longer exists', async () => {
      const gone = await h.addUser({ company: 'Gone', name: 'Gus' });
      await h.seed(event(1, at(1000), 'LOGIN', gone));
      await h.seed(event(2, at(2000)));
      await h.removeUser(gone);
      expect(await ids()).toEqual([uuid(2)]);
    });
  });
}

function cursorOf(
  row: { id: string; occurredAt: Date } | undefined,
): NonNullable<VisitPageQuery['before']> {
  if (row === undefined) throw new Error('expected a row');
  const cursor = VisitCursor.parse(VisitCursor.from(row).encode());
  if (cursor === null) throw new Error('cursor did not round-trip');
  return { occurredAt: cursor.occurredAt, id: cursor.id };
}
