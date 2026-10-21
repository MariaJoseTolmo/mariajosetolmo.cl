import type { Metadata } from 'next';
import { Footer } from '@/components/layout/Footer';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { pageMetadata } from '@/content/metadata';
import { LoginContainer } from '@/features/login/LoginContainer';
import styles from './page.module.css';

export const metadata: Metadata = pageMetadata.access;

export default function AccessPage() {
  return (
    <>
      <SiteHeader variant="minimal" />
      <main id="contenido" className={styles.page}>
        <LoginContainer />
      </main>
      <Footer />
    </>
  );
}
