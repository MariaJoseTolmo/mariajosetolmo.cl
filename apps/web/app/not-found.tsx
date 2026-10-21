import type { Metadata } from 'next';
import { Footer } from '@/components/layout/Footer';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { LinkButton } from '@/components/ui/LinkButton';
import { pageMetadata } from '@/content/metadata';
import { notFound } from '@/content/notFound';
import styles from './not-found.module.css';

// Next adds `noindex` to the 404 page by itself; repeating it would duplicate the tag.
export const metadata: Metadata = pageMetadata.notFound;

export default function NotFound() {
  const { eyebrow, title, text, action } = notFound;
  return (
    <>
      <SiteHeader variant="public" />
      <main id="contenido" className={styles.page}>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.text}>{text}</p>
        <LinkButton href={action.href} size={48}>
          {action.label}
        </LinkButton>
      </main>
      <Footer />
    </>
  );
}
