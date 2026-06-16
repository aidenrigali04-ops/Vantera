import { describe, expect, it } from "vitest";
import { assertPublicHttpUrl, isBlockedIP, type DnsResolver } from "./url-guard";

describe("isBlockedIP", () => {
  it("blocks IPv4 private, loopback, link-local, CGNAT, metadata, multicast", () => {
    for (const ip of [
      "0.0.0.0",
      "10.0.0.1",
      "127.0.0.1",
      "100.64.0.1",
      "169.254.169.254", // cloud metadata
      "172.16.5.4",
      "172.31.255.255",
      "192.168.1.1",
      "224.0.0.1",
    ]) {
      expect(isBlockedIP(ip), ip).toBe(true);
    }
  });

  it("blocks IPv6 loopback, unique-local, link-local, and IPv4-mapped private", () => {
    for (const ip of ["::1", "::", "fc00::1", "fd12:3456::1", "fe80::1", "::ffff:127.0.0.1"]) {
      expect(isBlockedIP(ip), ip).toBe(true);
    }
  });

  it("allows public IPs", () => {
    for (const ip of ["93.184.216.34", "8.8.8.8", "2606:2800:220:1:248:1893:25c8:1946"]) {
      expect(isBlockedIP(ip), ip).toBe(false);
    }
  });

  it("treats unparseable input as blocked", () => {
    expect(isBlockedIP("not-an-ip")).toBe(true);
    expect(isBlockedIP("")).toBe(true);
  });
});

describe("assertPublicHttpUrl", () => {
  const publicResolver: DnsResolver = async () => [{ address: "93.184.216.34", family: 4 }];
  const internalResolver: DnsResolver = async () => [{ address: "10.0.0.5", family: 4 }];

  it("rejects non-http(s) schemes", async () => {
    for (const u of ["file:///etc/passwd", "gopher://x", "ftp://x.com", "data:text/html,x"]) {
      await expect(assertPublicHttpUrl(u, publicResolver)).rejects.toThrow(/scheme not allowed/);
    }
  });

  it("rejects internal hostnames without resolving", async () => {
    const throwingResolver: DnsResolver = async () => {
      throw new Error("should not resolve");
    };
    for (const u of ["http://localhost/x", "http://db.internal/x", "https://svc.local/x"]) {
      await expect(assertPublicHttpUrl(u, throwingResolver)).rejects.toThrow(/host not allowed/);
    }
  });

  it("rejects IP-literal hosts in private ranges", async () => {
    await expect(assertPublicHttpUrl("http://127.0.0.1:9200", publicResolver)).rejects.toThrow(/private address/);
    await expect(assertPublicHttpUrl("http://169.254.169.254/latest/meta-data/", publicResolver)).rejects.toThrow(
      /private address/,
    );
  });

  it("rejects hosts that resolve to a private address", async () => {
    await expect(assertPublicHttpUrl("https://evil.example.com", internalResolver)).rejects.toThrow(/private address/);
  });

  it("rejects hosts that do not resolve", async () => {
    await expect(assertPublicHttpUrl("https://nope.example.com", async () => [])).rejects.toThrow(/did not resolve/);
  });

  it("allows a public https host", async () => {
    const url = await assertPublicHttpUrl("https://acme.com/path", publicResolver);
    expect(url.hostname).toBe("acme.com");
  });
});
