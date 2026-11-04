import { resolve } from 'node:path';
import type { NextConfig } from 'next';

const root = resolve(import.meta.dirname, '../..');

// Spike: Turbopack builds the .ts specifiers and JSON import attributes, so the default bundler stays.
const config: NextConfig = {
  transpilePackages: [
    '@hackatwin/agent-kit',
    '@hackatwin/chains',
    '@hackatwin/config',
    '@hackatwin/core',
    '@hackatwin/demo-01-x402-twin',
    '@hackatwin/pricing',
  ],
  turbopack: { root },
  outputFileTracingRoot: root,
};

export default config;
