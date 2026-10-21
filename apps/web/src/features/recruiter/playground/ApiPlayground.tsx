'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { recruiter } from '@/content/recruiter';
import { loadGateway } from '@/lib/api';
import type { ApiGateway } from '@/lib/api/port';
import { PLAYGROUND_ENDPOINTS } from '@/lib/api/playground-endpoints';
import type { PlaygroundEndpoint } from '@/lib/api/types';
import styles from './ApiPlayground.module.css';
import { EndpointButton } from './EndpointButton';
import { ResponseViewer, type ViewState } from './ResponseViewer';

interface ApiPlaygroundProps {
  /** Injected so tests use a fake gateway instead of module mocks. */
  gatewayLoader?: () => Promise<ApiGateway>;
  /** The session is gone: the zone decides where to send the visitor. */
  onUnauthorized: () => void;
}

const FIRST_ENDPOINT = PLAYGROUND_ENDPOINTS[0];

export function ApiPlayground({
  gatewayLoader = loadGateway,
  onUnauthorized,
}: ApiPlaygroundProps) {
  const copy = recruiter.playground;
  const [selected, setSelected] = useState<PlaygroundEndpoint>(FIRST_ENDPOINT);
  // `idle` only exists for the first render: the live region must be mounted
  // (and empty) before the first "loading" text is set, or it is not spoken.
  const [view, setView] = useState<ViewState>({ phase: 'idle' });
  // Two clicks can land before React re-renders with the busy state.
  const inFlight = useRef(false);
  const mounted = useRef(false);
  const loaderRef = useRef(gatewayLoader);
  const unauthorizedRef = useRef(onUnauthorized);

  useEffect(() => {
    loaderRef.current = gatewayLoader;
    unauthorizedRef.current = onUnauthorized;
  });

  const request = useCallback(async (endpoint: PlaygroundEndpoint) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setSelected(endpoint);
    setView({ phase: 'loading' });
    let next: ViewState = { phase: 'error' };
    let unauthorized = false;
    try {
      const gateway = await loaderRef.current();
      const result = await gateway.call(endpoint);
      if (result.ok) next = { phase: 'done', response: result.data };
      else unauthorized = result.error === 'unauthorized';
    } catch {
      // Falls through to the error view.
    } finally {
      inFlight.current = false;
    }
    if (!mounted.current) return;
    setView(next);
    if (unauthorized) unauthorizedRef.current();
  }, []);

  useEffect(() => {
    mounted.current = true;
    void request(FIRST_ENDPOINT);
    return () => {
      mounted.current = false;
    };
  }, [request]);

  return (
    <section className={styles.section} aria-labelledby="playground-heading">
      <div className={styles.intro}>
        <Eyebrow>{copy.eyebrow}</Eyebrow>
        <h2 id="playground-heading" className={styles.title}>
          {copy.title}
        </h2>
        <p className={styles.lead}>{copy.lead}</p>
      </div>
      <div className={styles.layout}>
        <div role="group" aria-label={copy.groupLabel} className={styles.list}>
          {PLAYGROUND_ENDPOINTS.map((endpoint) => (
            <EndpointButton
              key={endpoint}
              endpoint={endpoint}
              selected={endpoint === selected}
              busy={view.phase === 'loading'}
              onSelect={(value) => void request(value)}
            />
          ))}
        </div>
        <ResponseViewer endpoint={selected} view={view} />
      </div>
    </section>
  );
}
