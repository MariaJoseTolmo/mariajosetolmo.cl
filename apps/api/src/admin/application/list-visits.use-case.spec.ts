import { ListVisits } from './list-visits.use-case';

describe('ListVisits', () => {
  it('is a stub that returns an empty list until visits are recorded', () => {
    expect(new ListVisits().execute()).toEqual([]);
  });
});
