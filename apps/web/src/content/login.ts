import type { LoginContent } from './types';

export const login: LoginContent = {
  form: {
    eyebrow: 'Acceso sin contraseña',
    title: 'Acceso para reclutadores',
    lead: 'Te enviamos un enlace de un solo uso. Con él accedes al CV en PDF, contacto directo y la API de prueba.',
    emailLabel: 'Correo corporativo',
    emailPlaceholder: 'nombre@empresa.com',
    companyLabel: 'Empresa',
    companyPlaceholder: 'Nombre de la empresa',
    nameLabel: 'Nombre',
    namePlaceholder: 'Tu nombre',
    submit: 'Enviar enlace de acceso',
    submitting: 'Enviando…',
    privacy:
      'Solo guardo tu correo, empresa y nombre (si los indicas) para saber quién revisó mi perfil. Puedes pedir que lo elimine en cualquier momento.',
    emailEmpty: 'Escribe tu correo para recibir el enlace.',
    emailInvalid: 'Revisa el correo: debe tener el formato nombre@empresa.com.',
    networkError:
      'No pudimos enviar el enlace. Revisa tu conexión e inténtalo de nuevo.',
  },
  sent: {
    eyebrow: '202 Accepted',
    title: 'Revisa tu correo',
    before: 'Si ',
    after:
      ' es válido, recibirás un enlace en unos segundos. Vence en 15 minutos y sirve una sola vez.',
    reset: 'Usar otro correo',
  },
  steps: {
    eyebrow: 'Detrás de este formulario',
    title: 'Qué hace la API NestJS en cada paso',
    items: [
      {
        id: 'magic-link',
        endpoint: 'POST /auth/magic-link',
        detail:
          'Rate limit por IP y correo. Genera un token aleatorio y guarda solo su hash en Redis, con TTL de 15 min.',
      },
      {
        id: 'email',
        endpoint: 'Correo vía SES',
        detail:
          'Respuesta idéntica exista o no el correo, para no revelar quién está registrado.',
      },
      {
        id: 'confirm',
        endpoint: 'Abres el enlace: página /acceso/verificar/',
        detail:
          'Muestra una confirmación en vez de iniciar sesión directo: los previsualizadores no consumen el enlace.',
      },
      {
        id: 'verify',
        endpoint: 'POST /auth/verify',
        detail:
          'Borra el token (un solo uso) y emite JWT RS256 de 15 min + refresh rotativo de 7 días.',
      },
    ],
    footnote:
      'Tokens en cookies HttpOnly, nunca en localStorage. El código y los tests E2E están en el repositorio.',
  },
};
