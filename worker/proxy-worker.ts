// Worker proxy - fetch from dgt36 tunnel, fallback to Pages
// Deploy: bash cf-worker.sh deploy-proxy

const TUNNEL_HOST = "origin.maintenis.tech";
const PAGES_HOST = "maintenis-website.pages.dev";
const TIMEOUT_MS = 5000;

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Try dgt36 first
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const dgt36Url = `https://${TUNNEL_HOST}${url.pathname}${url.search}`;
      const response = await fetch(dgt36Url, {
        method: request.method,
        headers: request.headers,
        body: request.method !== "GET" && request.method !== "HEAD" ? request.body : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (response.ok) {
        return response;
      }
    } catch (e) {
      // dgt36 is down, continue to fallback
    }

    // Fallback to Pages
    const pagesUrl = `https://${PAGES_HOST}${url.pathname}${url.search}`;
    return fetch(pagesUrl, {
      method: request.method,
      headers: request.headers,
      body: request.method !== "GET" && request.method !== "HEAD" ? request.body : undefined,
    });
  },
};
