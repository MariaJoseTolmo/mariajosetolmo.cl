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
