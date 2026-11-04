import { STATE_DIR } from '../state-dir.ts';
import { startDemo1Run } from './entry.ts';
import { formatBalances, formatDeltas, formatEvent } from './format.ts';

async function main(): Promise<number> {
  const run = await startDemo1Run({
    llm: process.argv.includes('--scripted') ? 'scripted' : 'claude',
    stateDir: STATE_DIR,
  });
  for (const line of formatBalances('before', run.before)) console.log(line);
  let reason = 'error';
  for await (const event of run.events) {
    console.log(formatEvent(event));
    if (event.type === 'run.finished') reason = event.reason;
  }
  const after = await run.after();
  for (const line of [...formatBalances('after', after), ...formatDeltas(run.before, after)]) console.log(line);
  return reason === 'done' ? 0 : 1;
}

process.exitCode = await main().catch((error: unknown) => {
  console.error(`demo1 failed: ${error instanceof Error ? error.message : String(error)}`);
  return 1;
});
