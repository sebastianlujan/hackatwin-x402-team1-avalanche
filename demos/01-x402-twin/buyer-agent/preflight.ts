export interface PreflightDeps {
  // Why the RPC refuses writes, if it does (not a loopback anvil).
  readonly refusal: string | undefined;
  readonly expectedBlock: bigint;
  readonly forkBlock: () => Promise<bigint | undefined>;
  readonly syncClock: () => Promise<unknown>;
  readonly registered: () => Promise<boolean>;
  readonly funded: () => Promise<boolean>;
  readonly serviceUp: (service: 'facilitator' | 'seller') => Promise<boolean>;
}

export class PreflightError extends Error {
  override readonly name = 'PreflightError';
}

// Each failure names the command that fixes it; nothing is written before every check passes.
export async function preflight(deps: PreflightDeps): Promise<void> {
  if (deps.refusal !== undefined) throw new PreflightError(`the RPC is not a local anvil fork: ${deps.refusal}`);
  if ((await deps.forkBlock()) !== deps.expectedBlock) {
    throw new PreflightError(`the fork is not at block ${deps.expectedBlock}: run pnpm demo1:fork`);
  }
  await deps.syncClock();
  if (!(await deps.registered()))
    throw new PreflightError('the agent and the seller are not registered: run pnpm demo1:register');
  if (!(await deps.funded())) throw new PreflightError('the agent is not funded: run pnpm demo1:fund');
  for (const service of ['facilitator', 'seller'] as const) {
    if (!(await deps.serviceUp(service)))
      throw new PreflightError(`the ${service} is not running: run pnpm demo1:${service}`);
  }
}
