'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { LinkButton } from '@/components/ui/LinkButton';
import type { NavLink } from '@/content/types';
import { isCurrentRoute } from './isCurrentRoute';
import styles from './MobileMenu.module.css';

const PANEL_ID = 'mobile-nav-panel';
/** Must match the header breakpoint in SiteHeader.module.css / MobileMenu.module.css. */
const DESKTOP_QUERY = '(min-width: 900px)';

interface MobileMenuProps {
  items: NavLink[];
  currentPath?: string;
}

export function MobileMenu({ items, currentPath }: MobileMenuProps) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);

  // Closing must never strand focus inside the hidden panel.
  const close = useCallback(() => {
    if (panelRef.current?.contains(document.activeElement)) {
      buttonRef.current?.focus();
    }
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia(DESKTOP_QUERY);
    const onChange = (event: { matches: boolean }) => {
      if (event.matches) close();
    };
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [close]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={styles.toggle}
        aria-expanded={open}
        aria-controls={PANEL_ID}
        aria-label="Menú"
        onClick={() => setOpen((value) => !value)}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>
      <nav
        ref={panelRef}
        id={PANEL_ID}
        className={styles.panel}
        aria-label="Menú móvil"
        hidden={!open}
      >
        <ul role="list" className={styles.list}>
          {items.map((item) => (
            <li
              key={item.href}
              className={item.emphasis ? styles.cta : styles.item}
            >
              {item.emphasis ? (
                <LinkButton
                  href={item.href}
                  size={48}
                  aria-current={
                    isCurrentRoute(item.href, currentPath) ? 'page' : undefined
                  }
                  onClick={close}
                >
                  {item.label}
                </LinkButton>
              ) : (
                <Link
                  className={styles.link}
                  href={item.href}
                  aria-current={
                    isCurrentRoute(item.href, currentPath) ? 'page' : undefined
                  }
                  onClick={close}
                >
                  {item.label}
                </Link>
              )}
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
