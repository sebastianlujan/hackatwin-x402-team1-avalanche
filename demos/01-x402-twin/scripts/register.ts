import { composeRoot } from '../root.ts';
import { Tokens } from '../tokens.ts';

async function main(): Promise<void> {
  const { container } = await composeRoot();
  const { ids, registered } = await container.resolve(Tokens.Registration).register();
  console.log(`agent agentId ${ids.agent}`);
  console.log(`seller agentId ${ids.seller}`);
  console.log(
    registered.length === 0 ? 'already registered, no transaction sent' : `registered: ${registered.join(', ')}`,
  );
}

await main().catch((error: unknown) => {
  console.error(`register failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
