import type { ApiErrorsContent } from './types';

const OFFICIAL_SITE =
  'La solicitud no llegó desde el sitio oficial. Abre mariajosetolmo.cl directamente e inténtalo de nuevo.';
const INVALID_INPUT = 'Revisa los datos e inténtalo de nuevo.';
const INVALID_TOKEN = 'Este enlace no es válido o ya venció. Pide uno nuevo.';
const UNAUTHENTICATED = 'Tu sesión terminó. Vuelve a ingresar.';
const RATE_LIMITED =
  'Hiciste demasiados intentos. Espera {wait} y vuelve a intentarlo.';
const INTERNAL = 'Algo falló de nuestro lado. Inténtalo de nuevo.';

/**
 * Central, typed copy for API failures. Times are placeholders (`{wait}`,
 * `{count}`): no literal figures live here, the formatter rounds them.
 */
export const apiErrors: ApiErrorsContent = {
  reasons: {
    INVALID_INPUT,
    INVALID_TOKEN,
    UNAUTHENTICATED,
    CDN_REQUIRED: OFFICIAL_SITE,
    ORIGIN_NOT_ALLOWED: OFFICIAL_SITE,
    ROLE_NOT_ALLOWED: 'Tu rol no tiene permiso para ver este recurso.',
    NOT_FOUND: 'No encontramos ese recurso.',
    RATE_LIMITED,
    SERVICE_UNAVAILABLE:
      'El servicio no está disponible en este momento. Inténtalo de nuevo en unos minutos.',
    INTERNAL_ERROR: INTERNAL,
  },
  kinds: {
    unauthorized: UNAUTHENTICATED,
    forbidden:
      'No pudimos procesar la solicitud por una restricción de seguridad. Abre mariajosetolmo.cl directamente e inténtalo de nuevo.',
    'invalid-token': INVALID_TOKEN,
    'invalid-input': INVALID_INPUT,
    'rate-limited': RATE_LIMITED,
    network:
      'No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.',
    server: INTERNAL,
    unexpected: 'Recibimos una respuesta inesperada. Inténtalo de nuevo.',
  },
  waitUnknown:
    'Hiciste demasiados intentos. Espera unos minutos y vuelve a intentarlo.',
  waitNeutral: 'unos minutos',
  wait: {
    seconds: 'unos segundos',
    minute: 'un minuto',
    minutes: '{count} minutos',
    hour: 'una hora',
    hours: '{count} horas',
  },
};
