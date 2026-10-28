import {
  availabilityMatches,
  moneyMatches,
  phoneMatches,
} from '../../../web/src/test/contentRules';

/** Entry shape shared by the web content and what the API serves. */
export interface ExperienceShape {
  id: string;
  company: string;
  sector: string;
  role: string;
  period: string;
  highlights: readonly string[];
  /** Optional on the web; a missing list is the same as an empty one. */
  technologies?: readonly string[];
}

export interface WebContent {
  experience: readonly ExperienceShape[];
  stack: readonly { id: string; items: readonly string[] }[];
}

export interface ServedContent {
  experience: readonly ExperienceShape[];
  skills: readonly { level: string; skills: readonly string[] }[];
}

/** Web stack column id -> API skill level. */
const LEVEL_BY_COLUMN: Readonly<Record<string, string>> = {
  avanzado: 'advanced',
  produccion: 'production',
  arquitectura: 'architecture',
  aprendiendo: 'learning',
};

const EXPERIENCE_FIELDS = ['company', 'sector', 'role', 'period'] as const;

const sameList = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((value, index) => value === b[index]);

/**
 * Differences between the public web content and what the API serves.
 * Pure: no database, no I/O. An empty array means no drift.
 */
export function findContentDrift(
  web: WebContent,
  served: ServedContent,
): string[] {
  const drift: string[] = [];

  const webIds = web.experience.map((item) => item.id);
  const servedIds = served.experience.map((item) => item.id);
  if (!sameList(webIds, servedIds)) {
    drift.push(
      `experience ids differ (web: ${webIds.join(',')}; served: ${servedIds.join(',')})`,
    );
  }

  for (const item of web.experience) {
    const other = served.experience.find((entry) => entry.id === item.id);
    if (!other) {
      drift.push(`experience "${item.id}" is not served`);
      continue;
    }
    for (const field of EXPERIENCE_FIELDS) {
      if (item[field] !== other[field]) {
        drift.push(`experience "${item.id}" ${field} differs`);
      }
    }
    if (!sameList(item.highlights, other.highlights)) {
      drift.push(`experience "${item.id}" highlights differ`);
    }
    if (!sameList(item.technologies ?? [], other.technologies ?? [])) {
      drift.push(`experience "${item.id}" technologies differ`);
    }
  }

  for (const column of web.stack) {
    const level = LEVEL_BY_COLUMN[column.id];
    if (!level) {
      drift.push(`stack column "${column.id}" has no API level`);
      continue;
    }
    const group = served.skills.find((entry) => entry.level === level);
    if (!group) {
      drift.push(`skill level "${level}" is not served`);
    } else if (!sameList(column.items, group.skills)) {
      drift.push(`skill level "${level}" items differ or are out of order`);
    }
  }

  return drift;
}

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+/;
const CV_FILE = /\.(pdf|docx?|odt)\b/i;

/**
 * Patterns that must never reach the API content: salary, phone, availability
 * dates (shared with the web rules) plus email and CV file names. Employer
 * names are allowed by decision, so they are not scanned.
 */
export function contentViolations(text: string): string[] {
  return [
    ...moneyMatches(text),
    ...phoneMatches(text),
    ...availabilityMatches(text),
    ...(EMAIL.test(text) ? [String(EMAIL)] : []),
    ...(CV_FILE.test(text) ? [String(CV_FILE)] : []),
  ];
}

/**
 * Replaces SQL query parameters (`$1`..`$99`) so they are not read as money.
 * A placeholder is one or two digits not followed by more digits or a
 * thousands group, so `$1000`, `$1.000.000` and `$ 1.000.000` stay intact.
 */
export const stripSqlPlaceholders = (source: string) =>
  source.replace(/\$[1-9]\d?(?!\d|\.\d)/g, '?');
