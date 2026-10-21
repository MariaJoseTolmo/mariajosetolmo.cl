import { recruiter } from '@/content/recruiter';
import { site } from '@/content/site';
import styles from './ContactCard.module.css';
import { InfoCard } from './InfoCard';

export function ContactCard() {
  return (
    <InfoCard id="contact" title={recruiter.contact.title}>
      <ul className={styles.list} role="list">
        {site.recruiterContact.map((link) => (
          <li key={link.href}>
            <a href={link.href}>{link.label}</a>
          </li>
        ))}
      </ul>
    </InfoCard>
  );
}
