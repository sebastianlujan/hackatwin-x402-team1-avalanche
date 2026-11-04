import type { PaymentPayload, PaymentRequirements, SettleResponse, VerifyResponse } from '@x402/core/types';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { z } from 'zod';

export const MAX_BODY_BYTES = 16 * 1024;

export interface Supported {
  readonly kinds: readonly { readonly x402Version: number; readonly scheme: string; readonly network: string }[];
  readonly extensions: readonly string[];
  readonly signers: Readonly<Record<string, readonly string[]>>;
}

// The seam over x402Facilitator.
export interface FacilitatorLike {
  supported(): Supported;
  verify(payload: PaymentPayload, requirements: PaymentRequirements): Promise<VerifyResponse>;
  settle(payload: PaymentPayload, requirements: PaymentRequirements): Promise<SettleResponse>;
}

const requirements = z.looseObject({
  scheme: z.string(),
  network: z.string(),
  asset: z.string(),
  amount: z.string(),
  payTo: z.string(),
  maxTimeoutSeconds: z.number(),
  extra: z.record(z.string(), z.unknown()),
});
const body = z.object({
  x402Version: z.number(),
  paymentPayload: z.looseObject({
    x402Version: z.number(),
    accepted: requirements,
    payload: z.record(z.string(), z.unknown()),
  }),
  paymentRequirements: requirements,
});

export function createFacilitatorApp(facilitator: FacilitatorLike, log: (message: string) => void = () => {}): Hono {
  const app = new Hono();
  app.get('/supported', (c) => c.json(facilitator.supported()));
  const limit = bodyLimit({
    maxSize: MAX_BODY_BYTES,
    onError: (c) => c.json({ error: 'body too large' }, 413),
  });
  const route = (path: '/verify' | '/settle') => {
    app.post(path, limit, async (c) => {
      const parsed = body.safeParse(await c.req.json().catch(() => undefined));
      if (!parsed.success) return c.json({ error: 'invalid body' }, 400);
      const { paymentPayload, paymentRequirements } = parsed.data;
      const listed = facilitator
        .supported()
        .kinds.some(
          (kind) => kind.network === paymentRequirements.network && kind.scheme === paymentRequirements.scheme,
        );
      if (!listed) {
        return path === '/verify'
          ? c.json({ isValid: false, invalidReason: 'unsupported_network' }, 400)
          : c.json(
              {
                success: false,
                errorReason: 'unsupported_network',
                transaction: '',
                network: paymentRequirements.network,
              },
              400,
            );
      }
      try {
        const payload = paymentPayload as unknown as PaymentPayload;
        const required = paymentRequirements as unknown as PaymentRequirements;
        return c.json(
          path === '/verify'
            ? await facilitator.verify(payload, required)
            : await facilitator.settle(payload, required),
        );
      } catch (error) {
        log(`${path} failed: ${error instanceof Error ? error.message : String(error)}`);
        return c.json({ error: 'facilitator error' }, 500);
      }
    });
  };
  route('/verify');
  route('/settle');
  return app;
}
