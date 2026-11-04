import { ConfigError, type ConfigIssue } from './config-error.ts';
import { definitions, PROFILE_NAMES, type Profile, type ProfileName, staticValues } from './profiles.ts';

export type Env = Readonly<Record<string, string | undefined>>;

const isProfileName = (name: string): name is ProfileName => (PROFILE_NAMES as readonly string[]).includes(name);

export function loadProfile<N extends ProfileName>(name: N, env?: Env): Profile<N>;
export function loadProfile(name: string, env?: Env): Profile;
export function loadProfile(name: string, env: Env = process.env): Profile {
  if (!isProfileName(name)) {
    throw new ConfigError([
      { variable: 'profile', message: `unknown profile "${name}", use one of: ${PROFILE_NAMES.join(', ')}` },
    ]);
  }
  const present = Object.fromEntries(Object.entries(env).filter(([, value]) => value !== undefined && value !== ''));
  const { statics, schema } = definitions[name];
  const result = schema.safeParse(present);
  if (!result.success) {
    const issues: ConfigIssue[] = result.error.issues.map((issue) => ({
      variable: String(issue.path[0]),
      message: issue.message,
    }));
    throw new ConfigError(issues);
  }
  return { name, ...statics, ...staticValues, env: result.data } as unknown as Profile;
}
