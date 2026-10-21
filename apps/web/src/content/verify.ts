import type { VerifyContent } from './types';

export const verify: VerifyContent = {
  pending: { title: 'Cargando…' },
  ready: {
    eyebrow: 'Enlace de un solo uso',
    title: 'Confirma tu ingreso',
    lead: 'Un clic más. Este paso evita que los previsualizadores de enlaces de tu correo consuman el acceso antes que tú.',
    confirm: 'Confirmar ingreso',
    confirming: 'Confirmando…',
  },
  done: {
    eyebrow: '200 OK · sesión iniciada',
    title: 'Bienvenida, bienvenido',
    lead: 'Tu sesión dura 7 días y se renueva sola. Puedes cerrarla cuando quieras.',
    enter: 'Entrar a la zona reclutador',
  },
  errors: {
    invalid: {
      eyebrow: 'Enlace no disponible',
      title: 'Este enlace no es válido',
      text: 'Puede haber vencido (dura 15 minutos), haberse usado ya o estar incompleto. Pide uno nuevo para continuar.',
    },
    'rate-limited': {
      eyebrow: '429 Too Many Requests',
      title: 'Demasiados intentos',
      text: 'Espera unos minutos y pide un enlace nuevo.',
    },
    unavailable: {
      eyebrow: 'Sin conexión con la API',
      title: 'No pudimos confirmar tu ingreso',
      text: 'Revisa tu conexión e inténtalo de nuevo. Si el enlace ya se usó, pide uno nuevo en /acceso/.',
    },
  },
  newLink: 'Pedir un nuevo enlace',
  retry: 'Reintentar',
};
