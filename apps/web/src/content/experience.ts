import type { ExperienceContent } from './types';

export const experience: ExperienceContent = {
  eyebrow: 'GET /api/v1/experience',
  title: 'Trayectoria',
  lead: 'De la coordinación BIM al backend: misma disciplina para modelar sistemas, ahora en código.',
  items: [
    {
      id: 'kabeli',
      period: '2026 · remoto',
      company: 'Kabeli',
      sector: 'Minería',
      role: 'Desarrolladora Backend',
      highlights: [
        'Desarrollo agéntico de software con Claude Code.',
        'Aplicación de Spec-Driven Development.',
        'Desarrollo de un proyecto para el rubro minero.',
      ],
      achievement:
        'me adapté al uso intensivo de IA en el flujo de desarrollo.',
      technologies: ['Claude Code', 'Spec-Driven', 'Node.js'],
    },
    {
      id: 'amecs',
      period: '2025 · remoto',
      company: 'Amecs',
      sector: 'Minería',
      role: 'Desarrolladora Backend',
      highlights: [
        'Desarrollé microservicios consumidores de APIs externas.',
        'Migré microservicios de Java a Node.js.',
        'Realicé modificaciones de componentes en React.',
      ],
      achievement:
        'pasé de una asignación de tiempo parcial a jornada completa en 1 mes.',
      technologies: ['Node.js', 'Java', 'React', 'APIs REST'],
    },
    {
      id: 'accenture',
      period: '2023 – 2024 · remoto',
      company: 'Accenture Chile',
      sector: 'Banca · cliente Banco Itaú',
      role: 'Desarrolladora Backend Node.js',
      highlights: [
        'Desarrollé y mejoré microservicios con Node.js y NestJS.',
        'Implementé Swagger para documentar APIs internas y externas.',
        'Desarrollé y consumí APIs REST con manejo de datos cifrados y reestructuración de información.',
        'Gestioné pipelines de CI/CD en GitHub, monitoreados con Jenkins, para desplegar en QA y producción.',
      ],
      achievement: 'ascendí de desarrolladora Trainee a Junior.',
      technologies: [
        'NestJS',
        'Swagger',
        'GitHub Actions',
        'Jenkins',
        'IBM API Connect',
      ],
    },
    {
      id: 'independiente',
      period: '2020 – 2021',
      company: 'Independiente',
      sector: 'Plataforma inclusiva',
      role: 'Desarrolladora Frontend JavaScript',
      highlights: [
        'Desarrollé el frontend del MVP en JavaScript vanilla.',
        'Implementé el backend con PHP y MySQL.',
      ],
      achievement:
        'lideré un equipo freelance hasta alcanzar la versión funcional del producto.',
    },
    {
      id: 'consultoria',
      period: '2002 – 2019',
      company: 'Consultoría',
      sector: 'Construcción y minería',
      role: 'Coordinadora CAD/BIM',
      highlights: [
        'Desarrollé modelos virtuales de edificaciones complejas.',
        'Realicé simulaciones de desempeño estructural y planificación de obra.',
        'Uso avanzado de Revit, Navisworks, AutoCAD y Civil 3D.',
      ],
      achievement:
        'dirigí equipos de modeladores BIM en proyectos de mediana complejidad.',
    },
  ],
  education: {
    title: 'Formación',
    items: [
      {
        id: 'ciisa',
        title: 'Técnico en Informática, CIISA IPSS',
        period: '2025 · en curso',
      },
      {
        id: 'talento-futuro',
        title: 'Diplomado Java Backend, Talento Futuro',
        period: '2024',
      },
      { id: 'accenture', title: 'Bootcamp Accenture', period: '2023' },
      {
        id: 'desafio-latam',
        title: 'Bootcamp Full Stack JavaScript, Desafío Latam',
        period: '2022',
      },
      {
        id: 'uc',
        title: 'Diplomado BIM, Pontificia Universidad Católica de Chile',
        period: '2013',
      },
    ],
  },
  cta: {
    title: '¿Quieres el CV completo en PDF y mi contacto directo?',
    action: { label: 'Recibir enlace de acceso', href: '/acceso/' },
  },
};
