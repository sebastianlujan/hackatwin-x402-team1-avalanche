// The commands in a section of demos.md: every `pnpm <script>` token.
export function pnpmCommands(markdown: string, heading: string): string[] {
  const start = markdown.indexOf(`## ${heading}`);
  if (start < 0) throw new Error(`no "${heading}" section`);
  const rest = markdown.slice(start + 1);
  const end = rest.search(/\n## /);
  const section = end < 0 ? rest : rest.slice(0, end);
  return [...section.matchAll(/\bpnpm\s+([A-Za-z0-9:_-]+)/g)].map((match) => match[1] as string);
}

export function unknownScripts(commands: readonly string[], scripts: Readonly<Record<string, string>>): string[] {
  return [...new Set(commands)].filter((name) => scripts[name] === undefined);
}
