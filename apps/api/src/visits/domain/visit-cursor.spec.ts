import { InvalidInput } from '../../shared/domain/errors';
import { VisitCursor } from './visit-cursor';

const ID = '3f2b8c1e-5a47-4d9b-8e60-1c2d3e4f5a6b';
const b64 = (text: string): string => Buffer.from(text).toString('base64url');
const AT = new Date('2026-06-30T12:00:00.123Z');

describe('VisitCursor', () => {
  it('round-trips an instant and an id, with millisecond precision', () => {
    const encoded = VisitCursor.from({ id: ID, occurredAt: AT }).encode();
    expect(encoded).toBe(b64(`${AT.getTime()}.${ID}`));
    const parsed = VisitCursor.parse(encoded);
    expect(parsed?.id).toBe(ID);
    expect(parsed?.occurredAt.toISOString()).toBe('2026-06-30T12:00:00.123Z');
  });

  it('keeps events tied on the instant apart by their id', () => {
    const other = '3f2b8c1e-5a47-4d9b-8e60-1c2d3e4f5a6c';
    const a = VisitCursor.from({ id: ID, occurredAt: AT }).encode();
    const b = VisitCursor.from({ id: other, occurredAt: AT }).encode();
    expect(a).not.toBe(b);
    expect(VisitCursor.parse(b)?.id).toBe(other);
  });

  it('uses only the base64url alphabet', () => {
    expect(VisitCursor.from({ id: ID, occurredAt: AT }).encode()).toMatch(
      /^[A-Za-z0-9_-]+$/,
    );
  });

  it.each<[string, unknown]>([
    ['garbage', 'not a cursor'],
    ['percent signs', '%%%'],
    ['empty string', ''],
    ['script tag', '<script>alert(1)</script>'],
    ['undefined', undefined],
    ['null', null],
    ['number', 42],
    ['array', [b64(`1.${ID}`)]],
    ['object', { cursor: b64(`1.${ID}`) }],
    ['padded base64', `${b64(`1.${ID}`)}=`],
    ['standard base64 alphabet', Buffer.from(`1.${ID}`).toString('base64')],
    ['non-canonical base64 (trailing bits)', `${b64(`1.${ID}`).slice(0, -1)}B`],
    ['uppercase uuid', b64(`1.${ID.toUpperCase()}`)],
    ['not a uuid', b64('1.not-a-uuid')],
    ['missing id', b64('1.')],
    ['missing instant', b64(`.${ID}`)],
    ['no separator', b64(`1${ID}`)],
    ['negative instant', b64(`-1.${ID}`)],
    ['fractional instant', b64(`1.5.${ID}`)],
    ['leading zeros', b64(`007.${ID}`)],
    ['unsafe integer instant', b64(`99999999999999999999.${ID}`)],
    ['instant beyond the Date range', b64(`8640000000000001.${ID}`)],
    ['more than 96 characters', `${b64(`1.${ID}`)}${'A'.repeat(60)}`],
  ])('parse returns null for %s', (_label, raw) => {
    expect(VisitCursor.parse(raw)).toBeNull();
  });

  it('accepts the epoch itself and the largest valid Date', () => {
    expect(VisitCursor.parse(b64(`0.${ID}`))?.occurredAt.getTime()).toBe(0);
    expect(
      VisitCursor.parse(b64(`8640000000000000.${ID}`))?.occurredAt.getTime(),
    ).toBe(8_640_000_000_000_000);
  });

  it('parseOrThrow returns the cursor when valid', () => {
    const encoded = VisitCursor.from({ id: ID, occurredAt: AT }).encode();
    expect(VisitCursor.parseOrThrow(encoded).id).toBe(ID);
  });

  it('parseOrThrow throws InvalidInput with a fixed message that never echoes the value', () => {
    const attempt = (): VisitCursor =>
      VisitCursor.parseOrThrow('<script>x</script>');
    expect(attempt).toThrow(InvalidInput);
    expect(attempt).toThrow('cursor is invalid');
    try {
      attempt();
    } catch (e) {
      expect((e as Error).message).not.toContain('script');
    }
  });
});
