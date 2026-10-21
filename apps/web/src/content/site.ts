import type { ContactLink, SiteContent } from './types';

const email: ContactLink = {
  label: 'mariajosetolmo@gmail.com',
  href: 'mailto:mariajosetolmo@gmail.com',
};
const phone: ContactLink = {
  label: '+56 9 7453 6288',
  href: 'tel:+56974536288',
};
const linkedin: ContactLink = {
  label: 'LinkedIn',
  href: 'https://linkedin.com/in/mariajosetolmo',
};
const github: ContactLink = {
  label: 'GitHub',
  href: 'https://github.com/MariaJoseTolmo',
};

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
  contact: [email, linkedin, github],
  recruiterContact: [email, phone, linkedin, github],
  footer: 'María José Tolmo Tolmo · Desarrolladora Backend',
};
