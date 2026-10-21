import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'on-dark';
export type ButtonSize = 44 | 48 | 52;

export interface ButtonStyleProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function buttonClassName({
  variant = 'primary',
  size = 48,
}: ButtonStyleProps): string {
  return [styles.button, styles[variant], styles[`size${size}`]].join(' ');
}
