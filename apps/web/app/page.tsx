import { CtaBand } from '@/components/layout/CtaBand';
import { Footer } from '@/components/layout/Footer';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { home } from '@/content/home';
import { ArchitectureSection } from '@/features/home/ArchitectureSection';
import { Contributions } from '@/features/home/Contributions';
import { Hero } from '@/features/home/Hero';
import { ProjectsSection } from '@/features/home/ProjectsSection';
import { StackSection } from '@/features/home/StackSection';

export default function HomePage() {
  const { title, text, action } = home.cta;
  return (
    <>
      <SiteHeader variant="public" currentPath="/" />
      <main id="contenido">
        <Hero />
        <Contributions />
        <StackSection />
        <ProjectsSection />
        <ArchitectureSection />
        <CtaBand title={title} text={text} cta={action} />
      </main>
      <Footer />
    </>
  );
}
