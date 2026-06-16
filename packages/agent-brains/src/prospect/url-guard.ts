import { lookup as dnsLookupCb } from "node:dns";
import { lookup as dnsLookupPromise } from "node:dns/promises";
import { isIP } from "node:net";
import { Agent, fetch as undiciFetch } from "undici";

// SSRF guard for server-side fetches of user-supplied URLs (e.g. accounts.website_url).
// Two layers: (1) assertPublicHttpUrl pre-validates scheme/host and every resolved IP;
// (2) createGuardedFetch re-checks the ACTUAL connecting IP at socket-connect time, which
// also covers redirects and DNS-rebinding between validation and the request.

/** Injectable so tests need no network. Mirrors dns.lookup(host, { all: true }). */
export type DnsResolver = (hostname: string) => Promise<Array<{ address: string; family: number }>>;

const defaultResolver: DnsResolver = (hostname) => dnsLookupPromise(hostname, { all: true });

/** True for any IP that must never be reachable from a user-driven fetch. Unparseable → blocked. */
export function isBlockedIP(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) {
    const parts = ip.split(".").map(Number);
    const a = parts[0] ?? 0;
    const b = parts[1] ?? 0;
    return (
      a === 0 || // "this" network
      a === 10 || // private
      a === 127 || // loopback
      (a === 100 && b >= 64 && b <= 127) || // CGNAT 100.64/10
      (a === 169 && b === 254) || // link-local + cloud metadata (169.254.169.254)
      (a === 172 && b >= 16 && b <= 31) || // private
      (a === 192 && b === 168) || // private
      a >= 224 // multicast / reserved / broadcast
    );
  }
  if (kind === 6) {
    const v = ip.toLowerCase();
    if (v === "::1" || v === "::") return true; // loopback / unspecified
    if (v.startsWith("fc") || v.startsWith("fd")) return true; // unique-local fc00::/7
    if (v.startsWith("fe80")) return true; // link-local
    const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/); // IPv4-mapped
    if (mapped && mapped[1]) return isBlockedIP(mapped[1]);
    return false;
  }
  return true; // not a valid IP literal
}

/**
 * Validate a user-supplied URL before fetching it. Rejects non-http(s) schemes, obvious
 * internal hostnames, and any host that resolves (even partly) to a private/reserved IP.
 * Returns the parsed URL on success; throws otherwise.
 */
export async function assertPublicHttpUrl(raw: string, resolver: DnsResolver = defaultResolver): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("invalid URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("URL scheme not allowed");
  }
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (host === "" || host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new Error("URL host not allowed");
  }
  if (isIP(host)) {
    if (isBlockedIP(host)) throw new Error("URL resolves to a private address");
    return url;
  }
  const records = await resolver(host);
  if (records.length === 0) throw new Error("URL host did not resolve");
  for (const r of records) {
    if (isBlockedIP(r.address)) throw new Error("URL resolves to a private address");
  }
  return url;
}

/**
 * A fetch that blocks any connection whose resolved IP is private/reserved — checked at
 * socket-connect time, so it also rejects redirects and DNS-rebinding to internal hosts.
 * Use as the transport for any fetch of a user-supplied URL.
 */
export function createGuardedFetch(): typeof fetch {
  const dispatcher = new Agent({
    connect: {
      lookup: (hostname, options, callback) =>
        dnsLookupCb(hostname, options, (err, address, family) => {
          if (err) return callback(err, address as string, family as number);
          if (typeof address === "string" && isBlockedIP(address)) {
            return callback(new Error("blocked private address"), address, family as number);
          }
          callback(null, address as string, family as number);
        }),
    },
  });
  return ((input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) =>
    undiciFetch(input as Parameters<typeof undiciFetch>[0], {
      ...(init as Parameters<typeof undiciFetch>[1]),
      dispatcher,
    })) as unknown as typeof fetch;
}
