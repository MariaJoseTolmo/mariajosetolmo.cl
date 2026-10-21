import { recruiter } from '@/content/recruiter';
import type { Me } from '@/lib/api/types';

/** Company wins over name; blanks count as missing. */
export function greeting({ company, name }: Pick<Me, 'company' | 'name'>) {
  const { base, companyPrefix } = recruiter.greeting;
  const companyText = company?.trim();
  if (companyText) return `${base}, ${companyPrefix} ${companyText}`;
  const nameText = name?.trim();
  if (nameText) return `${base}, ${nameText}`;
  return base;
}
