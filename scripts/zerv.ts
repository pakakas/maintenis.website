#!/usr/bin/env bun
/**
 * zerv.ts — minimal static file server for maintenis.tech.
 * Use when cloudflared tunnel is up but no app serves port 2999.
 *
 * Usage:
 *   PORT=2999 bun zerv.ts <root-dir>
 *   # e.g.: cd /home/hyuze/kerjaan/maintenis/maintenis.tech && bun zerv.ts .
 *
 * Features:
 *   - Serves files from <root-dir>
 *   - index.html for directory requests
 *   - Falls back to /index.html for unknown paths (SPA-friendly)
 *   - Sets correct MIME types for .html, .css, .js, .json, .svg, .png, etc.
 *   - Logs every request to stdout
 */

import { serve, file } from "bun";
import { extname, join, normalize, resolve } from "node:path";

const PORT = parseInt(process.env.PORT ?? "2999", 10);
const ROOT = resolve(process.argv[2] ?? ".");

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".js":   "application/javascript; charset=utf-8",
  ".mjs":  "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xml":  "application/xml; charset=utf-8",
  ".svg":  "image/svg+xml",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif":  "image/gif",
  ".webp": "image/webp",
  ".ico":  "image/x-icon",
  ".txt":  "text/plain; charset=utf-8",
  ".md":   "text/markdown; charset=utf-8",
  ".pdf":  "application/pdf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function mimeFor(p: string): string {
  return MIME[extname(p).toLowerCase()] ?? "application/octet-stream";
}

function safeJoin(root: string, urlPath: string): string | null {
  // Strip query, decode, strip leading slash
  const clean = decodeURIComponent(urlPath.split("?")[0].split("#")[0]);
  const rel = clean.replace(/^\/+/, "");
  const abs = normalize(join(root, rel));
  // Path traversal guard: must stay inside ROOT
  if (!abs.startsWith(root)) return null;
  return abs;
}

async function tryFile(abs: string): Promise<Response> {
  const f = file(abs);
  if (!(await f.exists())) return new Response("Not found", { status: 404 });
  return new Response(f, { headers: { "Content-Type": mimeFor(abs) } });
}

const server = serve({
  port: PORT,
  hostname: "127.0.0.1",
  async fetch(req) {
    const url = new URL(req.url);
    const target = safeJoin(ROOT, url.pathname);
    if (!target) return new Response("Forbidden", { status: 403 });

    // 1. exact file
    const f = file(target);
    if (await f.exists()) {
      const stat = await f.stat();
      if (stat.isDirectory()) {
        // try index.html inside
        const idx = join(target, "index.html");
        if (await file(idx).exists()) {
          console.log(`${req.method} ${url.pathname} -> ${idx.replace(ROOT + "/", "")} [200]`);
          return tryFile(idx);
        }
        console.log(`${req.method} ${url.pathname} -> (dir, no index) [404]`);
        return new Response("Not found", { status: 404 });
      }
      console.log(`${req.method} ${url.pathname} -> ${target.replace(ROOT + "/", "")} [200]`);
      return tryFile(target);
    }

    // 2. try with .html extension
    if (!extname(target)) {
      const withHtml = target + ".html";
      if (await file(withHtml).exists()) {
        console.log(`${req.method} ${url.pathname} -> ${withHtml.replace(ROOT + "/", "")} [200]`);
        return tryFile(withHtml);
      }
    }

    // 3. SPA fallback: serve /index.html
    const idx = join(ROOT, "index.html");
    if (await file(idx).exists()) {
      console.log(`${req.method} ${url.pathname} -> index.html (fallback) [200]`);
      return tryFile(idx);
    }

    console.log(`${req.method} ${url.pathname} [404]`);
    return new Response("Not found", { status: 404 });
  },
});

console.log(`[zerv] serving ${ROOT} on http://${server.hostname}:${server.port}`);
