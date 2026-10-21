import Link from 'next/link';
import type { ReactNode } from 'react';
import { LinkButton } from '@/components/ui/LinkButton';
import { site } from '@/content/site';
import { isCurrentRoute } from './isCurrentRoute';
import { MobileMenu } from './MobileMenu';
import styles from './SiteHeader.module.css';

export type SiteHeaderVariant = 'public' | 'minimal' | 'session';

interface SiteHeaderProps {
  variant: SiteHeaderVariant;
  /** Route of the page being rendered; drives `aria-current="page"`. */
  currentPath?: string;
  /** Session slot, rendered only by the `session` variant. */
  children?: ReactNode;
}

const [domainName = '', ...domainRest] = site.domain.split('.');
const domainSuffix = `.${domainRest.join('.')}`;

export function SiteHeader({
  variant,
  currentPath,
  children,
}: SiteHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.bar}>
        <Link className={styles.logo} href="/" aria-label={site.domain}>
          {domainName}
          <span className={styles.suffix}>{domainSuffix}</span>
        </Link>
        {variant === 'public' ? (
          <>
            <nav className={styles.links} aria-label="Principal">
              <ul role="list" className={styles.list}>
                {site.nav.map((item) => {
                  const current = isCurrentRoute(item.href, currentPath)
                    ? 'page'
                    : undefined;
                  return (
                    <li key={item.href}>
                      {item.emphasis ? (
                        <LinkButton
                          href={item.href}
                          size={44}
                          aria-current={current}
                        >
                          {item.label}
                        </LinkButton>
                      ) : (
                        <Link
                          className={styles.link}
                          href={item.href}
                          aria-current={current}
                        >
                          {item.label}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </nav>
            <MobileMenu items={site.nav} currentPath={currentPath} />
          </>
        ) : null}
        {variant === 'minimal' ? (
          <Link className={styles.back} href="/">
            <span aria-hidden="true">←</span> Volver al inicio
          </Link>
        ) : null}
        {variant === 'session' ? children : null}
      </div>
    </header>
  );
}
