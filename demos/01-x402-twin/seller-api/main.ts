import { serveLoopback } from '../adapters/serve.ts';
import { PORTS } from '../ports.ts';
import { composeRoot } from '../root.ts';
import { Tokens } from '../tokens.ts';

async function main(): Promise<void> {
  const { container } = await composeRoot({ readChains: true });
  const served = await serveLoopback(container.resolve(Tokens.SellerApp), PORTS.seller);
  console.log(`seller API listening on ${served.url}`);
  process.once('SIGINT', () => void served.close().then(() => process.exit(0)));
}

await main().catch((error: unknown) => {
  console.error(`seller failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
