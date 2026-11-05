import type { LandingCopy } from '../../content/copy.ts';

// A plain text link: no Avalanche logo until O4 is answered.
export function BuiltOnAvalanche({ copy }: { readonly copy: LandingCopy['builtOn'] }) {
  return (
    <a href={copy.href} target="_blank" rel="noopener noreferrer">
      {copy.label}
    </a>
  );
}
