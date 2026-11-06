// Serves the workshop deck and runs its allowlisted demo commands live over server-sent events
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { connect } from 'node:net';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripVTControlCharacters } from 'node:util';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const repo = process.env.DEMO_REPO ?? root;
const port = Number(process.env.PORT ?? 8790);
const pnpm = process.env.PNPM ?? 'pnpm';
const CAST =
  /^cast (chain-id|client|block-number|block latest) --rpc-url http:\/\/127\.0\.0\.1:1854[56]( --field hash)?$/;
const RUN = {
  'pnpm quote': `${pnpm} -s quote`,
  'pnpm demo1 --scripted': `${pnpm} -s demo1 --scripted`,
  'pnpm demo2:setup': `${pnpm} -s demo2:setup`,
  'pnpm demo2 --scripted': `${pnpm} -s demo2 --scripted`,
  'cast receipt <última tx de la L1> --rpc-url http://127.0.0.1:18546':
    "R=http://127.0.0.1:18546; tx=$(cast block latest --rpc-url $R --json | jq -r '.transactions[0]'); cast receipt $tx --rpc-url $R --json | jq -r '\"tx: \\(.transactionHash)\\nstatus: \\(.status)\\nblock: \\(.blockNumber)\\nto: \\(.to)\\ngasUsed: \\(.gasUsed)\\nlogs: \\(.logs|length)\"'",
};
const FUJI = 'https://api.avax-test.network/ext/bc/C/rpc';
const STORE = '0xa3Bc5564A18e107807aF41fF2a5215Db050b22dD';
const verify = (a) =>
  `set -- $(cast call ${STORE} 'verify(address)(bool,uint32,uint64,uint64)' ${a} --rpc-url ${FUJI} | awk '{print $1}'); echo "verified: $1"; echo "tier: $2"; if [ "$3" = 0 ]; then echo 'emitida: -'; echo 'vence: -'; else echo "emitida: $(date -r $3 +%F)"; echo "vence: $(date -r $4 +%F)"; fi`;
for (const a of ['0x020978c00a5dfe5b5b76ec1f0a37ba35fb6a6f92', '0x000000000000000000000000000000000000dEaD'])
  RUN[`cast call ${STORE} "verify(address)(bool,uint32,uint64,uint64)" ${a} --rpc-url ${FUJI}`] = verify(a);
RUN[`cast call ${STORE} "totalAttestations()(uint256)" --rpc-url ${FUJI}`] =
  `echo "attestations: $(cast call ${STORE} 'totalAttestations()(uint256)' --rpc-url ${FUJI})"`;
const BASE = 'https://mainnet.base.org';
const CCHAIN = 'https://api.avax.network/ext/bc/C/rpc';
const ARGT_BASE = '0xf016413834E6D1A14F3D628B11D6Ef725a6bdbDD';
const ARGT_CCHAIN = '0x2E4e93eCA2E16E4989b894e188B7F7fC0175703B';
RUN[`cast chain-id --rpc-url ${BASE}`] = `echo "chain: $(cast chain-id --rpc-url ${BASE}) (Base)"`;
RUN[`cast chain-id --rpc-url ${CCHAIN}`] = `echo "chain: $(cast chain-id --rpc-url ${CCHAIN}) (Avalanche C-Chain)"`;
for (const [t, r] of [
  [ARGT_BASE, BASE],
  [ARGT_CCHAIN, CCHAIN],
])
  RUN[`cast call ${t} "symbol()(string)" --rpc-url ${r}`] =
    `echo "symbol: $(cast call ${t} 'symbol()(string)' --rpc-url ${r})"`;
RUN[`cast call ${ARGT_BASE} "decimals()(uint8)" --rpc-url ${BASE}`] =
  `echo "decimals: $(cast call ${ARGT_BASE} 'decimals()(uint8)' --rpc-url ${BASE})"`;
RUN[`cast call ${ARGT_BASE} "totalSupply()(uint256)" --rpc-url ${BASE}`] =
  `echo "totalSupply: $(cast call ${ARGT_BASE} 'totalSupply()(uint256)' --rpc-url ${BASE} | awk '{print $1}' | xargs cast from-wei) ARGt"`;
let world;

const portOpen = (p) =>
  new Promise((resolve) => {
    const s = connect(p, '127.0.0.1');
    s.on('connect', () => {
      s.destroy();
      resolve(true);
    });
    s.on('error', () => resolve(false));
  });

const pipe = (child, send) => {
  let buf = '';
  const on = (d) => {
    buf += d;
    const lines = buf.split('\n');
    buf = lines.pop();
    for (const l of lines) send(stripVTControlCharacters(l));
  };
  child.stdout.setEncoding('utf8').on('data', on);
  child.stderr.setEncoding('utf8').on('data', on);
  child.on('close', () => buf && send(stripVTControlCharacters(buf)));
};

const startWorld = async (send, end) => {
  if (await portOpen(18545)) {
    send('demo 2 already running on :18545 (hub) and :18546 (L1)');
    return end(0);
  }
  let ready = false;
  world = spawn('sh', ['-c', `${pnpm} -s demo2:local:up`], { cwd: repo, env: process.env, detached: true });
  pipe(world, (l) => {
    if (ready) return;
    send(l);
    if (l.includes('relay: running every second')) {
      ready = true;
      end(0);
    }
  });
  world.on('close', (code) => ready || end(code ?? 1));
};

const STOP =
  "pkill -INT -f e2e/protocol/src/local/up.ts; sleep 2; lsof -ti :18545-18546 -sTCP:LISTEN | xargs kill 2>/dev/null; echo 'demo 2 stopped: :18545 and :18546 are free'";

createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (url.pathname === '/health') return res.end('ok');
  if (url.pathname !== '/run') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    return res.end(readFileSync(join(root, 'Avalanche_Workshops.html')));
  }
  const cmd = (url.searchParams.get('cmd') ?? '').replace(/#.*$/, '').trim().replace(/\s+/g, ' ');
  res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
  const send = (line) =>
    /^\s+at /.test(line) ||
    res.write(
      `data: ${JSON.stringify(line.replaceAll('file://', '').replaceAll(repo, '.').replaceAll(homedir(), '~'))}\n\n`,
    );
  const end = (code) => res.end(`event: end\ndata: ${code}\n\n`);
  if (cmd === 'pnpm demo2:local:up') return startWorld(send, end);
  if (cmd === 'demo2:stop') RUN[cmd] = STOP;
  const shell = RUN[cmd] ?? (CAST.test(cmd) ? cmd : undefined);
  if (!shell) {
    send(`not allowed: ${cmd}`);
    return end(1);
  }
  const child = spawn('sh', ['-c', shell], { cwd: repo, env: process.env });
  pipe(child, send);
  child.on('close', (code) => end(code ?? 1));
}).listen(port, '127.0.0.1', () => console.log(`deck live: http://127.0.0.1:${port}/`));

for (const sig of ['SIGINT', 'SIGTERM'])
  process.on(sig, () => {
    if (world) process.kill(-world.pid);
    process.exit(0);
  });
