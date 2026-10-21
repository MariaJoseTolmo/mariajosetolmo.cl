import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

/** Salary or money wording the site must never ship (figures come from the API). */
const MONEY: RegExp[] = [
  /\$\s?\d/,
  /\d+\s?(CLP|UF|USD)\b/i,
  /\bCLP\b/,
  /millones/i,
  // Needs a digit before MM so date formats (YYYY-MM-DD) do not match.
  /\d\s?MM\b/,
  // Thousands separators only count with currency context; bare ones are
  // version-like strings (1.234.567).
  /(\$|CLP)\s?\d{1,3}(\.\d{3})+(?![\d.])/,
  /(?<![\d.])\d{1,3}(\.\d{3})+\s?(CLP|pesos)\b/i,
];

/** Phone numbers live in `src/content/site.ts` only. */
const PHONE: RegExp[] = [
  /\+56\s?\d/,
  /\btel:/i,
  /\b9[ -]?\d{4}[ -]?\d{4}\b/,
  /\(9\)\s?\d{4}[ -]?\d{4}\b/,
];

const DOCUMENT = /\.(pdf|docx?|odt)$/i;
const SKIPPED_DIRS = new Set(['node_modules', '.next', 'out', 'coverage']);

export const moneyMatches = (text: string) =>
  MONEY.filter((pattern) => pattern.test(text)).map(String);

export const phoneMatches = (text: string) =>
  PHONE.filter((pattern) => pattern.test(text)).map(String);

/** Every file under `root` (build output and dependencies skipped). */
export function walkFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) {
      return SKIPPED_DIRS.has(entry.name)
        ? []
        : walkFiles(join(root, entry.name));
    }
    return [join(root, entry.name)];
  });
}

/** Binary documents (PDF, Word, ODT) found under `root`, relative to it. */
export const findDocuments = (root: string) =>
  walkFiles(root)
    .filter((file) => DOCUMENT.test(file))
    .map((file) => relative(root, file));
