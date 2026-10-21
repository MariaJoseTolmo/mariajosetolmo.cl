import { Footer } from '@/components/layout/Footer';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { Contributions } from '@/features/home/Contributions';
import { Hero } from '@/features/home/Hero';
import { StackSection } from '@/features/home/StackSection';

export default function HomePage() {
  return (
    <>
      <SiteHeader variant="public" currentPath="/" />
      <main id="contenido">
        <Hero />
        <Contributions />
        <StackSection />
      </main>
      <Footer />
    </>
  );
}
