export type Token<T> = symbol & { readonly __type?: T };
export const token = <T>(name: string): Token<T> => Symbol(name) as Token<T>;

export type Scope = 'singleton' | 'transient';
export interface Resolver {
  resolve<T>(token: Token<T>): T;
}
export interface Container extends Resolver, AsyncDisposable {
  register<T>(token: Token<T>, factory: (resolver: Resolver) => T, scope?: Scope): void;
  child(): Container;
  dispose(): Promise<void>;
}

export class ContainerError extends Error {
  override readonly name = 'ContainerError';
}

interface Registration {
  readonly factory: (resolver: Resolver) => unknown;
  readonly scope: Scope;
}
interface Entry {
  readonly value: unknown;
  readonly closure: ReadonlySet<symbol>;
}

const label = (t: symbol): string => String(t.description);

class ScopedContainer implements Container {
  private readonly registrations = new Map<symbol, Registration>();
  private readonly cache = new Map<symbol, Entry>();
  private readonly created: unknown[] = [];
  private readonly parent: ScopedContainer | undefined;
  private disposed = false;

  constructor(parent: ScopedContainer | undefined) {
    this.parent = parent;
  }

  register<T>(t: Token<T>, factory: (resolver: Resolver) => T, scope: Scope = 'singleton'): void {
    this.assertLive();
    if (this.registrations.has(t)) throw new ContainerError(`Token "${label(t)}" is already registered`);
    this.registrations.set(t, { factory, scope });
  }

  resolve<T>(t: Token<T>): T {
    this.assertLive();
    return this.build(t, []).value as T;
  }

  child(): Container {
    this.assertLive();
    return new ScopedContainer(this);
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    const errors: unknown[] = [];
    for (const value of [...this.created].reverse()) {
      const target = Object(value) as Partial<AsyncDisposable & Disposable>;
      try {
        await (target[Symbol.asyncDispose] ?? target[Symbol.dispose])?.call(target);
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length > 0) throw new AggregateError(errors, `${errors.length} disposer(s) failed`);
  }

  [Symbol.asyncDispose](): Promise<void> {
    return this.dispose();
  }

  private assertLive(): void {
    if (this.disposed) throw new ContainerError('Container is disposed');
  }

  private build(t: symbol, path: readonly symbol[]): Entry {
    if (path.includes(t)) throw new ContainerError(`Circular dependency: ${[...path, t].map(label).join(' -> ')}`);
    // Walk to the owner, skipping cached values built on a registration a closer container overrides.
    const shadow = new Set<symbol>();
    let found: { readonly owner: ScopedContainer; readonly registration: Registration } | undefined;
    for (let c: ScopedContainer | undefined = this; c && !found; c = c.parent) {
      const hit = c.cache.get(t);
      if (hit && ![...hit.closure].some((k) => shadow.has(k))) return hit;
      const registration = c.registrations.get(t);
      if (registration) found = { owner: c, registration };
      else for (const k of c.registrations.keys()) shadow.add(k);
    }
    if (!found) {
      const via = path.length > 0 ? ` (required by ${path.map(label).join(' -> ')})` : '';
      throw new ContainerError(`No registration for "${label(t)}"${via}`);
    }

    const closure = new Set<symbol>([t]);
    let active = true;
    const resolver: Resolver = {
      resolve: <D>(dep: Token<D>): D => {
        if (!active) throw new ContainerError(`Resolver for "${label(t)}" used after its factory returned`);
        const entry = this.build(dep, [...path, t]);
        for (const k of entry.closure) closure.add(k);
        return entry.value as D;
      },
    };
    let value: unknown;
    try {
      value = found.registration.factory(resolver);
    } finally {
      active = false;
    }

    const entry: Entry = { value, closure };
    if (found.registration.scope === 'singleton') {
      // Cache at the closest container that registers any token the value was built from.
      let target: ScopedContainer = this;
      while (![...closure].some((k) => target.registrations.has(k))) target = target.parent as ScopedContainer;
      target.assertLive();
      target.cache.set(t, entry);
      target.created.push(value);
    }
    return entry;
  }
}

export function createContainer(): Container {
  return new ScopedContainer(undefined);
}
