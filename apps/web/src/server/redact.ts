import 'server-only';

const URL_PATTERN = /\b[a-z][a-z0-9+.-]*:\/\/[^\s"'<>)]+/gi;
const POSIX_PATH = /(?<![\w/.~-])(?:\/[\w.@~+%-]+){2,}\/?/g;
const WINDOWS_PATH = /\b[A-Za-z]:\\[^\s"'<>]+/g;

// Error text can carry the fork RPC URL or a keystore path; neither may leave the server.
export const redact = (text: string): string =>
  text.replace(URL_PATTERN, '[url]').replace(WINDOWS_PATH, '[path]').replace(POSIX_PATH, '[path]');
