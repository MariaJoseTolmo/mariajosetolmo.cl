import type { Metadata } from 'next';
import { NOINDEX, pageMetadata } from '@/content/metadata';
import { RecruiterZone } from '@/features/recruiter/RecruiterZone';

export const metadata: Metadata = {
  ...pageMetadata.recruiter,
  robots: NOINDEX,
};

export default function RecruiterPage() {
  return <RecruiterZone />;
}
