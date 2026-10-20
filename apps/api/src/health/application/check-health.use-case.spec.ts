import { CheckHealth } from './check-health.use-case';
import { HealthProbe } from './ports/health-probe.port';

const probe = (name: string, status: 'ok' | 'down'): HealthProbe => ({
  check: () => Promise.resolve({ name, status }),
});
const failing = (): HealthProbe => ({
  check: () => Promise.reject(new Error('boom')),
});

describe('CheckHealth', () => {
  it('aggregates the results of the injected probes', async () => {
    const report = await new CheckHealth([
      probe('a', 'ok'),
      probe('b', 'ok'),
    ]).execute();
    expect(report.status).toBe('ok');
    expect(report.checks).toEqual([
      { name: 'a', status: 'ok' },
      { name: 'b', status: 'ok' },
    ]);
  });

  it('reports a down probe as degraded', async () => {
    const report = await new CheckHealth([
      probe('a', 'ok'),
      probe('b', 'down'),
    ]).execute();
    expect(report.status).toBe('degraded');
    expect(report.checks).toContainEqual({ name: 'b', status: 'down' });
  });

  it('treats a rejected probe as down', async () => {
    const report = await new CheckHealth([failing()]).execute();
    expect(report).toEqual({
      status: 'down',
      checks: [{ name: 'probe-0', status: 'down' }],
    });
  });

  it('reports a rejected probe next to a healthy one as degraded', async () => {
    const report = await new CheckHealth([
      probe('a', 'ok'),
      failing(),
    ]).execute();
    expect(report.status).toBe('degraded');
    expect(report.checks).toContainEqual({ name: 'probe-1', status: 'down' });
  });
});
