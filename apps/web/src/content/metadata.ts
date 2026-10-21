import { site } from './site';

export const SITE_URL = `https://${site.domain}`;

/** Routes search engines may index; also the sitemap, in this order. */
export const PUBLIC_ROUTES = ['/', '/experiencia/', '/acceso/'] as const;

export const NOINDEX = { index: false, follow: false } as const;

const owner = site.ownerName;

/** Per-page `<title>` and description (Spanish; one pair per page). */
export const pageMetadata = {
  home: {
    title: `${owner} · Desarrolladora Backend`,
    description:
      'Desarrolladora Backend en Node.js y NestJS: microservicios para banca y minería. Proyectos, stack y cómo está hecha esta web.',
  },
  experience: {
    title: `Experiencia · ${owner}`,
    description:
      'Trayectoria de María José Tolmo: de la coordinación BIM al desarrollo backend, con proyectos en minería y banca.',
  },
  access: {
    title: `Acceso para reclutadores · ${owner}`,
    description:
      'Solicita un enlace de un solo uso para ver el CV en PDF, el contacto directo y la API de prueba.',
  },
  verify: {
    title: `Confirmar ingreso · ${owner}`,
    description: 'Confirma tu ingreso con el enlace de un solo uso.',
  },
  recruiter: {
    title: `Zona reclutador · ${owner}`,
    description:
      'Zona privada para reclutadores: CV completo, contacto directo y API de prueba.',
  },
  notFound: {
    title: `Página no encontrada · ${owner}`,
    description: 'La página que buscas no existe o cambió de dirección.',
  },
} as const;
