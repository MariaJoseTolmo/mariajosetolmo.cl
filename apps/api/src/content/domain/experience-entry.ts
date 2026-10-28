export interface ExperienceEntry {
  readonly id: string;
  /** Stable keyset order; never exposed over HTTP. */
  readonly position: number;
  readonly company: string;
  readonly role: string;
  readonly sector: string;
  readonly period: string;
  readonly highlights: readonly string[];
  readonly technologies: readonly string[];
}
