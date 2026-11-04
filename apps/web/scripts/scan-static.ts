import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// The CI web-build job sets these values; they must never reach the client bundle.
export const SENTINELS = ['hackatwin-sentinel-anthropic', 'hackatwin-sentinel-keystore'] as const;
export const FORBIDDEN = [...SENTINELS, 'ANTHROPIC_API_KEY', 'KEYSTORE', 'anvil_'] as const;

export interface Finding {
  readonly file: string;
  readonly token: string;
}

export function scanDirectory(dir: string): Finding[] {
  const findings: Finding[] = [];
  const walk = (path: string): void => {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      const full = join(path, entry.name);
      if (entry.isDirectory()) walk(full);
      else {
        const text = readFileSync(full, 'utf8');
        for (const token of FORBIDDEN) if (text.includes(token)) findings.push({ file: full, token });
      }
    }
  };
  walk(dir);
  return findings;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = resolve(process.argv[2] ?? join(import.meta.dirname, '../.next/static'));
  const findings = scanDirectory(dir);
  for (const f of findings) console.error(`${f.file}: contains ${f.token}`);
  if (findings.length > 0) process.exit(1);
  console.log(`scan-static: ${dir} is clean`);
}
