export interface RegistryFile {
  key: string;
  chainId?: number;
  ccip?: { chainSelector: string };
  contracts: Record<string, { address: string }>;
}

// Compares only the facts a fixture copies; facts only the fixture has are not drift
export function driftOf(real: RegistryFile, fixture: RegistryFile): string[] {
  const found: string[] = [];
  const check = (path: string, fixtureValue: unknown, realValue: unknown): void => {
    if (fixtureValue !== undefined && realValue !== undefined && fixtureValue !== realValue) {
      found.push(`${fixture.key} ${path}: fixture ${fixtureValue}, registry ${realValue}`);
    }
  };
  check('chainId', fixture.chainId, real.chainId);
  check('ccip.chainSelector', fixture.ccip?.chainSelector, real.ccip?.chainSelector);
  for (const [name, entry] of Object.entries(fixture.contracts)) {
    check(`contracts.${name}.address`, entry.address, real.contracts[name]?.address);
  }
  return found;
}
