import { SessionPolicy } from '../../domain/session-policy';

export interface RenderedEmail {
  readonly subject: string;
  readonly text: string;
  readonly html: string;
}

const MINUTES = SessionPolicy.MAGIC_LINK_TTL_SECONDS / 60;

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/**
 * Spanish, like the site the recruiter signs in on. The link is the only
 * dynamic part; the token rides in its fragment, never in a query string.
 */
export function renderMagicLinkEmail(link: string): RenderedEmail {
  const text = [
    'Hola,',
    '',
    `Usa este enlace para ingresar. Vence en ${MINUTES} minutos y sirve una sola vez:`,
    '',
    link,
    '',
    'Si no lo pediste, ignora este correo.',
  ].join('\n');
  const safeLink = escapeHtml(link);
  const html = [
    '<p>Hola,</p>',
    `<p>Usa este enlace para ingresar. Vence en ${MINUTES} minutos y sirve una sola vez:</p>`,
    `<p><a href="${safeLink}">Ingresar</a></p>`,
    '<p>Si no lo pediste, ignora este correo.</p>',
  ].join('\n');
  return { subject: 'Tu enlace de acceso', text, html };
}
