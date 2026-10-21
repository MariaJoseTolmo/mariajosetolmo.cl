'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Footer } from '@/components/layout/Footer';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { Button } from '@/components/ui/Button';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { recruiter } from '@/content/recruiter';
import { loadGateway } from '@/lib/api';
import type { ApiGateway } from '@/lib/api/port';
import { ContactCard } from './ContactCard';
import { CvCard } from './CvCard';
import { DetailsCard } from './DetailsCard';
import { greeting } from './greeting';
import styles from './RecruiterZone.module.css';
import { isNavigableUrl } from './safeUrl';
import { SessionBar } from './SessionBar';
import { useRecruiterSession } from './useRecruiterSession';

interface RecruiterZoneProps {
  /** Injected so tests use a fake gateway instead of module mocks. */
  gatewayLoader?: () => Promise<ApiGateway>;
  /** Opens the signed CV URL; injected because jsdom cannot navigate. */
  openUrl?: (url: string) => void;
}

const navigateTo = (url: string) => window.location.assign(url);

type CvStatus = 'idle' | 'busy' | 'failed';

/** Heading that takes focus when it appears: the page content just changed. */
function FocusHeading({
  id,
  takeFocus = true,
  children,
}: {
  id?: string;
  takeFocus?: boolean;
  children: string;
}) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (takeFocus) ref.current?.focus();
  }, [takeFocus]);
  return (
    <h1 ref={ref} id={id} tabIndex={-1} className={styles.title}>
      {children}
    </h1>
  );
}

export function RecruiterZone({
  gatewayLoader = loadGateway,
  openUrl = navigateTo,
}: RecruiterZoneProps) {
  const router = useRouter();
  const { state, retry } = useRecruiterSession(gatewayLoader);
  const [cvStatus, setCvStatus] = useState<CvStatus>('idle');
  const [logoutFailed, setLogoutFailed] = useState(false);
  // "Reintentar" removes its own button: focus follows to the next heading.
  const [retried, setRetried] = useState(false);
  // The live region must exist before its text does, or it is not announced.
  const [mounted, setMounted] = useState(false);
  // Two clicks can land before React re-renders with the busy state.
  const downloading = useRef(false);
  const loggingOut = useRef(false);

  useEffect(() => {
    // Flipping after mount is the point: the first render (and the prerendered
    // HTML) must carry an empty region.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  useEffect(() => {
    if (state.status === 'redirecting') router.replace('/acceso/');
  }, [state.status, router]);

  async function handleDownload() {
    if (downloading.current) return;
    downloading.current = true;
    setCvStatus('busy');
    try {
      const gateway = await gatewayLoader();
      const result = await gateway.getCvLink();
      if (!result.ok && result.error === 'unauthorized') {
        router.replace('/acceso/');
        return;
      }
      if (result.ok && isNavigableUrl(result.data.url)) {
        openUrl(result.data.url);
        setCvStatus('idle');
        return;
      }
    } catch {
      // Falls through to the failed state.
    } finally {
      downloading.current = false;
    }
    setCvStatus('failed');
  }

  async function handleLogout() {
    if (loggingOut.current) return;
    loggingOut.current = true;
    setLogoutFailed(false);
    try {
      const gateway = await gatewayLoader();
      const result = await gateway.logout();
      // An already-expired session is as good as logged out.
      if (result.ok || result.error === 'unauthorized') {
        router.replace('/');
        return;
      }
    } catch {
      // Falls through to the warning.
    } finally {
      loggingOut.current = false;
    }
    setLogoutFailed(true);
  }

  if (state.status === 'authorized') {
    const { me } = state;
    return (
      <>
        <SiteHeader variant="session">
          <SessionBar
            email={me.email}
            role={me.role}
            onLogout={() => void handleLogout()}
          />
        </SiteHeader>
        <main id="contenido" className={styles.main}>
          {logoutFailed ? (
            <p role="alert" className={styles.alert}>
              {recruiter.session.logoutFailed}
            </p>
          ) : null}
          <div className={styles.intro}>
            <Eyebrow>{recruiter.intro.eyebrow}</Eyebrow>
            <FocusHeading>{greeting(me)}</FocusHeading>
            <p className={styles.lead}>{recruiter.intro.lead}</p>
          </div>
          <div className={styles.grid}>
            <CvCard
              onDownload={() => void handleDownload()}
              busy={cvStatus === 'busy'}
              failed={cvStatus === 'failed'}
            />
            <ContactCard />
            <DetailsCard availability={me.availability} />
          </div>
        </main>
        <Footer />
      </>
    );
  }

  const checking = state.status !== 'error';
  return (
    <>
      <SiteHeader variant="minimal" />
      <main id="contenido" className={styles.main}>
        {state.status === 'error' ? (
          <div className={styles.notice}>
            <FocusHeading>{recruiter.error.title}</FocusHeading>
            <p className={styles.lead}>{recruiter.error.text}</p>
            <Button
              size={48}
              onClick={() => {
                setRetried(true);
                retry();
              }}
            >
              {recruiter.error.retry}
            </Button>
          </div>
        ) : (
          <FocusHeading takeFocus={retried}>
            {recruiter.checking.title}
          </FocusHeading>
        )}
        <div role="status" className={styles.live}>
          {checking && mounted ? recruiter.checking.title : ''}
        </div>
      </main>
      <Footer />
    </>
  );
}
