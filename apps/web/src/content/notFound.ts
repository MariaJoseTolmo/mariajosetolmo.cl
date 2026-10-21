import type { NotFoundContent } from './types';

export const notFound: NotFoundContent = {
  eyebrow: 'GET · 404 Not Found',
  title: 'Página no encontrada',
  text: 'La dirección que buscas no existe o cambió de lugar.',
  action: { label: 'Volver al inicio', href: '/' },
};
