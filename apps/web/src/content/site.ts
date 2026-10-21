import type { SiteContent } from './types';

export const site: SiteContent = {
  domain: 'mariajosetolmo.cl',
  ownerName: 'María José Tolmo Tolmo',
  nav: [
    { label: 'Experiencia', href: '/experiencia/' },
    { label: 'Proyectos', href: '/#proyectos' },
    { label: 'Stack', href: '/#stack' },
    { label: 'Cómo está hecha', href: '/#como' },
    { label: 'Acceso reclutadores', href: '/acceso/', emphasis: true },
  ],
  contact: [
    {
      label: 'mariajosetolmo@gmail.com',
      href: 'mailto:mariajosetolmo@gmail.com',
    },
    { label: 'LinkedIn', href: 'https://linkedin.com/in/mariajosetolmo' },
    { label: 'GitHub', href: 'https://github.com/MariaJoseTolmo' },
  ],
  footer: 'María José Tolmo Tolmo · Desarrolladora Backend',
};
