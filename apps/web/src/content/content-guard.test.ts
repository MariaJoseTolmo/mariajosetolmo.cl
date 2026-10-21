import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const KAFKA_WITHOUT_SQS = /kafka(?! en local \/ SQS en producción)/i;

const contentFiles = readdirSync(__dirname).filter(
  (name) => name.endsWith('.ts') && !name.includes('.test.'),
);

describe('content sources', () => {
  it('finds the content modules to scan', () => {
    expect(contentFiles).toEqual(
      expect.arrayContaining(['home.ts', 'site.ts', 'stack.ts']),
    );
  });

  it.each(contentFiles)(
    '%s never mentions Kafka without "en local / SQS en producción" (any casing)',
    (name) => {
      const raw = readFileSync(join(__dirname, name), 'utf8');
      expect(raw).not.toMatch(KAFKA_WITHOUT_SQS);
    },
  );
});
