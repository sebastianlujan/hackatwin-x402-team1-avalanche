import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, posix } from 'node:path';

export interface Manifest {
  readonly name?: string;
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly devDependencies?: Readonly<Record<string, string>>;
  readonly peerDependencies?: Readonly<Record<string, string>>;
  readonly optionalDependencies?: Readonly<Record<string, string>>;
}

// Paths are posix and relative to the repo root.
export interface Snapshot {
  readonly manifests: Readonly<Record<string, Manifest>>;
  readonly files: Readonly<Record<string, string>>;
}

export interface Violation {
  readonly rule: 'R1' | 'R2' | 'R3' | 'R4' | 'R5' | 'R6';
  readonly file: string;
  readonly specifier: string;
  readonly reason: string;
}

const ROOTS = ['apps', 'packages', 'demos', 'e2e'];
const SKIP = new Set(['node_modules', 'dist', 'build', 'coverage', '.next', '.docusaurus']);
const SOURCE = /\.(?:ts|tsx|mts|cts)$/;
const DEMO_PREFIX = '@hackatwin/demo-';
const LOADER = 'packages/config/src/load-profile.ts';

export function readSnapshot(root: string): Snapshot {
  const manifests: Record<string, Manifest> = {};
  const files: Record<string, string> = {};
  const walk = (rel: string): void => {
    for (const entry of readdirSync(join(root, rel), { withFileTypes: true })) {
      const path = posix.join(rel, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP.has(entry.name)) walk(path);
      } else if (entry.name === 'package.json') {
        manifests[path] = JSON.parse(readFileSync(join(root, path), 'utf8')) as Manifest;
      } else if (SOURCE.test(entry.name)) {
        files[path] = readFileSync(join(root, path), 'utf8');
      }
    }
  };
  for (const top of ROOTS) walk(top);
  return { manifests, files };
}

const SPECIFIER_PATTERNS = [
  /\b(?:import|export)\b[^'"`;]*?\bfrom\s*['"]([^'"]+)['"]/g,
  /\bimport\s*['"]([^'"]+)['"]/g,
  /\bimport\s*\(\s*['"]([^'"]+)['"]/g,
  /\brequire\s*\(\s*['"]([^'"]+)['"]/g,
];

export function extractSpecifiers(source: string): string[] {
  return SPECIFIER_PATTERNS.flatMap((pattern) => [...source.matchAll(pattern)].map((m) => m[1] as string));
}

const isTestFile = (file: string): boolean => /\.test\.tsx?$/.test(file);
const usesProcessEnv = (source: string): boolean => /\bprocess\s*(?:\.\s*env\b|\[\s*['"]env['"]\s*\])/.test(source);
const demoId = (specifier: string): string | undefined => /^(@hackatwin\/demo-[a-z0-9-]+)/.exec(specifier)?.[1];
const dependencyNames = (manifest: Manifest): string[] => [
  ...Object.keys(manifest.dependencies ?? {}),
  ...Object.keys(manifest.devDependencies ?? {}),
  ...Object.keys(manifest.peerDependencies ?? {}),
  ...Object.keys(manifest.optionalDependencies ?? {}),
];

export function checkDependencyRule(snapshot: Snapshot): Violation[] {
  const violations: Violation[] = [];
  const add = (rule: Violation['rule'], file: string, specifier: string, reason: string): void => {
    violations.push({ rule, file, specifier, reason });
  };
  const workspaces = Object.keys(snapshot.manifests).map((path) => dirname(path));
  const ownerOf = (file: string): string | undefined =>
    workspaces.filter((dir) => file.startsWith(`${dir}/`)).sort((a, b) => b.length - a.length)[0];

  for (const [path, manifest] of Object.entries(snapshot.manifests)) {
    const dir = dirname(path);
    if (dir === 'packages/core') {
      for (const key of ['dependencies', 'peerDependencies', 'optionalDependencies'] as const) {
        for (const name of Object.keys(manifest[key] ?? {})) add('R1', path, name, `core declares ${key}`);
      }
    }
    const isLibrary = dir.startsWith('packages/') || dir.startsWith('apps/');
    for (const name of dependencyNames(manifest)) {
      if (!name.startsWith(DEMO_PREFIX)) continue;
      if (isLibrary) add('R2', path, name, 'packages and apps must not depend on demos');
      else if (dir.startsWith('demos/') && name !== manifest.name && !dir.startsWith('demos/03-')) {
        add('R3', path, name, 'only Demo 3 may depend on another demo');
      }
    }
  }

  for (const [file, source] of Object.entries(snapshot.files)) {
    const owner = ownerOf(file);
    if (owner === undefined) continue;
    const ownerName = snapshot.manifests[`${owner}/package.json`]?.name;
    const fromLibrary = owner.startsWith('packages/') || owner.startsWith('apps/');
    const fromDemo = owner.startsWith('demos/');
    const fromE2e = owner.startsWith('e2e/');

    for (const specifier of extractSpecifiers(source)) {
      const relative = specifier.startsWith('.');
      if (owner === 'packages/core' && !relative && !isTestFile(file)) {
        add('R1', file, specifier, 'core must not import packages');
      }
      if (relative) {
        const target = posix.join(dirname(file), specifier);
        if (target === owner || target.startsWith(`${owner}/`)) continue;
        if (fromLibrary && target.startsWith('demos/'))
          add('R2', file, specifier, 'packages and apps must not import demos');
        else add('R4', file, specifier, 'relative import leaves its workspace');
        continue;
      }
      const demo = demoId(specifier);
      if (demo !== undefined && fromLibrary) add('R2', file, specifier, 'packages and apps must not import demos');
      else if (demo !== undefined && demo !== ownerName && (fromDemo || fromE2e)) {
        if (fromDemo && !owner.startsWith('demos/03-'))
          add('R3', file, specifier, 'only Demo 3 may import another demo');
        else if (specifier !== `${demo}/module`) add('R3', file, specifier, 'demos are imported only through module');
      }
      if (/^@hackatwin\/core\/testing(?:\/|$)/.test(specifier) && !isTestFile(file) && !fromE2e) {
        add('R5', file, specifier, 'test fakes are imported only from test files');
      }
      if ((specifier === 'process' || specifier === 'node:process') && file !== LOADER) {
        add('R6', file, specifier, 'only the config loader reads the environment');
      }
    }
    if (file !== LOADER && usesProcessEnv(source))
      add('R6', file, 'process.env', 'only the config loader reads the environment');
  }
  return violations;
}

export const formatViolation = (v: Violation): string => `${v.rule} ${v.file}: ${v.specifier}: ${v.reason}`;
