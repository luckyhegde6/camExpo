const os = require('os') as {
  networkInterfaces(): Record<string, { address: string; family: string; internal: boolean }[]>;
};

const SCAN_TIMEOUT = 2000;
const CONCURRENCY = 50;
const MAX_SCAN_MS = 20000;

function getSubnets(): string[] {
  const subnets = new Set<string>();
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    const interfaces = nets[name];
    if (!interfaces) continue;
    for (const net of interfaces) {
      if (net.family === 'IPv4' && !net.internal) {
        const parts = net.address.split('.');
        if (parts.length === 4) {
          subnets.add(`${parts[0]}.${parts[1]}.${parts[2]}.`);
        }
      }
    }
  }
  ['192.168.1.', '192.168.0.', '10.0.0.', '172.16.0.'].forEach(s => subnets.add(s));
  return Array.from(subnets);
}

async function probe(ip: string, signal: AbortSignal): Promise<string | null> {
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), SCAN_TIMEOUT);
    const res = await fetch(`http://${ip}:80/status`, { signal: c.signal });
    clearTimeout(t);
    if (signal.aborted) return null;
    if (res.ok) return ip;
    const text = await res.text();
    if (/esp32|camera/i.test(text)) return ip;
    return null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const scanSubnets = url.searchParams.get('subnets')?.split(',') || getSubnets();

  const abort = new AbortController();
  const maxTimer = setTimeout(() => abort.abort(), MAX_SCAN_MS);

  const found: string[] = [];

  for (const subnet of scanSubnets) {
    if (abort.signal.aborted) break;
    const ips = Array.from({ length: 254 }, (_, i) => `${subnet}${i + 1}`);

    for (let start = 0; start < ips.length; start += CONCURRENCY) {
      if (abort.signal.aborted) break;
      const batch = ips.slice(start, start + CONCURRENCY);
      const results = await Promise.all(batch.map(ip => probe(ip, abort.signal)));
      for (const ip of results) {
        if (ip) found.push(ip);
      }
      if (found.length > 0) break;
    }
  }

  clearTimeout(maxTimer);
  return Response.json({ cameras: found });
}
