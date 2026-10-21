import Link from 'next/link';
import type { ComponentProps } from 'react';
import { buttonClassName, type ButtonStyleProps } from './buttonClassName';

type LinkButtonProps = ButtonStyleProps &
  Omit<ComponentProps<typeof Link>, 'className'>;

export function LinkButton({ variant, size, ...rest }: LinkButtonProps) {
  return <Link className={buttonClassName({ variant, size })} {...rest} />;
}
