import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Readable } from 'node:stream';

/**
 * Polyfork CDN proxy (§11.2). Fetches server-side and streams back with
 * permissive CORS and a long-lived cache header — committing the GLBs
 * themselves is against Polyfork's licence, but proxying with caching is
 * fine.
 *
 * The Pro tier token lives only in this function's environment
 * (POLYFORK_PRO_TOKEN, set in the Vercel project's env vars) — never a
 * client-supplied value, never a Vite build-time env var. A build-time
 * env var would get compiled into the public JS bundle and be exactly as
 * exposed as committing it; a serverless-function env var never reaches
 * the client at all. One token serves Pro assets to every visitor, so
 * there's no per-user credential UI to build or maintain.
 */

const FREE_CDN_BASE = 'https://polyfork.dev/cdn/';
const PRO_CDN_BASE = 'https://polyfork.dev/c/';
const VALID_ID = /^[a-zA-Z0-9-]+$/;

export function buildUpstreamUrl(id: string, tier: 'free' | 'pro', proToken: string | undefined): string | null {
  if (tier === 'pro') {
    if (!proToken) return null;
    return `${PRO_CDN_BASE}${proToken}/${id}.glb`;
  }
  return `${FREE_CDN_BASE}${id}.glb`;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }

  const rawId = req.query.id;
  const id = typeof rawId === 'string' ? rawId : Array.isArray(rawId) ? rawId[0] : undefined;
  if (!id || !VALID_ID.test(id)) {
    res.status(400).json({ error: 'invalid asset id' });
    return;
  }

  const tier = req.query.tier === 'pro' ? 'pro' : 'free';
  const upstreamUrl = buildUpstreamUrl(id, tier, process.env.POLYFORK_PRO_TOKEN);
  if (!upstreamUrl) {
    res.status(404).json({ error: 'pro tier not configured', reason: 'no-token' });
    return;
  }

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl);
  } catch {
    res.status(502).json({ error: 'upstream fetch failed' });
    return;
  }

  if (!upstream.ok || !upstream.body) {
    res.status(upstream.status || 502).json({ error: 'upstream error', status: upstream.status });
    return;
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', upstream.headers.get('content-type') ?? 'model/gltf-binary');
  res.setHeader('Cache-Control', 's-maxage=31536000, immutable');
  res.status(200);

  // upstream.body is a web ReadableStream (DOM lib); Readable.fromWeb wants
  // node:stream/web's type of the same shape — structurally identical at
  // runtime, hence the cast.
  Readable.fromWeb(upstream.body as unknown as import('node:stream/web').ReadableStream<Uint8Array>).pipe(res);
}
