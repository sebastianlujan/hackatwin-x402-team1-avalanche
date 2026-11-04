import { ConfigError, loadRpcUrls } from '@hackatwin/config';
import { createChainClient, listChains, verifyRegistry } from '../src/index.ts';

const chains = listChains();
try {
  const urls = loadRpcUrls(
    Object.fromEntries(chains.flatMap((c) => (c.status === 'live' ? [[c.key, c.rpc.public]] : []))),
  );
  const report = await verifyRegistry(chains, (c) =>
    createChainClient({ chain: c.key, rpcUrl: urls[c.key] as string }),
  );
  console.log(report.lines.join('\n'));
  process.exitCode = report.ok ? 0 : 1;
} catch (error) {
  if (!(error instanceof ConfigError)) throw error;
  console.error(error.message);
  process.exitCode = 1;
}
