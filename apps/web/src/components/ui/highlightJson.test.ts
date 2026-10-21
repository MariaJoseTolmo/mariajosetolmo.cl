import { highlightJson } from './highlightJson';

describe('highlightJson', () => {
  it('tags keys and string values and leaves punctuation as text', () => {
    expect(highlightJson('{"name": "Maria"}')).toEqual([
      { kind: 'text', text: '{' },
      { kind: 'key', text: '"name"' },
      { kind: 'text', text: ': ' },
      { kind: 'string', text: '"Maria"' },
      { kind: 'text', text: '}' },
    ]);
  });

  it('keeps booleans and numbers as plain text', () => {
    expect(highlightJson('{"open": true, "n": 3}')).toEqual([
      { kind: 'text', text: '{' },
      { kind: 'key', text: '"open"' },
      { kind: 'text', text: ': true, ' },
      { kind: 'key', text: '"n"' },
      { kind: 'text', text: ': 3}' },
    ]);
  });

  it('handles arrays of strings and escaped quotes', () => {
    expect(highlightJson('["a", "b\\"c"]')).toEqual([
      { kind: 'text', text: '[' },
      { kind: 'string', text: '"a"' },
      { kind: 'text', text: ', ' },
      { kind: 'string', text: '"b\\"c"' },
      { kind: 'text', text: ']' },
    ]);
  });

  it('treats a string followed by a colon across whitespace as a key', () => {
    expect(highlightJson('{"a"  : "b"}')[1]).toEqual({
      kind: 'key',
      text: '"a"',
    });
  });

  it('returns no tokens for an empty input', () => {
    expect(highlightJson('')).toEqual([]);
  });

  it('reassembles to the original input', () => {
    const input = '{\n  "stack": ["Node.js", "NestJS"],\n  "ok": true\n}';
    expect(
      highlightJson(input)
        .map((t) => t.text)
        .join(''),
    ).toBe(input);
  });
});
