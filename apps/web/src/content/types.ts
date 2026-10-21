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
}

export interface StackColumn {
  id: string;
  title: string;
  items: string[];
  /** Columns still being learned are rendered with a quieter style. */
  muted?: boolean;
}
