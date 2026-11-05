export const BANNER = 'SIMULATED (local-crosschain)';

// The event marker comes from the loaded profile, never from a selector or chain name lookup.
export const simulatedOf = ({ name }: { readonly name: string }): 'local-crosschain' | undefined =>
  name === 'local-crosschain' ? 'local-crosschain' : undefined;

// Local output must carry none of these.
export const findLiveReferences = (text: string): string[] =>
  text.match(/sepolia|ccip\.chain\.link|snowtrace|https:\/\//gi) ?? [];
