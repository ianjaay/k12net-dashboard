import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import type { IncomingMessage, ServerResponse } from 'http'
import { request as httpsRequest } from 'https'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'api-proxy',
      configureServer(server) {
        server.middlewares.use('/api-proxy', (req: IncomingMessage, res: ServerResponse) => {
          const targetUrl = req.headers['x-target-url'] as string;
          if (!targetUrl) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Missing X-Target-Url header' }));
            return;
          }

          // Collect the request body
          const chunks: Buffer[] = [];
          req.on('data', (chunk: Buffer) => chunks.push(chunk));
          req.on('end', () => {
            const body = Buffer.concat(chunks);
            const url = new URL(targetUrl);

            const headers: Record<string, string> = {};
            // Forward relevant headers
            if (req.headers['content-type']) headers['content-type'] = req.headers['content-type'] as string;
            if (req.headers['accept']) headers['accept'] = req.headers['accept'] as string;
            if (req.headers['authorization']) headers['authorization'] = req.headers['authorization'] as string;
            headers['host'] = url.host;
            if (body.length > 0) headers['content-length'] = String(body.length);

            const proxyReq = httpsRequest(
              {
                hostname: url.hostname,
                port: url.port || 443,
                path: url.pathname + (url.search || ''),
                method: req.method || 'GET',
                headers,
              },
              (proxyRes) => {
                // Add CORS headers
                res.writeHead(proxyRes.statusCode || 500, {
                  ...proxyRes.headers,
                  'access-control-allow-origin': '*',
                  'access-control-allow-headers': '*',
                });
                proxyRes.pipe(res);
              },
            );

            proxyReq.on('error', (err) => {
              res.writeHead(502, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Proxy error', message: err.message }));
            });

            if (body.length > 0) proxyReq.write(body);
            proxyReq.end();
          });
        });
      },
    },
  ],
})
