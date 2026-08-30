// Worker orchestrator - cron-based DNS switching
// Deploy: bash cf-worker.sh deploy-orchestrator

const ZONE_ID = "3136d53b9c35043535b6cdf6aed64777";
const DNS_RECORD_ID = "90477c5a8a367d4b7f8d6356ceb8931a";
const TUNNEL_TARGET = "7206b881-ccdc-473f-bb00-481bccb8cb1c.cfargotunnel.com";
const PAGES_TARGET = "maintenis-website.pages.dev";
const DGT36_CHECK_URL = "https://origin.maintenis.tech";
const TIMEOUT_MS = 5000;

async function checkDgt36(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const r = await fetch(DGT36_CHECK_URL, { signal: controller.signal, cache: "no-store" });
    clearTimeout(timeout);
    return r.ok;
  } catch {
    return false;
  }
}

async function setDNS(content: string, apiToken: string): Promise<boolean> {
  const r = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records/${DNS_RECORD_ID}`,
    {
      method: "PATCH",
      headers: { Authorization: `Bearer ${apiToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    }
  );
  const d = await r.json();
  return d.success;
}

async function getDNS(apiToken: string): Promise<string> {
  const r = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records/${DNS_RECORD_ID}`,
    { headers: { Authorization: `Bearer ${apiToken}` } }
  );
  const d = await r.json();
  return d.result?.content ?? "";
}

export default {
  async fetch(request: Request): Promise<Response> {
    return new Response("Orkestrator worker. Use cron trigger.", { status: 200 });
  },

  async scheduled(event: ScheduledEvent, env: Env): Promise<void> {
    const apiToken = env.CLOUDFLARE_API_TOKEN;
    const current = await getDNS(apiToken);
    const dgt36Up = await checkDgt36();

    if (dgt36Up && current !== TUNNEL_TARGET) {
      await setDNS(TUNNEL_TARGET, apiToken);
      console.log(`dgt36 UP → DNS set to tunnel`);
    } else if (!dgt36Up && current !== PAGES_TARGET) {
      await setDNS(PAGES_TARGET, apiToken);
      console.log(`dgt36 DOWN → DNS set to Pages`);
    }
  },
};
