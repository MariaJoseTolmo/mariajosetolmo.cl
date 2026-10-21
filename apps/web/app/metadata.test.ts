import type { Metadata } from 'next';
import { metadata as layout } from './layout';
import { metadata as access } from './acceso/page';
import { metadata as verify } from './acceso/verificar/page';
import { metadata as experience } from './experiencia/page';
import { metadata as home } from './page';
import { metadata as recruiter } from './reclutador/page';
import { metadata as notFound } from './not-found';

const pages: Record<string, Metadata> = {
  home,
  experience,
  access,
  verify,
  recruiter,
  notFound,
};
const NOINDEX = { index: false, follow: false };

describe('page metadata', () => {
  it.each(Object.entries(pages))(
    '%s has a title and a description',
    (_n, m) => {
      expect(typeof m.title).toBe('string');
      expect((m.title as string).length).toBeGreaterThan(10);
      expect((m.description ?? '').length).toBeGreaterThan(20);
    },
  );

  it('gives every page its own title', () => {
    const titles = Object.values(pages).map((m) => m.title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it('keeps descriptions distinct too', () => {
    const texts = Object.values(pages).map((m) => m.description);
    expect(new Set(texts).size).toBe(texts.length);
  });

  it('marks the two private pages noindex, and no public page', () => {
    expect(verify.robots).toEqual(NOINDEX);
    expect(recruiter.robots).toEqual(NOINDEX);
    for (const m of [home, experience, access])
      expect(m.robots).toBeUndefined();
  });

  it('resolves absolute URLs against the production domain', () => {
    expect(String(layout.metadataBase)).toBe('https://mariajosetolmo.cl/');
  });
});
