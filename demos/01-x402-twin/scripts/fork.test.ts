import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CCHAIN_FORK_BLOCK } from '@hackatwin/config';
import { describe, expect, it } from 'vitest';
import { startFork } from './fork.ts';

const dir = () => join(mkdtempSync(join(tmpdir(), 'fork-')), '.demo1');
// Nothing listens on port 8599 or on the discard port, so no fork is reused and the upstream is unreachable.
const unreachable = { CCHAIN_RPC_URL: 'http://127.0.0.1:9' };

describe('startFork', () => {
  it('exits naming N when the upstream cannot serve it and never echoes the URL', async () => {
    const run = startFork({ dir: dir(), port: 8599, env: unreachable });
    await expect(run).rejects.toThrow(`the upstream RPC cannot serve block ${CCHAIN_FORK_BLOCK}`);
    await expect(run).rejects.not.toThrow(/127\.0\.0\.1:9/);
  });

  it('keeps a keystore that env names and generates the other roles', async () => {
    const state = dir();
    const env = { ...unreachable, AGENT_KEYSTORE: 'mine' };
    await expect(startFork({ dir: state, port: 8599, env })).rejects.toThrow(/cannot serve block/);
    expect(existsSync(join(state, 'agent'))).toBe(false);
    expect(existsSync(join(state, 'seller'))).toBe(true);
    expect(existsSync(join(state, 'facilitator.password'))).toBe(true);
    expect(existsSync(join(state, 'demo1.env'))).toBe(true);
  });

  it('keeps its own keystores in demo1.env when a rerun loads that file as env', async () => {
    const state = dir();
    await expect(startFork({ dir: state, port: 8599, env: unreachable })).rejects.toThrow(/cannot serve block/);
    const env = {
      ...unreachable,
      AGENT_KEYSTORE: 'agent',
      SELLER_KEYSTORE: 'seller',
      FACILITATOR_KEYSTORE: 'facilitator',
    };
    await expect(startFork({ dir: state, port: 8599, env })).rejects.toThrow(/cannot serve block/);
    expect(readFileSync(join(state, 'demo1.env'), 'utf8')).toContain('AGENT_KEYSTORE=agent');
  });
});
