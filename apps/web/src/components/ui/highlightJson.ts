export type JsonTokenKind = 'key' | 'string' | 'text';

export interface JsonToken {
  kind: JsonTokenKind;
  text: string;
}

const STRING_LITERAL = /"(?:[^"\\]|\\.)*"/g;
const FOLLOWED_BY_COLON = /^\s*:/;

/**
 * Splits JSON text into tokens: object keys, string values and everything
 * else (punctuation, numbers, booleans) as plain text. Joining the token
 * texts always reproduces the input.
 */
export function highlightJson(input: string): JsonToken[] {
  const tokens: JsonToken[] = [];
  let cursor = 0;
  for (const match of input.matchAll(STRING_LITERAL)) {
    const start = match.index;
    const end = start + match[0].length;
    if (start > cursor) {
      tokens.push({ kind: 'text', text: input.slice(cursor, start) });
    }
    const isKey = FOLLOWED_BY_COLON.test(input.slice(end));
    tokens.push({ kind: isKey ? 'key' : 'string', text: match[0] });
    cursor = end;
  }
  if (cursor < input.length) {
    tokens.push({ kind: 'text', text: input.slice(cursor) });
  }
  return tokens;
}
