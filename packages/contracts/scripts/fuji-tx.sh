#!/usr/bin/env bash
# Terminal explorer for Fuji transactions: Snowtrace links, the receipt and the decoded call trace; reads only
set -euo pipefail

cd "$(dirname "$0")/.."
rpc="${FUJI_RPC_URL:-https://api.avax-test.network/ext/bc/C/rpc}"
snowtrace='https://testnet.snowtrace.io'
run='broadcast/DeployRevenueSplitter.s.sol/43113/run-latest.json'
debug=''
if [[ "${1:-}" == '--debug' ]]; then debug='--debug' && shift; fi

if [[ $# -eq 0 ]]; then
  if [[ ! -f "$run" ]]; then
    echo "usage: fuji-tx.sh [--debug] [tx-hash ...]; with no hash it reads packages/contracts/$run" >&2
    exit 1
  fi
  set -- $(jq -r '.receipts[].transactionHash' "$run")
fi

for tx in "$@"; do
  echo "== tx $tx"
  echo "snowtrace  $snowtrace/tx/$tx"
  echo "status     $(cast receipt "$tx" status --rpc-url "$rpc")"
  echo "block      $(cast receipt "$tx" blockNumber --rpc-url "$rpc")"
  echo "gas used   $(cast receipt "$tx" gasUsed --rpc-url "$rpc")"
  created="$(cast receipt "$tx" contractAddress --rpc-url "$rpc")"
  if [[ -n "$created" && "$created" != '0x0000000000000000000000000000000000000000' ]]; then
    echo "created    $snowtrace/address/$created"
  fi
  # Replays the transaction on a local fork of its block; --debug opens the Foundry TUI debugger instead
  cast run "$tx" --rpc-url "$rpc" --with-local-artifacts $debug
done
