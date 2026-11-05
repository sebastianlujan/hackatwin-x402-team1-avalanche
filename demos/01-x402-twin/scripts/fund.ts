import { formatMoney, money } from '@hackatwin/core';
import { composeRoot } from '../root.ts';
import { STATE_DIR } from '../state-dir.ts';
import { Tokens } from '../tokens.ts';

async function main(): Promise<void> {
  const { container } = await composeRoot({ readChains: true, stateDir: STATE_DIR });
  const report = await container.resolve(Tokens.Funding).fund();
  const argt = (units: bigint) => formatMoney(money(units, 18, 'ARGt'));
  console.log(`gas topped up for ${report.gasToppedUp.length} address(es)`);
  console.log(
    `minted ${argt(report.minted)}, ${report.approved ? `approved ${argt(report.target)}` : 'allowance already set'}`,
  );
  console.log(`target ${argt(report.target)}`);
}

await main().catch((error: unknown) => {
  console.error(`fund failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
