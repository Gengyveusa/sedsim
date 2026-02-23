/**
 * worker/index.ts
 * Cloudflare Worker proxy for Anthropic Claude API.
 * Keeps the API key server-side so it is never exposed in the browser.
 *
 * Deploy:
 *   cd worker && npx wrangler deploy
 *
 * Set secret:
 *   npx wrangler secret put ANTHROPIC_API_KEY
 */

interface Env {
  ANTHROPIC_API_KEY: string;
}

const ALLOWED_ORIGINS = [
  'https://gengyveusa.github.io',
  'http://localhost:5173',
  'http://localhost:4173',
];

function corsHeaders(origin: string): Record<string, string> {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin') || '';
    const cors = corsHeaders(origin);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: cors });
    }

    if (!env.ANTHROPIC_API_KEY) {
      return new Response('API key not configured', { status: 500, headers: cors });
    }

    try {
      const body = await request.text();

      const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body,
      });

      // Stream the response back to the client
      return new Response(anthropicResponse.body, {
        status: anthropicResponse.status,
        headers: {
          ...cors,
          'Content-Type': anthropicResponse.headers.get('Content-Type') || 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
      });
    } catch (error) {
      return new Response(
        JSON.stringify({ error: 'Proxy error', message: (error as Error).message }),
        { status: 502, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }
  },
};
