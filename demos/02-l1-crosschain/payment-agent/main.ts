import { runDemo2 } from './entry.ts';

process.exitCode = await runDemo2(
  { llm: process.argv.includes('--scripted') ? 'scripted' : 'claude' },
  console.log,
).catch((error: unknown) => {
  console.error(`demo2 failed: ${error instanceof Error ? error.message : String(error)}`);
  return 1;
});
