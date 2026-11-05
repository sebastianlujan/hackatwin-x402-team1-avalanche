import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { NextConfig } from 'next';
import { PHASE_PRODUCTION_BUILD } from 'next/constants.js';

const root = resolve(import.meta.dirname, '../..');

// Dev and start read the Demo 1 env files (the shell wins, then .env); a build reads none.
// Spike: `node --env-file` cannot be used because Next copies Node flags into NODE_OPTIONS, which rejects it.
function loadDemoEnv(): void {
  for (const file of ['.env', '.demo1/demo1.env']) {
    const path = resolve(root, file);
    if (existsSync(path)) process.loadEnvFile(path);
  }
}

// Spike: Turbopack builds the .ts specifiers and JSON import attributes, so the default bundler stays.
export default function config(phase: string): NextConfig {
  if (phase !== PHASE_PRODUCTION_BUILD) loadDemoEnv();
  return {
    transpilePackages: [
      '@hackatwin/agent-kit',
      '@hackatwin/chains',
      '@hackatwin/config',
      '@hackatwin/core',
      '@hackatwin/demo-01-x402-twin',
      '@hackatwin/pricing',
      '@hackatwin/ui',
    ],
    turbopack: { root },
    outputFileTracingRoot: root,
    agentRules: false,
  };
}
