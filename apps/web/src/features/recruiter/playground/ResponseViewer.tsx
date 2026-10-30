import { CodeWindow } from '@/components/ui/CodeWindow';
import { recruiter } from '@/content/recruiter';
import { apiErrorMessage } from '@/lib/apiErrorMessage';
import type { PlaygroundEndpoint, RawResponse } from '@/lib/api/types';
import { playgroundOverrides } from '../recruiterOverrides';
import styles from './ResponseViewer.module.css';

export type ViewState =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'error' }
  | { phase: 'done'; response: RawResponse };

interface ResponseViewerProps {
  endpoint: PlaygroundEndpoint;
  view: ViewState;
}

// HTTP/2 sends no reason phrase; the viewer shows the familiar one.
const REASONS: Record<number, string> = {
  200: 'OK',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
};

const statusLine = ({ status, statusText }: RawResponse) =>
  [status, statusText || REASONS[status]].filter(Boolean).join(' ');

function describe(view: ViewState) {
  const copy = recruiter.playground;
  switch (view.phase) {
    case 'idle':
      return { status: '', code: '', announcement: '' };
    case 'loading':
      return {
        status: copy.loadingStatus,
        code: '',
        announcement: copy.loading,
      };
    case 'error':
      return { status: copy.failedStatus, code: '', announcement: copy.failed };
    case 'done':
      return {
        status: statusLine(view.response),
        code: JSON.stringify(view.response.body, null, 2),
        announcement: '',
      };
  }
}

export function ResponseViewer({ endpoint, view }: ResponseViewerProps) {
  const { status, code, announcement } = describe(view);
  // The status line is announced instead of the JSON: a long payload read out
  // in full is noise. The region is always mounted so later text is spoken.
  const explanation =
    view.phase === 'done' && view.response.failure
      ? apiErrorMessage(view.response.failure, playgroundOverrides)
      : '';
  const spoken =
    view.phase === 'done'
      ? [`GET ${endpoint}: ${status}`, explanation].filter(Boolean).join('. ')
      : announcement;
  return (
    <div className={styles.viewer}>
      <p role="status" className={styles.live}>
        {spoken}
      </p>
      <CodeWindow method="GET" path={endpoint} status={status} code={code} />
      {explanation ? <p className={styles.error}>{explanation}</p> : null}
      {view.phase === 'error' ? (
        <p className={styles.error}>{announcement}</p>
      ) : null}
    </div>
  );
}
