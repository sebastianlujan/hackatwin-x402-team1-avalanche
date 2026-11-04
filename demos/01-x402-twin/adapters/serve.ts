import { type ServerType, serve } from '@hono/node-server';
import type { Hono } from 'hono';

export interface Served {
  readonly url: string;
  close(): Promise<void>;
}

// Always binds loopback; port 0 picks a free one.
export function serveLoopback(app: Hono, port: number): Promise<Served> {
  return new Promise((resolve, reject) => {
    const server: ServerType = serve({ fetch: app.fetch, hostname: '127.0.0.1', port }, (info) => {
      resolve({
        url: `http://127.0.0.1:${info.port}`,
        close: () => new Promise<void>((done, fail) => server.close((error) => (error ? fail(error) : done()))),
      });
    });
    server.once('error', reject);
  });
}
