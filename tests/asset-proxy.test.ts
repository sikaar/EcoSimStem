import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Writable } from 'node:stream';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import handler, { buildUpstreamUrl } from '../api/asset/[id]';

class MockResponse extends Writable {
  statusCode: number | undefined;
  headers: Record<string, string> = {};
  jsonBody: unknown;
  chunks: Buffer[] = [];

  override _write(chunk: unknown, _enc: BufferEncoding, callback: (error?: Error | null) => void): void {
    this.chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
    callback();
  }

  status(code: number): this {
    this.statusCode = code;
    return this;
  }

  json(body: unknown): this {
    this.jsonBody = body;
    return this;
  }

  setHeader(name: string, value: string): this {
    this.headers[name] = value;
    return this;
  }
}

function mockReq(overrides: Partial<VercelRequest> = {}): VercelRequest {
  return { method: 'GET', query: {}, ...overrides } as VercelRequest;
}

function fakeGlbResponse(): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('fake glb bytes'));
      controller.close();
    },
  });
  return new Response(stream, { status: 200, headers: { 'content-type': 'model/gltf-binary' } });
}

describe('buildUpstreamUrl', () => {
  it('builds the free-tier URL with no token needed', () => {
    expect(buildUpstreamUrl('water-blob-f266b8', 'free', undefined)).toBe(
      'https://polyfork.dev/cdn/water-blob-f266b8.glb',
    );
  });

  it('builds the pro-tier URL from the server-side token', () => {
    expect(buildUpstreamUrl('forest-rabbit-ea2da0', 'pro', 'secret-token')).toBe(
      'https://polyfork.dev/c/secret-token/forest-rabbit-ea2da0.glb',
    );
  });

  it('returns null for pro tier when no token is configured', () => {
    expect(buildUpstreamUrl('forest-rabbit-ea2da0', 'pro', undefined)).toBeNull();
  });
});

describe('asset proxy handler', () => {
  const originalToken = process.env.POLYFORK_PRO_TOKEN;

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalToken === undefined) delete process.env.POLYFORK_PRO_TOKEN;
    else process.env.POLYFORK_PRO_TOKEN = originalToken;
  });

  it('rejects non-GET methods', async () => {
    const res = new MockResponse();
    await handler(mockReq({ method: 'POST' }), res as unknown as VercelResponse);
    expect(res.statusCode).toBe(405);
  });

  it('rejects a missing or malformed id', async () => {
    const res = new MockResponse();
    await handler(mockReq({ query: {} }), res as unknown as VercelResponse);
    expect(res.statusCode).toBe(400);

    const res2 = new MockResponse();
    await handler(mockReq({ query: { id: '../etc/passwd' } }), res2 as unknown as VercelResponse);
    expect(res2.statusCode).toBe(400);
  });

  it('never fetches upstream for pro tier when no token is configured (never falls back to a client-supplied one)', async () => {
    delete process.env.POLYFORK_PRO_TOKEN;
    const res = new MockResponse();
    await handler(mockReq({ query: { id: 'forest-rabbit-ea2da0', tier: 'pro' } }), res as unknown as VercelResponse);
    expect(res.statusCode).toBe(404);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('streams a successful free-tier fetch through with CORS and cache headers', async () => {
    vi.mocked(fetch).mockResolvedValue(fakeGlbResponse());
    const res = new MockResponse();
    const done = new Promise<void>((resolve) => res.on('finish', resolve));
    await handler(mockReq({ query: { id: 'water-blob-f266b8' } }), res as unknown as VercelResponse);
    await done;

    expect(fetch).toHaveBeenCalledWith('https://polyfork.dev/cdn/water-blob-f266b8.glb');
    expect(res.statusCode).toBe(200);
    expect(res.headers['Access-Control-Allow-Origin']).toBe('*');
    expect(res.headers['Cache-Control']).toBe('s-maxage=31536000, immutable');
    expect(Buffer.concat(res.chunks).toString()).toBe('fake glb bytes');
  });

  it('uses the server-side token for a pro-tier request', async () => {
    process.env.POLYFORK_PRO_TOKEN = 'secret-token';
    vi.mocked(fetch).mockResolvedValue(fakeGlbResponse());
    const res = new MockResponse();
    const done = new Promise<void>((resolve) => res.on('finish', resolve));
    await handler(mockReq({ query: { id: 'forest-rabbit-ea2da0', tier: 'pro' } }), res as unknown as VercelResponse);
    await done;

    expect(fetch).toHaveBeenCalledWith('https://polyfork.dev/c/secret-token/forest-rabbit-ea2da0.glb');
    expect(res.statusCode).toBe(200);
  });

  it('surfaces an upstream error status instead of masking it as success', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 404 }));
    const res = new MockResponse();
    await handler(mockReq({ query: { id: 'missing-asset' } }), res as unknown as VercelResponse);
    expect(res.statusCode).toBe(404);
  });

  it('returns 502 when the upstream fetch itself throws', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('network down'));
    const res = new MockResponse();
    await handler(mockReq({ query: { id: 'water-blob-f266b8' } }), res as unknown as VercelResponse);
    expect(res.statusCode).toBe(502);
  });
});
