import type { RecruiterContent } from './types';

export const recruiter: RecruiterContent = {
  checking: { title: 'Verificando sesión' },
  error: {
    title: 'No pudimos verificar tu sesión',
    retry: 'Reintentar',
  },
  intro: {
    eyebrow: 'GET /recruiter · 200 OK',
    lead: 'Aquí tienes lo necesario para avanzar: el CV y mi contacto directo.',
  },
  greeting: {
    base: 'Gracias por tu interés',
    companyPrefix: 'equipo de',
  },
  cv: {
    title: 'CV completo',
    text: 'Versión actualizada, con logros y formación.',
    download: 'Descargar PDF',
    preparing: 'Preparando…',
    failed: 'No pudimos generar el enlace del CV. Inténtalo de nuevo.',
  },
  contact: { title: 'Contacto directo' },
  availability: {
    title: 'Disponibilidad',
    modality: 'Modalidad',
    start: 'Inicio',
    salary: 'Renta',
  },
  session: {
    logout: 'Cerrar sesión',
    logoutFailed: 'No pudimos cerrar la sesión. Inténtalo de nuevo.',
  },
  playground: {
    eyebrow: 'API Playground',
    title: 'Prueba la API que alimenta este sitio',
    lead: 'Elige un endpoint. Tu sesión ya incluye el JWT, así que también funcionan los privados.',
    groupLabel: 'Endpoints',
    loading: 'Cargando respuesta…',
    loadingStatus: 'Cargando…',
    failed:
      'No pudimos obtener la respuesta. Vuelve a elegir el endpoint para reintentar.',
    failedStatus: 'Sin respuesta',
    roleNotAllowed:
      'Respuesta esperada: este endpoint es solo para el rol ADMIN.',
  },
};
