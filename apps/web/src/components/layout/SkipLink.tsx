import styles from './SkipLink.module.css';

export function SkipLink() {
  return (
    <a className={styles.skip} href="#contenido">
      Saltar al contenido
    </a>
  );
}
