export type EmailProblem = 'empty' | 'invalid';

const EMAIL = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

/** Shape check only; the API decides whether the address can receive mail. */
export function validateEmail(value: string): EmailProblem | null {
  const email = value.trim();
  if (email === '') return 'empty';
  return EMAIL.test(email) ? null : 'invalid';
}
