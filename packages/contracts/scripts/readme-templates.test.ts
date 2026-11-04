import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const readme = readFileSync(join(import.meta.dirname, '../README.md'), 'utf8');
const templates = readme.slice(readme.indexOf('## Verification templates')).split('```bash').slice(1);
const [fuji, l1] = templates.map((block) => block.split('```')[0] ?? '');
const heading = (needle: string): string => readme.split('\n').find((line) => line.includes(needle)) ?? '';

describe('verification templates', () => {
  it('has a Snowtrace command for Fuji and a Builder Hub command for the L1', () => {
    expect(templates).toHaveLength(2);
    expect(fuji).toContain('--chain-id 43113');
    expect(fuji).toContain('routescan.io/v2/network/testnet/evm/43113');
    expect(l1).toContain('--verifier custom');
    expect(l1).toContain('<builder-hub-verifier-url>');
  });

  it('reuses solc 0.8.30, cancun and the build optimizer runs in both commands', () => {
    for (const command of [fuji, l1]) {
      expect(command).toContain('--compiler-version 0.8.30');
      expect(command).toContain('--evm-version cancun');
      expect(command).toContain('--optimizer-runs 10000');
    }
  });

  it('labels the L1 verifier unverified and passes no key or broadcast flag', () => {
    expect(heading('L1, Builder Hub verifier')).toContain('UNVERIFIED');
    for (const flag of [['', '', 'broadcast'].join('-'), ['', '', 'private', 'key'].join('-')]) {
      expect(readme).not.toContain(flag);
    }
  });
});
