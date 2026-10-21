import type { ComponentPropsWithRef } from 'react';
import styles from './FormField.module.css';

interface FormFieldProps extends Omit<
  ComponentPropsWithRef<'input'>,
  'id' | 'className'
> {
  id: string;
  label: string;
  optional?: boolean;
  /** Validation message; announced with role="alert" and tied to the input. */
  error?: string;
}

export function FormField({
  id,
  label,
  optional = false,
  error,
  ...inputProps
}: FormFieldProps) {
  const errorId = `${id}-error`;
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
        {optional ? <span className={styles.optional}> (opcional)</span> : null}
      </label>
      <input
        {...inputProps}
        id={id}
        className={styles.input}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={error ? errorId : undefined}
      />
      {error ? (
        <p id={errorId} className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
