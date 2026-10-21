import type { ButtonHTMLAttributes } from 'react';
import { buttonClassName, type ButtonStyleProps } from './buttonClassName';

type ButtonProps = ButtonStyleProps & ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({
  variant,
  size,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClassName({ variant, size })}
      {...rest}
    />
  );
}
