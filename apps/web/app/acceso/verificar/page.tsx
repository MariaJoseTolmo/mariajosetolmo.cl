import type { Metadata } from 'next';
import { Footer } from '@/components/layout/Footer';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { VerifyContainer } from '@/features/login/VerifyContainer';
import styles from '../page.module.css';

export const metadata: Metadata = {
  title: 'Confirmar ingreso · María José Tolmo Tolmo',
  robots: { index: false, follow: false },
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
