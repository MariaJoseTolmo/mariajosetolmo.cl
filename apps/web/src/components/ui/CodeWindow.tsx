import { highlightJson } from './highlightJson';
import styles from './CodeWindow.module.css';

interface CodeWindowProps {
  method: string;
  path: string;
  status: string;
  /** JSON text, rendered verbatim with keys and strings highlighted. */
  code: string;
  /** Optional line under the request bar, e.g. to label the payload as an example. */
  note?: string;
}

export function CodeWindow({
  method,
  path,
  status,
  code,
  note,
}: CodeWindowProps) {
  return (
    <figure
      className={styles.window}
      aria-label={`${method} ${path} ${status}`}
    >
      <figcaption className={styles.bar}>
        <span>
          <span className={styles.method}>{method}</span> {path}
        </span>
        <span className={styles.status}>{status}</span>
      </figcaption>
      {note ? <p className={styles.note}>{note}</p> : null}
      <pre className={styles.code}>
        {highlightJson(code).map((token, index) =>
          token.kind === 'text' ? (
            token.text
          ) : (
            <span key={index} className={styles[token.kind]}>
              {token.text}
            </span>
          ),
        )}
      </pre>
    </figure>
  );
}
