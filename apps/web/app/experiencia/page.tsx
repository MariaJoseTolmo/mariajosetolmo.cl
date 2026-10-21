import type { Metadata } from 'next';
import { CtaBand } from '@/components/layout/CtaBand';
import { Footer } from '@/components/layout/Footer';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { experience } from '@/content/experience';
import { pageMetadata } from '@/content/metadata';
import { EducationSection } from '@/features/experience/EducationSection';
import { Timeline } from '@/features/experience/Timeline';
import styles from './page.module.css';

export const metadata: Metadata = pageMetadata.experience;

export default function ExperiencePage() {
  const { eyebrow, title, lead, cta } = experience;
  return (
    <>
      <SiteHeader variant="public" currentPath="/experiencia/" />
      <main id="contenido" className={styles.page}>
        <div className={styles.intro}>
          <Eyebrow>{eyebrow}</Eyebrow>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.lead}>{lead}</p>
        </div>
        <Timeline />
        <EducationSection />
        <CtaBand variant="card" title={cta.title} cta={cta.action} />
      </main>
      <Footer />
    </>
  );
}
