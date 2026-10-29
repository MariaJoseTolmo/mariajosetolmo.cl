import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import { Button } from '@/components/ui/Button';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { FormField } from '@/components/ui/FormField';
import { login } from '@/content/login';
import type { MagicLinkRequest } from '@/lib/api/types';
import styles from './LoginForm.module.css';
import { validateEmail } from './validateEmail';

interface LoginFormProps {
  onSubmit: (request: MagicLinkRequest) => void;
  submitting?: boolean;
  /** Copy of the failure to show (from `apiErrorMessage`); never the raw API message. */
  errorMessage?: string;
  /** The single submit button reads "Reintentar" (server and network failures). */
  retry?: boolean;
  /** Focus the email field on mount (after "Usar otro correo"). */
  autoFocusEmail?: boolean;
}

function buildRequest(
  email: string,
  company: string,
  name: string,
): MagicLinkRequest {
  const request: MagicLinkRequest = { email: email.trim() };
  if (company.trim() !== '') request.company = company.trim();
  if (name.trim() !== '') request.name = name.trim();
  return request;
}

export function LoginForm({
  onSubmit,
  submitting = false,
  errorMessage,
  retry = false,
  autoFocusEmail = false,
}: LoginFormProps) {
  const copy = login.form;
  const emailRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [name, setName] = useState('');
  const [emailError, setEmailError] = useState<string>();

  useEffect(() => {
    if (autoFocusEmail) emailRef.current?.focus();
  }, [autoFocusEmail]);

  const messageFor = (problem: ReturnType<typeof validateEmail>) => {
    if (!problem) return undefined;
    return problem === 'empty' ? copy.emailEmpty : copy.emailInvalid;
  };

  // While an error is shown, re-validate on every change so it clears as soon
  // as the value is valid. The message text is unchanged while still invalid,
  // so the live region is not re-announced on each keystroke.
  const handleEmail = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setEmail(value);
    if (emailError) setEmailError(messageFor(validateEmail(value)));
  };

  // Blur reports only a typed-but-invalid value; empty is left to submit so
  // tabbing through the field does not nag. Focus is never moved here.
  const handleEmailBlur = () => {
    if (email.trim() === '') return;
    const message = messageFor(validateEmail(email));
    if (message) setEmailError(message);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    const problem = validateEmail(email);
    if (problem) {
      setEmailError(messageFor(problem));
      emailRef.current?.focus();
      return;
    }
    onSubmit(buildRequest(email, company, name));
  };

  return (
    <div className={styles.view}>
      <div className={styles.intro}>
        <Eyebrow>{copy.eyebrow}</Eyebrow>
        <h1 id="login-heading" className={styles.title}>
          {copy.title}
        </h1>
        <p className={styles.lead}>{copy.lead}</p>
      </div>
      <form
        className={styles.form}
        aria-labelledby="login-heading"
        aria-busy={submitting}
        noValidate
        onSubmit={handleSubmit}
      >
        <FormField
          ref={emailRef}
          id="email"
          name="email"
          type="email"
          label={copy.emailLabel}
          autoComplete="email"
          placeholder={copy.emailPlaceholder}
          required
          value={email}
          onChange={handleEmail}
          onBlur={handleEmailBlur}
          error={emailError}
        />
        <FormField
          id="empresa"
          name="empresa"
          type="text"
          label={copy.companyLabel}
          optional
          autoComplete="organization"
          placeholder={copy.companyPlaceholder}
          value={company}
          onChange={(event) => setCompany(event.target.value)}
        />
        <FormField
          id="nombre"
          name="nombre"
          type="text"
          label={copy.nameLabel}
          optional
          autoComplete="name"
          placeholder={copy.namePlaceholder}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        {errorMessage && !emailError ? (
          <p className={styles.networkError} role="alert">
            {errorMessage}
          </p>
        ) : null}
        <Button type="submit" size={52} disabled={submitting}>
          {submitting
            ? copy.submitting
            : retry && !emailError
              ? copy.retryLabel
              : copy.submit}
        </Button>
        <p className={styles.privacy}>{copy.privacy}</p>
      </form>
    </div>
  );
}
