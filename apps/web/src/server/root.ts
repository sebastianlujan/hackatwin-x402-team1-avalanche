import 'server-only';

// Composition root for the web server; functions only, so importing it reads no environment.
export function describeRoot(): string {
  return 'web-root';
}
