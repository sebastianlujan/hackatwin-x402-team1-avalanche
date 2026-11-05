import {
  type Address,
  type AgentEvent,
  type AgentPolicy,
  type ChainClient,
  type Hex,
  type Money,
  type PaidResponse,
  type PaymentGateway,
  type PaymentIntent,
  type PaymentRequest,
  parseMoney,
  type Quote,
} from '@hackatwin/core';
import type { PaymentRequired, PaymentRequirements } from '@x402/core/types';
import { getPermit2AllowanceReadParams } from '@x402/evm';
import type { X402Engine } from './engine.ts';
import {
  AboveMaxAmountError,
  AllowanceShortfallError,
  PaymentDeniedError,
  PaymentRequirementsError,
} from './errors.ts';

const ZERO_HASH: Hex = `0x${'0'.repeat(64)}`;
const APPROVAL_EXTENSION = /approval|sponsoring/i;

export interface X402GatewayOptions {
  readonly engine: X402Engine;
  readonly chain: ChainClient;
  readonly policy: AgentPolicy;
  readonly emit: (event: AgentEvent) => void;
  readonly owner: Address;
  readonly asset: Address;
  // Values an ARGt ask in USD at the buyer's own rate, rounded up.
  readonly usdValue: (ask: Money) => Money;
  readonly fetch?: typeof fetch;
  readonly now?: () => number;
  readonly newId?: () => string;
}

// ARGt to USD at a rate (USD per one ARGt), rounded up.
export function usdAtRate(ask: Money, rate: Money): Money {
  const scale = 10n ** BigInt(ask.decimals);
  return { units: (ask.units * rate.units + scale - 1n) / scale, decimals: rate.decimals, currency: 'USD' };
}

// The rate source is shown by the seller for display only; the ceiling never depends on it.
function sellerQuote(accepted: PaymentRequirements, ask: Money, price: Money, validUntil: number): Quote {
  const shown = accepted.extra.quote as { source?: unknown; guarded?: unknown; rate?: unknown } | undefined;
  const rate = typeof shown?.rate === 'string' ? /^(\d+)(?:\.(\d+))? USD$/.exec(shown.rate) : null;
  if (rate === null || (shown?.source !== 'curve' && shown?.source !== 'chainlink')) {
    throw new PaymentRequirementsError('the 402 does not show a rate source');
  }
  return {
    price,
    rate: parseMoney(`${rate[1]}${rate[2] === undefined ? '' : `.${rate[2]}`}`, rate[2]?.length ?? 0, 'USD'),
    amount: ask,
    source: shown.source,
    guarded: shown.guarded === true,
    validUntil,
  };
}

export class X402PaymentGateway implements PaymentGateway {
  private readonly options: X402GatewayOptions;
  private readonly network: string;

  constructor(options: X402GatewayOptions) {
    this.options = options;
    this.network = `eip155:${options.chain.chainId}`;
  }

  // GET; on 402 pick the exact ARGt Permit2 entry, check the ceiling, policy and allowance, then sign and retry.
  async pay(request: PaymentRequest): Promise<PaidResponse> {
    const { engine, emit, fetch: send = fetch, now = Date.now } = this.options;
    const init = { method: request.method, ...(request.body !== undefined && { body: request.body }) };
    const first = await send(request.url, init);
    if (first.status !== 402) return { status: first.status, body: await first.text() };
    const required = await engine.required(first);
    const accepted = this.choose(required);
    const ask = this.askOf(accepted, request.maxAmount);
    const usd = this.options.usdValue(ask);
    emit({
      version: 1,
      type: 'payment.required',
      at: now(),
      resource: request.url,
      quote: sellerQuote(accepted, ask, usd, now() + accepted.maxTimeoutSeconds * 1000),
    });
    if (ask.units > request.maxAmount.units) {
      emit({ version: 1, type: 'policy.decision', at: now(), amount: usd, allowed: false, reason: 'above_max_amount' });
      throw new AboveMaxAmountError(ask, request.maxAmount);
    }
    const decision = await this.options.policy.authorize(usd);
    if (!decision.allowed) throw new PaymentDeniedError(decision.reason);
    await this.assertAllowance(ask.units);
    const headers = await engine.sign(required, accepted);
    const intent: PaymentIntent = {
      id: (this.options.newId ?? (() => crypto.randomUUID()))(),
      payer: this.options.owner,
      payee: accepted.payTo as Address,
      amount: ask,
      chainId: this.options.chain.chainId,
      status: 'Pending',
    };
    emit({ version: 1, type: 'payment.signed', at: now(), intent });
    const paid = await send(request.url, { ...init, headers });
    const settlement = engine.settlement(paid);
    const settled = paid.status === 200 && settlement?.success === true;
    const txHash = (settlement?.transaction ? settlement.transaction : ZERO_HASH) as Hex;
    emit({
      version: 1,
      type: 'payment.status',
      at: now(),
      paymentId: intent.id,
      chainId: intent.chainId,
      from: 'Pending',
      to: settled ? 'Settled' : 'Rejected',
      txHash,
    });
    if (settled) emit({ version: 1, type: 'resource.received', at: now(), resource: request.url, status: 200 });
    return {
      status: paid.status,
      body: await paid.text(),
      payment: { ...intent, status: settled ? 'Settled' : 'Rejected' },
    };
  }

  private choose(required: PaymentRequired): PaymentRequirements {
    const { asset } = this.options;
    if (Object.keys(required.extensions ?? {}).some((key) => APPROVAL_EXTENSION.test(key))) {
      throw new PaymentRequirementsError('the 402 asks for an approval extension, which this client never signs');
    }
    const found = required.accepts.find(
      (entry) =>
        entry.scheme === 'exact' &&
        entry.network === this.network &&
        entry.asset.toLowerCase() === asset.toLowerCase() &&
        entry.extra?.assetTransferMethod === 'permit2',
    );
    if (found === undefined) throw new PaymentRequirementsError(`the 402 has no exact Permit2 option for ${asset}`);
    return found;
  }

  private askOf(accepted: PaymentRequirements, maxAmount: Money): Money {
    if (!/^\d+$/.test(accepted.amount)) throw new PaymentRequirementsError('the 402 amount is not a base-unit integer');
    return { units: BigInt(accepted.amount), decimals: maxAmount.decimals, currency: maxAmount.currency };
  }

  private async assertAllowance(amount: bigint): Promise<void> {
    const { asset, owner, chain } = this.options;
    const params = getPermit2AllowanceReadParams({ tokenAddress: asset, ownerAddress: owner });
    const { value } = await chain.read<bigint>({ ...params, args: [...params.args] });
    if (value < amount) throw new AllowanceShortfallError(value, amount);
  }
}
