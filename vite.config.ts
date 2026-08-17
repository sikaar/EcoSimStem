import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { buildUpstreamUrl } from './api/asset/[id]';

/**
 * Dev-only stand-in for the Vercel serverless function at
 * `api/asset/[id].ts`. Without it `npm run dev` has no `/api` at all —
 * Vite's history fallback answers every asset request with index.html, the
 * GLTF loader fails to parse it, and every species silently falls back to
 * its procedural box. That makes the one thing you cannot check locally
 * "do the real models look right in the scene", which is exactly the class
 * of bug this exists to catch.
 *
 * It calls the same `buildUpstreamUrl` the deployed function uses, so the
 * URL shape (and the rule that a Pro asset without a token is a 404, never
 * a silent free-tier fetch) can't drift between the two. The token is read
 * from the dev process's own env, never sent to the browser.
 */
function polyforkAssetDevProxy(proToken: string | undefined): Plugin {
  return {
    name: 'polyfork-asset-dev-proxy',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/asset/', async (req, res, next) => {
        const url = new URL(req.url ?? '', 'http://localhost');
        const id = url.pathname.replace(/^\//, '');
        const tier = url.searchParams.get('tier') === 'pro' ? 'pro' : 'free';
        if (!/^[a-zA-Z0-9-]+$/.test(id)) return next();

        const upstream = buildUpstreamUrl(id, tier, proToken);
        if (!upstream) {
          res.statusCode = 404;
          res.end(JSON.stringify({ error: 'pro tier not configured', reason: 'no-token' }));
          return;
        }
        try {
          const response = await fetch(upstream);
          if (!response.ok) {
            res.statusCode = response.status;
            res.end(JSON.stringify({ error: 'upstream error', status: response.status }));
            return;
          }
          res.setHeader('Content-Type', response.headers.get('content-type') ?? 'model/gltf-binary');
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch {
          res.statusCode = 502;
          res.end(JSON.stringify({ error: 'upstream fetch failed' }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Third arg '' loads every var, not just VITE_-prefixed ones — this token
  // must NOT be VITE_-prefixed, since that would compile it into the client
  // bundle. It is used here in the dev server process only.
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), polyforkAssetDevProxy(env.POLYFORK_PRO_TOKEN ?? process.env.POLYFORK_PRO_TOKEN)],
    test: {
      environment: 'node',
      include: ['tests/**/*.test.ts'],
    },
  };
});
