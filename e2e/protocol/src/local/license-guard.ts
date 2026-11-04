import { runGit } from './icm-services.ts';

// Built by concatenation so this file never carries the header it searches for.
export const ecosystemHeader = `SPDX-License-Identifier: ${'LicenseRef'}-Ecosystem`;

// Lists tracked files carrying the SPDX header; a bare mention of the token does not match.
export async function trackedEcosystemFiles(repoDir: string): Promise<string[]> {
  const out = await runGit(['-C', repoDir, 'grep', '-l', '-F', '-e', ecosystemHeader]).catch(
    (error: { code?: number }) => {
      if (error.code === 1) return '';
      throw error;
    },
  );
  return out === '' ? [] : out.split('\n');
}

export async function assertNoEcosystemLicense(repoDir: string): Promise<void> {
  const files = await trackedEcosystemFiles(repoDir);
  if (files.length > 0) throw new Error(`tracked files carry the ecosystem license header: ${files.join(', ')}`);
}
