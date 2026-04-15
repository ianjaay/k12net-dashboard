import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Vercel serverless proxy for OneRoster API calls.
 * Avoids CORS issues by forwarding requests server-side.
 *
 * Client sends:
 *   POST /api/proxy
 *   Body: { url, method?, headers?, body? }
 *
 * Proxy forwards the request and returns the response.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { url, method, headers, body } = req.body ?? {};

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Missing url in request body' });
  }

  // Only allow proxying to known K12net domains
  const allowedHosts = ['azure.k12net.com', 'k12net.com'];
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return res.status(400).json({ error: 'Invalid url' });
  }
  if (!allowedHosts.some(h => parsedUrl.hostname === h || parsedUrl.hostname.endsWith('.' + h))) {
    return res.status(403).json({ error: 'Host not allowed' });
  }

  try {
    const fetchHeaders: Record<string, string> = {};
    if (headers && typeof headers === 'object') {
      for (const [k, v] of Object.entries(headers)) {
        if (typeof v === 'string') fetchHeaders[k] = v;
      }
    }

    const upstream = await fetch(url, {
      method: method || 'GET',
      headers: fetchHeaders,
      body: body ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
    });

    const contentType = upstream.headers.get('content-type') || 'application/json';
    const responseBody = await upstream.text();

    res.setHeader('Content-Type', contentType);
    return res.status(upstream.status).send(responseBody);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Proxy request failed';
    return res.status(502).json({ error: message });
  }
}
