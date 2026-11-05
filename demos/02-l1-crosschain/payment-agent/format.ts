import { type AgentEvent, formatMoney } from '@hackatwin/core';

const flat = (text: string): string => text.replace(/\s+/g, ' ').trim();

// One terminal line per event.
export function formatEvent(event: AgentEvent): string {
  switch (event.type) {
    case 'run.started':
      return `run started: agent ${event.agent}, profile ${event.profile}, llm ${event.llm}`;
    case 'llm.reasoning':
      return `reasoning: ${flat(event.text)}`;
    case 'llm.tool-call':
      return `tool call: ${event.tool}`;
    case 'policy.decision':
      return `policy decision: ${event.allowed ? 'allowed' : 'denied'} ${formatMoney(event.amount)} (${event.reason})`;
    case 'hop': {
      const { index, transport, status, chainId, txHash, explorerUrl } = event.hop;
      return `hop ${index}: ${transport} ${status} on chain ${chainId} tx ${txHash}${explorerUrl === undefined ? '' : ` ${explorerUrl}`}`;
    }
    case 'run.finished':
      return `run finished: ${event.reason}${event.message === undefined ? '' : ` (${flat(event.message)})`}`;
    default:
      return event.type;
  }
}
