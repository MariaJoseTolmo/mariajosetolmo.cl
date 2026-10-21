import { site } from '@/content/site';
import styles from './Footer.module.css';

export function Footer() {
  return (
    <footer className={styles.footer}>
      <span>{site.footer}</span>
      <span className={styles.links}>
        {site.contact.map((link) => (
          <a key={link.href} href={link.href}>
            {link.label}
          </a>
        ))}
      </span>
    </footer>
  );
}
