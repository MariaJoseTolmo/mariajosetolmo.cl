import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Safari/VoiceOver drops list semantics when `list-style: none` is applied,
// so every list restyled that way must declare role="list" explicitly.
const RESTYLED_LISTS = [
  'features/experience/Timeline',
  'features/experience/EducationSection',
  'features/home/ProjectsSection',
  'features/home/ArchitectureSection',
  'features/login/StepsPanel',
  'features/recruiter/ContactCard',
  'components/layout/SiteHeader',
  'components/layout/MobileMenu',
  'features/home/StackSection',
];

describe('lists restyled with list-style: none', () => {
  it.each(RESTYLED_LISTS)('%s keeps role="list" in its markup', (base) => {
    const css = readFileSync(
      join(__dirname, '..', `${base}.module.css`),
      'utf8',
    );
    const tsx = readFileSync(join(__dirname, '..', `${base}.tsx`), 'utf8');
    expect(css).toMatch(/list-style:\s*none/);
    expect(tsx).toMatch(/role="list"/);
  });
});
