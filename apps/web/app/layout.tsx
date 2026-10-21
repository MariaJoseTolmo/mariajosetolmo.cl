import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { SkipLink } from '@/components/layout/SkipLink';
import { SITE_URL, pageMetadata } from '@/content/metadata';
import { plexMono, plexSans } from '@/styles/fonts';
import '@/styles/tokens.css';
import '@/styles/globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: pageMetadata.home.title,
  description: pageMetadata.home.description,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" className={`${plexSans.variable} ${plexMono.variable}`}>
      <body>
        <SkipLink />
        {children}
      </body>
    </html>
  );
}
