import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface Violation {
  rule: 'pin' | 'submodule' | 'root-only' | 'secret' | 'pragma';
  file: string;
  message: string;
}

export interface PolicyInput {
  packageDir: string;
  workspaceFile: string;
}

const SEMVER = '\\d+\\.\\d+\\.\\d+(?:-[0-9A-Za-z.-]+)?';
const EXACT_PIN = [
  new RegExp(`^${SEMVER}$`),
  new RegExp(`^npm:@?[\\w.-]+(?:/[\\w.-]+)?@${SEMVER}$`),
  /^github:[\w.-]+\/[\w.-]+#v?\d+\.\d+\.\d+$/,
];
const DEP_FIELDS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'] as const;
const SKIPPED_DIRS = new Set(['node_modules', 'out', 'cache', 'broadcast', '.git']);
const SOLIDITY_DIRS = ['src', 'test', 'script'];
const PRAGMA = /^pragma solidity 0\.8\.30;$/m;
const SECRET_PATTERNS: [RegExp, string][] = [
  [/--broadcast\b/, 'broadcast flag'],
  [/--private-key\b|private[_-]?key/i, 'private key reference'],
  [/\bmnemonic\b/i, 'mnemonic reference'],
  [/key\w*\s*[=:]\s*['"]?(?:0x)?[0-9a-f]{64}\b/i, 'key material'],
  [/\b[a-z][a-z0-9+.-]*:\/\/[^\s/:@$]+:[^\s/@$]+@/i, 'credentialed URL'],
  [/https?:\/\/\S*[?&](?:api[_-]?key|token|secret)=[^$\s&]+/i, 'URL with an API key'],
];

export function isExactPin(spec: string): boolean {
  return EXACT_PIN.some((pattern) => pattern.test(spec));
}

export function parseCatalog(workspaceYaml: string): Record<string, string> {
  const catalog: Record<string, string> = {};
  let inCatalog = false;
  for (const line of workspaceYaml.split('\n')) {
    if (/^catalog:\s*$/.test(line)) {
      inCatalog = true;
      continue;
    }
    if (!inCatalog || line.trim() === '') continue;
    if (!line.startsWith(' ')) break;
    const entry = /^\s+(?:'([^']+)'|"([^"]+)"|([^:\s]+)):\s*(?:'([^']*)'|"([^"]*)"|(\S+))\s*(?:#.*)?$/.exec(line);
    const name = entry?.[1] ?? entry?.[2] ?? entry?.[3];
    const value = entry?.[4] ?? entry?.[5] ?? entry?.[6];
    if (name !== undefined && value !== undefined) catalog[name] = value;
  }
  return catalog;
}

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (SKIPPED_DIRS.has(entry.name)) return [];
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

function checkPins({ packageDir, workspaceFile }: PolicyInput): Violation[] {
  const manifest = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8')) as Record<string, unknown>;
  const catalog = existsSync(workspaceFile) ? parseCatalog(readFileSync(workspaceFile, 'utf8')) : {};
  const found: Violation[] = [];
  for (const field of DEP_FIELDS) {
    const deps = (manifest[field] ?? {}) as Record<string, string>;
    for (const [name, declared] of Object.entries(deps)) {
      const resolved = declared === 'catalog:' ? catalog[name] : declared;
      if (resolved === undefined) {
        found.push({ rule: 'pin', file: 'package.json', message: `${name}: no catalog entry for "${declared}"` });
      } else if (!isExactPin(resolved)) {
        found.push({ rule: 'pin', file: 'package.json', message: `${name}: "${resolved}" is not an exact pin` });
      }
    }
  }
  return found;
}

function checkLayout(packageDir: string): Violation[] {
  const found: Violation[] = [];
  for (const entry of ['.gitmodules', 'lib']) {
    if (existsSync(join(packageDir, entry))) {
      found.push({ rule: 'submodule', file: entry, message: 'git submodules and lib/ are not allowed' });
    }
  }
  const root = readdirSync(packageDir);
  for (const entry of root.filter(
    (name) => name === '.husky' || name === '.github' || /^commitlint\.config\./.test(name),
  )) {
    found.push({ rule: 'root-only', file: entry, message: 'hooks, workflows and commitlint live at the repo root' });
  }
  const manifest = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8')) as {
    scripts?: Record<string, string>;
  };
  if (manifest.scripts && 'deploy:mainnet' in manifest.scripts) {
    found.push({ rule: 'root-only', file: 'package.json', message: 'deploy:mainnet is not allowed' });
  }
  return found;
}

function checkFiles(packageDir: string): Violation[] {
  const found: Violation[] = [];
  const files = walk(packageDir).map((path) => ({ path, rel: relative(packageDir, path) }));
  for (const { path, rel } of files) {
    if (rel.startsWith(join('scripts', 'check-policy'))) continue;
    if (statSync(path).size > 1_000_000) continue;
    const text = readFileSync(path, 'utf8');
    for (const [pattern, label] of SECRET_PATTERNS) {
      if (pattern.test(text)) found.push({ rule: 'secret', file: rel, message: label });
    }
    const topDir = rel.split('/')[0] ?? '';
    if (rel.endsWith('.sol') && SOLIDITY_DIRS.includes(topDir) && !PRAGMA.test(text)) {
      found.push({ rule: 'pragma', file: rel, message: 'missing "pragma solidity 0.8.30;"' });
    }
  }
  return found.sort((a, b) => a.file.localeCompare(b.file));
}

export function checkPolicy(input: PolicyInput): Violation[] {
  return [...checkPins(input), ...checkLayout(input.packageDir), ...checkFiles(input.packageDir)];
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const here = dirname(fileURLToPath(import.meta.url));
  const packageDir = resolve(process.argv[2] ?? join(here, '..'));
  const workspaceFile = resolve(process.argv[3] ?? join(here, '..', '..', '..', 'pnpm-workspace.yaml'));
  const violations = checkPolicy({ packageDir, workspaceFile });
  for (const v of violations) console.error(`${v.rule} ${v.file}: ${v.message}`);
  if (violations.length === 0) console.log('contracts policy: ok');
  process.exitCode = violations.length === 0 ? 0 : 1;
}
