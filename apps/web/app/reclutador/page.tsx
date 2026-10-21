import type { Metadata } from 'next';
import { RecruiterZone } from '@/features/recruiter/RecruiterZone';

export const metadata: Metadata = {
  title: 'Zona reclutador · María José Tolmo Tolmo',
  robots: { index: false, follow: false },
};

export default function RecruiterPage() {
  return <RecruiterZone />;
}
