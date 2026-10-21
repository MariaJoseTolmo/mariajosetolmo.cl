import type { Metadata } from 'next';
import { Footer } from '@/components/layout/Footer';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { NOINDEX, pageMetadata } from '@/content/metadata';
import { VerifyContainer } from '@/features/login/VerifyContainer';
import styles from '../page.module.css';

export const metadata: Metadata = {
  ...pageMetadata.verify,
  robots: NOINDEX,
};

export default function VerifyPage() {
  return (
    <>
      <SiteHeader variant="minimal" />
      <main id="contenido" className={styles.page}>
        <VerifyContainer />
      </main>
      <Footer />
    </>
  );
}
