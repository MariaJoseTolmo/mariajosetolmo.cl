import type { NextConfig } from 'next';

const mode = process.env.NEXT_PUBLIC_API_MODE ?? 'http';
if (mode !== 'http' && mode !== 'mock') {
  throw new Error(`Invalid NEXT_PUBLIC_API_MODE: ${mode}`);
}

const config: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
};

export default config;
