import { describe, expect, it } from 'vitest';
import { logs, MESSAGE_ID, PAYMENT_ID, REASON, RECEIVER, txHash } from './tracker.fixtures.ts';
import { decodeLogs } from './tracker-decode.ts';

describe('decodeLogs', () => {
  it('decodes the router send as a sent fact carrying the message ID', () => {
    expect(decodeLogs('router', [logs.executed(1, 1)])).toMatchObject([{ kind: 'sent', messageId: MESSAGE_ID }]);
  });

  it('decodes the broker accept, dispatch failure and rejection', () => {
    expect(decodeLogs('broker', [logs.accepted(), logs.brokerRejected()])).toMatchObject([
      { kind: 'accepted', messageId: MESSAGE_ID, paymentId: PAYMENT_ID },
      { kind: 'broker-rejected', messageId: MESSAGE_ID, reason: REASON },
    ]);
  });

  it('decodes hub Pending and Dispatched and receiver Received, Settled and Rejected by name', () => {
    expect(decodeLogs('hub', [logs.hub(1), logs.hub(3)]).map((d) => d.kind === 'hub' && d.to)).toEqual([
      'Pending',
      'Dispatched',
    ]);
    const receiver = decodeLogs('receiver', [logs.receiver(1, 3, 3), logs.receiver(2, 3, 3), logs.receiver(3, 3, 3)]);
    expect(receiver.map((d) => d.kind === 'receiver' && d.to)).toEqual(['Received', 'Settled', 'Rejected']);
  });

  it('decodes the ICTT call failure with its recipient', () => {
    expect(decodeLogs('remote', [logs.callFailed(3, 3)])).toMatchObject([
      { kind: 'call-failed', recipient: RECEIVER.toLowerCase() },
    ]);
  });

  it('ignores statuses it does not follow and events of another contract', () => {
    expect(decodeLogs('hub', [logs.hub(2), logs.hub(4)])).toEqual([]);
    expect(decodeLogs('hub', [logs.accepted()])).toEqual([]);
    expect(decodeLogs('router', [logs.callFailed(3, 3)])).toEqual([]);
  });

  it('returns the facts in block then log order and keeps the log position', () => {
    const late = logs.hub(3, 9, 9);
    const early = logs.hub(1, 2, 2);
    const facts = decodeLogs('hub', [late, early]);
    expect(facts.map((d) => d.log.txHash)).toEqual([txHash(2), txHash(9)]);
    expect(facts[0]?.log).toBe(early);
  });

  it('lower-cases the IDs so lookups do not depend on case', () => {
    expect(decodeLogs('router', [logs.executed(1, 1)])[0]).toMatchObject({ messageId: MESSAGE_ID.toLowerCase() });
  });
});
