import { describe, expect, it } from 'vitest';
import { ContainerError, createContainer, type Resolver, token } from '../src/container.ts';

interface Adapter {
  readonly name: string;
}
const Adapter = token<Adapter>('Adapter');
const Service = token<{ readonly adapter: Adapter }>('Service');
const real: Adapter = { name: 'real' };
const fake: Adapter = { name: 'fake' };

const withService = () => {
  const root = createContainer();
  root.register(Adapter, () => real);
  root.register(Service, (r) => ({ adapter: r.resolve(Adapter) }));
  return root;
};

describe('resolution', () => {
  it('resolves a registered token with its factory value', () => {
    const root = createContainer();
    const Port = token<number>('Port');
    root.register(Port, () => 42);
    expect(root.resolve(Port)).toBe(42);
  });

  it('names the token when nothing is registered', () => {
    expect(() => createContainer().resolve(Adapter)).toThrow('No registration for "Adapter"');
  });

  it('names the path when a dependency is missing', () => {
    const root = createContainer();
    root.register(Service, (r) => ({ adapter: r.resolve(Adapter) }));
    expect(() => root.resolve(Service)).toThrow('No registration for "Adapter" (required by Service)');
  });

  it('rejects a duplicate registration in the same container only', () => {
    const root = createContainer();
    root.register(Adapter, () => real);
    expect(() => root.register(Adapter, () => fake)).toThrow('Token "Adapter" is already registered');
    expect(() => root.child().register(Adapter, () => fake)).not.toThrow();
  });

  it('rejects a resolver used after its factory returned', () => {
    const root = createContainer();
    const Leak = token<Resolver>('Leak');
    root.register(Leak, (r) => r);
    expect(() => root.resolve(Leak).resolve(Adapter)).toThrow('used after its factory returned');
  });

  it('keeps working after a factory throws', () => {
    const root = createContainer();
    root.register(Adapter, () => {
      throw new Error('boom');
    });
    expect(() => root.resolve(Adapter)).toThrow('boom');
    expect(() => root.resolve(Adapter)).toThrow('boom');
  });
});

describe('scopes', () => {
  it('builds a singleton once and a transient on every resolve', () => {
    const root = createContainer();
    const Single = token<object>('Single');
    const Many = token<object>('Many');
    root.register(Single, () => ({}), 'singleton');
    root.register(Many, () => ({}), 'transient');
    expect(root.resolve(Single)).toBe(root.resolve(Single));
    expect(root.resolve(Many)).not.toBe(root.resolve(Many));
  });

  it('defaults to singleton', () => {
    const root = createContainer();
    const Default = token<object>('Default');
    root.register(Default, () => ({}));
    expect(root.resolve(Default)).toBe(root.resolve(Default));
  });
});

describe('cycles', () => {
  it('fails with the full token path', () => {
    const root = createContainer();
    const A = token<unknown>('A');
    const B = token<unknown>('B');
    root.register(A, (r) => r.resolve(B));
    root.register(B, (r) => r.resolve(A));
    expect(() => root.resolve(A)).toThrow('Circular dependency: A -> B -> A');
    expect(() => root.resolve(A)).toThrow(ContainerError);
  });
});

describe('child overrides', () => {
  it('swaps an adapter for a fake and leaves the parent on the real one', () => {
    const root = withService();
    const parentService = root.resolve(Service);
    const child = root.child();
    child.register(Adapter, () => fake);
    expect(child.resolve(Service).adapter).toBe(fake);
    expect(root.resolve(Service)).toBe(parentService);
    expect(parentService.adapter).toBe(real);
  });

  it('swaps before the parent ever resolved the service', () => {
    const root = withService();
    const child = root.child();
    child.register(Adapter, () => fake);
    expect(child.resolve(Service).adapter).toBe(fake);
    expect(root.resolve(Service).adapter).toBe(real);
  });

  it('reuses parent singletons when nothing they depend on is overridden', () => {
    const root = withService();
    expect(root.child().resolve(Service)).toBe(root.resolve(Service));
  });

  it('reuses the child instance from a grandchild', () => {
    const root = withService();
    const child = root.child();
    child.register(Adapter, () => fake);
    const grandchild = child.child();
    expect(grandchild.resolve(Service)).toBe(child.resolve(Service));
  });

  it('lets an override reach a service built through a transient', () => {
    const root = withService();
    const Hop = token<{ readonly adapter: Adapter }>('Hop');
    const Top = token<{ readonly hop: { readonly adapter: Adapter } }>('Top');
    root.register(Hop, (r) => ({ adapter: r.resolve(Adapter) }), 'transient');
    root.register(Top, (r) => ({ hop: r.resolve(Hop) }));
    const parentTop = root.resolve(Top);
    const child = root.child();
    child.register(Adapter, () => fake);
    expect(child.resolve(Top).hop.adapter).toBe(fake);
    expect(root.resolve(Top)).toBe(parentTop);
  });
});

describe('disposal', () => {
  const recorded = (log: string[]) => {
    const root = createContainer();
    const A = token<Disposable>('A');
    const B = token<AsyncDisposable>('B');
    const C = token<AsyncDisposable>('C');
    root.register(A, () => ({ [Symbol.dispose]: () => void log.push('A') }));
    root.register(B, () => ({ [Symbol.asyncDispose]: async () => void log.push('B') }));
    root.register(C, () => ({ [Symbol.asyncDispose]: async () => void log.push('C') }));
    root.resolve(A);
    root.resolve(B);
    root.resolve(C);
    return { root, B };
  };

  it('disposes in reverse creation order, preferring the async disposer', async () => {
    const log: string[] = [];
    await recorded(log).root.dispose();
    expect(log).toEqual(['C', 'B', 'A']);
  });

  it('is idempotent and exposes the async dispose alias', async () => {
    const log: string[] = [];
    const { root } = recorded(log);
    await root[Symbol.asyncDispose]();
    await root.dispose();
    expect(log).toEqual(['C', 'B', 'A']);
  });

  it('skips values without a disposer', async () => {
    const root = createContainer();
    const Plain = token<number>('Plain');
    root.register(Plain, () => 1);
    root.resolve(Plain);
    await expect(root.dispose()).resolves.toBeUndefined();
  });

  it('aggregates failures and still disposes the rest', async () => {
    const log: string[] = [];
    const root = createContainer();
    const A = token<Disposable>('A');
    const B = token<Disposable>('B');
    const failure = new Error('B failed');
    root.register(A, () => ({ [Symbol.dispose]: () => void log.push('A') }));
    root.register(B, () => ({
      [Symbol.dispose]: () => {
        throw failure;
      },
    }));
    root.resolve(A);
    root.resolve(B);
    const error = await root.dispose().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AggregateError);
    expect((error as AggregateError).errors).toEqual([failure]);
    expect(log).toEqual(['A']);
  });

  it('never disposes parent singletons from a child', async () => {
    const log: string[] = [];
    const { root, B } = recorded(log);
    const child = root.child();
    child.resolve(B);
    await child.dispose();
    expect(log).toEqual([]);
  });

  it('rejects use after dispose', async () => {
    const root = createContainer();
    await root.dispose();
    expect(() => root.register(Adapter, () => real)).toThrow('Container is disposed');
    expect(() => root.resolve(Adapter)).toThrow('Container is disposed');
    expect(() => root.child()).toThrow('Container is disposed');
  });

  it('rejects placing a new singleton into a disposed parent', async () => {
    const root = withService();
    const child = root.child();
    await root.dispose();
    expect(() => child.resolve(Adapter)).toThrow('Container is disposed');
  });
});
