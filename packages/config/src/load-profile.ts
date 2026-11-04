import { join } from 'node:path';
import { ConfigError, type ConfigIssue } from './config-error.ts';
import { envSchemas, isRpcUrl } from './env.ts';
import {
  definitions,
  type LlmProvider,
  llmConfig,
  PROFILE_NAMES,
  type Profile,
  type ProfileName,
  staticValues,
} from './profiles.ts';

export type Env = Readonly<Record<string, string | undefined>>;

const ROLES = ['AGENT', 'SELLER', 'FACILITATOR', 'TREASURY'] as const;
const RAW_KEY = /^(0x)?[0-9a-fA-F]{64}$/;

const rawKeyIssues = (env: Env): ConfigIssue[] => {
  const forbidden = ['PRIVATE_KEY', ...ROLES.flatMap((role) => [`${role}_PRIVATE_KEY`, `${role}_KEYSTORE_PASSWORD`])];
  const issues = forbidden
    .filter((variable) => env[variable])
    .map((variable) => ({ variable, message: 'raw secrets are not allowed, reference a keystore instead' }));
  for (const role of ROLES) {
    const variable = `${role}_KEYSTORE`;
    if (RAW_KEY.test(env[variable] ?? ''))
      issues.push({ variable, message: 'looks like a raw private key, use a keystore name' });
  }
  return issues;
};

// True when the environment names a keystore for the role, so a script must not generate one.
export const keystoreNamedInEnv = (role: string, env: Env = process.env): boolean =>
  Boolean(env[`${role.toUpperCase()}_KEYSTORE`]);

const SYSTEM_PATH = '/usr/bin:/bin:/usr/local/bin:/opt/homebrew/bin';

// The only environment a spawned tool sees: HOME, a fixed PATH and the extras, never the parent's secrets.
export function childEnv(extra: Record<string, string> = {}, env: Env = process.env): Record<string, string> {
  const home = env.HOME;
  if (!home) throw new Error('HOME is required to run a child process');
  return { HOME: home, PATH: `${join(home, '.foundry', 'bin')}:${SYSTEM_PATH}`, LC_ALL: 'C', ...extra };
}

const isProfileName = (name: string): name is ProfileName => (PROFILE_NAMES as readonly string[]).includes(name);

export interface LoadProfileOptions {
  readonly llm?: LlmProvider;
}

export function loadProfile<N extends ProfileName>(name: N, env?: Env, options?: LoadProfileOptions): Profile<N>;
export function loadProfile(name: string, env?: Env, options?: LoadProfileOptions): Profile;
export function loadProfile(name: string, env: Env = process.env, options: LoadProfileOptions = {}): Profile {
  if (!isProfileName(name)) {
    throw new ConfigError([
      { variable: 'profile', message: `unknown profile "${name}", use one of: ${PROFILE_NAMES.join(', ')}` },
    ]);
  }
  const present = Object.fromEntries(Object.entries(env).filter(([, value]) => value !== undefined && value !== ''));
  const { statics, schema } = definitions[name];
  const needsKey = options.llm === 'claude';
  const result = (needsKey ? schema.extend({ ANTHROPIC_API_KEY: envSchemas.ANTHROPIC_API_KEY }) : schema).safeParse(
    present,
  );
  const guarded = rawKeyIssues(present);
  if (guarded.length > 0 || !result.success) {
    const rest = result.success
      ? []
      : result.error.issues.map((issue) => ({ variable: String(issue.path[0]), message: issue.message }));
    const seen = new Set(guarded.map((issue) => issue.variable));
    throw new ConfigError([...guarded, ...rest.filter((issue) => !seen.has(issue.variable))]);
  }
  const llm = options.llm === undefined ? {} : { llm: llmConfig(options.llm) };
  return { name, ...statics, ...staticValues, ...llm, env: result.data } as unknown as Profile;
}

// Maps each needed registry key to its RPC URL: env `<KEY>_RPC_URL` wins, else the registry default.
export const rpcVariable = (key: string): string => `${key.toUpperCase().replaceAll('-', '_')}_RPC_URL`;

export function loadRpcUrls(
  needed: Readonly<Record<string, string | undefined>>,
  env: Env = process.env,
): Record<string, string> {
  const urls: Record<string, string> = {};
  const issues: ConfigIssue[] = [];
  for (const [key, fallback] of Object.entries(needed)) {
    const variable = rpcVariable(key);
    const url = env[variable] || fallback;
    if (!url) issues.push({ variable, message: 'is required' });
    else if (!isRpcUrl(url)) issues.push({ variable, message: 'must be an http(s) or ws(s) URL' });
    else urls[key] = url;
  }
  if (issues.length > 0) throw new ConfigError(issues);
  return urls;
}
