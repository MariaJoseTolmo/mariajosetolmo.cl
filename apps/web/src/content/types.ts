import type { ApiErrorReason } from '../lib/api/error-codes';
import type { ApiErrorKind } from '../lib/api/types';

export interface NavLink {
  label: string;
  href: string;
  /** Renders the item as the header call to action instead of a plain link. */
  emphasis?: boolean;
}

export interface ContactLink {
  label: string;
  href: string;
}

export interface SiteContent {
  domain: string;
  ownerName: string;
  nav: NavLink[];
  contact: ContactLink[];
  /** Public by the owner's decision, but shown only in the recruiter zone. */
  recruiterContact: ContactLink[];
  footer: string;
}

export interface Contribution {
  id: string;
  meta: string;
  title: string;
  text: string;
}

export interface HomeContent {
  hero: {
    eyebrow: string;
    title: string;
    lead: string;
    ctas: NavLink[];
    /** Labeled as an example in the UI; mirrors the planned API contract. */
    sample: { method: string; path: string; status: string; json: string };
  };
  contributions: {
    eyebrow: string;
    title: string;
    items: Contribution[];
  };
  architecture: {
    eyebrow: string;
    title: string;
    lead: string;
    nodes: ArchitectureNode[];
    chips: ContactLink[];
  };
  cta: {
    title: string;
    text: string;
    action: ContactLink;
  };
}

export interface StackColumn {
  id: string;
  title: string;
  items: string[];
  /** Columns still being learned are rendered with a quieter style. */
  muted?: boolean;
}

export interface Project {
  id: string;
  /** Short stack label shown in mono on the left of the row. */
  tags: string;
  title: string;
  summary: string;
  /** Anonymized projects have no public link. */
  href?: string;
}

export interface ArchitectureNode {
  id: string;
  label: string;
  title: string;
  text: string;
  /** The API node is drawn with the 2px accent border. */
  emphasis?: boolean;
}

export interface ExperienceItem {
  id: string;
  /** Display label, e.g. "2023 – 2024 · remoto". */
  period: string;
  company: string;
  sector: string;
  role: string;
  highlights: string[];
  achievement: string;
  technologies?: string[];
}

export interface EducationItem {
  id: string;
  title: string;
  period: string;
}

export interface ExperienceContent {
  eyebrow: string;
  title: string;
  lead: string;
  items: ExperienceItem[];
  education: { title: string; items: EducationItem[] };
  cta: { title: string; action: ContactLink };
}

export interface LoginStep {
  id: string;
  endpoint: string;
  detail: string;
}

export interface LoginContent {
  form: {
    eyebrow: string;
    title: string;
    lead: string;
    emailLabel: string;
    emailPlaceholder: string;
    companyLabel: string;
    companyPlaceholder: string;
    nameLabel: string;
    namePlaceholder: string;
    submit: string;
    submitting: string;
    privacy: string;
    emailEmpty: string;
    emailInvalid: string;
    networkError: string;
    /** Submit button text after a `server` or `network` failure. */
    retryLabel: string;
    /** Login-specific overrides of the API error dictionary. */
    invalidInputError: string;
    serverError: string;
  };
  sent: {
    eyebrow: string;
    title: string;
    /** Rendered as `{before}<strong>{email}</strong>{after}`. */
    before: string;
    after: string;
    reset: string;
  };
  steps: {
    eyebrow: string;
    title: string;
    items: LoginStep[];
    footnote: string;
  };
}

export interface VerifyErrorCopy {
  eyebrow: string;
  title: string;
  text: string;
}

export interface VerifyContent {
  pending: { title: string };
  ready: {
    eyebrow: string;
    title: string;
    lead: string;
    confirm: string;
    confirming: string;
  };
  done: { eyebrow: string; title: string; lead: string; enter: string };
  errors: {
    invalid: VerifyErrorCopy;
    'rate-limited': VerifyErrorCopy;
    unavailable: VerifyErrorCopy;
  };
  newLink: string;
  retry: string;
}

export interface NotFoundContent {
  eyebrow: string;
  title: string;
  text: string;
  action: NavLink;
}

export interface RecruiterContent {
  checking: { title: string };
  error: { title: string; text: string; retry: string };
  intro: { eyebrow: string; lead: string };
  greeting: { base: string; companyPrefix: string };
  cv: {
    title: string;
    text: string;
    download: string;
    preparing: string;
    failed: string;
  };
  contact: { title: string };
  availability: {
    title: string;
    modality: string;
    start: string;
    salary: string;
  };
  session: { logout: string; logoutFailed: string };
  playground: {
    eyebrow: string;
    title: string;
    lead: string;
    groupLabel: string;
    loading: string;
    loadingStatus: string;
    failed: string;
    failedStatus: string;
  };
}

export interface ApiErrorsContent {
  reasons: Record<ApiErrorReason, string>;
  kinds: Record<ApiErrorKind, string>;
  /** Full sentence used when a text needs `{wait}` but no time is known. */
  waitUnknown: string;
  /** Fills `{wait}` for non rate-limited texts when no time is known. */
  waitNeutral: string;
  /** `{count}` is replaced by the rounded-up amount. */
  wait: {
    seconds: string;
    minute: string;
    minutes: string;
    hour: string;
    hours: string;
  };
}
