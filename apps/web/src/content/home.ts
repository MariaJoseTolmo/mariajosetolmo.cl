import { REPOSITORY_URL } from './projects';
import type { HomeContent } from './types';

const sampleJson = `{
  "name": "María José Tolmo",
  "role": "Backend Developer",
  "stack": ["Node.js", "NestJS", "TypeScript",
            "PostgreSQL", "Redis", "Kafka en local / SQS en producción"],
  "architecture": "hexagonal",
  "domains": ["banca", "minería"],
  "workflow": "spec-driven + Claude Code",
  "openToWork": true
}`;

export const home: HomeContent = {
  hero: {
    eyebrow: 'Desarrolladora Backend · Node.js / NestJS · Santiago, Chile',
    title: 'Microservicios con NestJS para banca y minería.',
    lead: 'María José Tolmo. Más de 3 años construyendo APIs REST con arquitectura hexagonal, datos cifrados y despliegue continuo a producción. Antes, 17 años modelando sistemas complejos como coordinadora BIM.',
    ctas: [
      { label: 'Solicitar CV completo', href: '/acceso/' },
      { label: 'Ver experiencia', href: '/experiencia/' },
    ],
    sample: {
      method: 'GET',
      path: '/api/v1/profile',
      status: '200 OK',
      json: sampleJson,
    },
  },
  contributions: {
    eyebrow: '01 / Lo que aporto',
    title: 'Experiencia en contextos donde un error cuesta caro.',
    items: [
      {
        id: 'banca',
        meta: 'Banca · Accenture / Itaú',
        title: 'APIs con datos cifrados, en producción',
        text: 'Microservicios en NestJS, documentación con Swagger y pipelines CI/CD hacia QA y producción. Ascenso de Trainee a Junior.',
      },
      {
        id: 'mineria',
        meta: 'Minería · Kabeli, Amecs',
        title: 'Migración Java → Node.js y desarrollo agéntico',
        text: 'Microservicios consumidores de APIs externas, Spec-Driven Development y uso intensivo de IA con Claude Code.',
      },
      {
        id: 'bim',
        meta: '17 años · Coordinación BIM',
        title: 'De modelar edificios a modelar dominios',
        text: 'Coordinación de disciplinas y liderazgo de equipos en proyectos complejos: la misma base que pide un sistema bien diseñado.',
      },
    ],
  },
  architecture: {
    eyebrow: '04 / Cómo está hecha esta web',
    title: 'El portafolio también es el código de muestra.',
    lead: 'Sitio estático servido por CloudFront y una API NestJS propia en AWS Lambda. AWS es lo que estoy aprendiendo, aplicado en este proyecto. Puedes revisar la documentación de los endpoints y el estado de la API.',
    nodes: [
      {
        id: 'frontend',
        label: 'frontend',
        title: 'Next.js estático',
        text: 'Generado en el build, en S3 + CloudFront',
      },
      {
        id: 'api',
        label: 'api',
        title: 'NestJS · hexagonal',
        text: 'En AWS Lambda. Magic link + JWT RS256, refresh rotativo, guards por rol',
        emphasis: true,
      },
      {
        id: 'datos',
        label: 'datos',
        title: 'PostgreSQL · Redis',
        text: 'Contenido, sesiones, rate limit',
      },
    ],
    chips: [
      { label: '/api/docs', href: '/api/docs' },
      { label: '/api/health', href: '/api/health' },
      { label: 'Repositorio', href: REPOSITORY_URL },
    ],
  },
  cta: {
    title: '¿Buscas una desarrolladora backend Node.js?',
    text: 'Ingresa con tu correo, sin contraseña. Accedes al CV completo, contacto directo y la API de prueba.',
    action: { label: 'Recibir enlace de acceso', href: '/acceso/' },
  },
};
