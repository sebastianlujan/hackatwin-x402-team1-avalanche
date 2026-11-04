import { x402Client, x402HTTPClient } from '@x402/core/client';
import type { PaymentRequired, PaymentRequirements } from '@x402/core/types';
import type { ClientEvmSigner } from '@x402/evm';
import { registerExactEvmScheme } from '@x402/evm/exact/client';

export interface Settlement {
  readonly success: boolean;
  readonly transaction: string;
}

// The x402 SDK behind the gateway; tests replace it with a fake.
export interface X402Engine {
  required(response: Response): Promise<PaymentRequired>;
  sign(required: PaymentRequired, accepted: PaymentRequirements): Promise<Record<string, string>>;
  settlement(response: Response): Settlement | undefined;
}

export function createX402Engine({ signer, network }: { signer: ClientEvmSigner; network: string }): X402Engine {
  // The SDK spend controls reject non-default assets such as ARGt; the gateway applies the ceiling instead.
  const client = new x402Client().setSpendControls(false);
  registerExactEvmScheme(client, { signer, networks: [network as `${string}:${string}`] });
  const http = new x402HTTPClient(client);
  return {
    async required(response) {
      const body: unknown = await response
        .clone()
        .json()
        .catch(() => undefined);
      return http.getPaymentRequiredResponse((name) => response.headers.get(name), body);
    },
    // Server extensions are dropped: they could ask the signer for an approval transaction.
    async sign(required, accepted) {
      const { extensions: _dropped, ...rest } = required;
      return http.encodePaymentSignatureHeader(await http.createPaymentPayload({ ...rest, accepts: [accepted] }));
    },
    settlement(response) {
      try {
        return http.getPaymentSettleResponse((name) => response.headers.get(name));
      } catch {
        return undefined;
      }
    },
  };
}
