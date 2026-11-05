export type IdentityRole = 'agent' | 'seller';

// What the demo module reads, structurally; bigint stays on the server.
export interface IdentityRead {
  readonly role: IdentityRole;
  readonly agentId: bigint;
  readonly owner: string;
  readonly reputation?: { readonly count: bigint; readonly value: bigint; readonly valueDecimals: number } | undefined;
}

export type LastKnownIdentities = Readonly<
  Partial<Record<IdentityRole, { readonly agentId: string; readonly owner: string }>>
>;

export interface IdentityRowView {
  readonly role: IdentityRole;
  readonly agentId?: string;
  readonly owner?: string;
  // Only present when the reputation registry was read.
  readonly reputation?: { readonly count: string; readonly score: string };
}

export interface IdentityView {
  readonly offline: boolean;
  readonly rows: readonly IdentityRowView[];
}

const ROLES: readonly IdentityRole[] = ['agent', 'seller'];

function decimal(value: bigint, decimals: number): string {
  if (decimals === 0) return value.toString();
  const digits = value.toString().padStart(decimals + 1, '0');
  return `${digits.slice(0, -decimals)}.${digits.slice(-decimals)}`;
}

export const liveView = (reads: readonly IdentityRead[]): IdentityView => ({
  offline: false,
  rows: reads.map(({ role, agentId, owner, reputation }) => ({
    role,
    agentId: agentId.toString(),
    owner,
    ...(reputation === undefined
      ? {}
      : {
          reputation: {
            count: reputation.count.toString(),
            score: decimal(reputation.value, reputation.valueDecimals),
          },
        }),
  })),
});

// Last-known values are never shown as live and never carry a reputation.
export const offlineView = (known: LastKnownIdentities): IdentityView => ({
  offline: true,
  rows: ROLES.map((role) => ({ role, ...known[role] })),
});
