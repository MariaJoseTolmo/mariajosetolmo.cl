import { aggregate, CheckResult } from './health-report';

const ok = (name: string): CheckResult => ({ name, status: 'ok' });
const down = (name: string): CheckResult => ({ name, status: 'down' });

describe('aggregate', () => {
  it.each([
    ['all ok', [ok('a'), ok('b')], 'ok'],
    ['mixed', [ok('a'), down('b')], 'degraded'],
    ['all down', [down('a'), down('b')], 'down'],
    ['empty', [], 'ok'],
  ] as const)('returns the right status when %s', (_label, checks, status) => {
    expect(aggregate(checks)).toEqual({ status, checks });
  });
});
