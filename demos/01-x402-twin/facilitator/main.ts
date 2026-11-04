import { serveLoopback } from '../adapters/serve.ts';
import { PORTS } from '../ports.ts';
import { composeRoot } from '../root.ts';
import { STATE_DIR } from '../state-dir.ts';
import { Tokens } from '../tokens.ts';

async function main(): Promise<void> {
  const { container } = await composeRoot({ stateDir: STATE_DIR });
  const served = await serveLoopback(container.resolve(Tokens.FacilitatorApp), PORTS.facilitator);
  console.log(`facilitator listening on ${served.url}`);
  process.once('SIGINT', () => void served.close().then(() => process.exit(0)));
}

await main().catch((error: unknown) => {
  console.error(`facilitator failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
