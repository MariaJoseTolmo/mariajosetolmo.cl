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

const MONTHS =
  '(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre|january|february|march|april|june|july|august|september|october|november|december)';

/**
 * Availability dates come from the API, never from the source. Bare years
 * (work history) and ISO timestamps (YYYY-MM-DD) are not availability.
 */
const AVAILABILITY: RegExp[] = [
  /\bdisponib\w*\s+(desde|inicio|a\s+partir)\b/i,
  // Day/month/year with / or -; the lookarounds keep ISO dates and versions out.
  /(?<![\d.\-/])\d{1,2}[/-]\d{1,2}[/-]\d{2,4}(?![\d.\-/])/,
  new RegExp(`\\b${MONTHS}\\s+(de\\s+)?\\d{4}\\b`, 'i'),
  // "desde el 1 de marzo", "inicio: 15 de abril".
  new RegExp(
    `\\b(desde|inicio:?)\\s+(el\\s+)?(\\d{1,2}\\s+de\\s+)?${MONTHS}\\b`,
    'i',
  ),
];

const DOCUMENT = /\.(pdf|docx?|odt)$/i;
const SKIPPED_DIRS = new Set(['node_modules', '.next', 'out', 'coverage']);

export const moneyMatches = (text: string) =>
  MONEY.filter((pattern) => pattern.test(text)).map(String);

export const availabilityMatches = (text: string) =>
  AVAILABILITY.filter((pattern) => pattern.test(text)).map(String);

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
