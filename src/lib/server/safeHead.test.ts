// Copyright (c) 2026 Grant Patel. All rights reserved. See LICENSE.

import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { nodeHead } from "./nodeHead";
import { followRedirects, isBlockedAddress, refusal, type HeadFn } from "./safeHead";

describe("isBlockedAddress", () => {
  it("blocks private, local and special addresses", () => {
    for (const ip of [
      "127.0.0.1", "10.1.2.3", "172.16.5.4", "192.168.2.12", "169.254.169.254", "100.64.0.1", "0.0.0.0",
      "224.0.0.1", "255.255.255.255", "::1", "::", "fd00::1", "fe80::1", "::ffff:127.0.0.1", "::ffff:192.168.0.1",
      "64:ff9b::7f00:1", "::ffff:7f00:1", "[::1]", "fe80::1%eth0", "1.2.3", "1::2::3", "not an ip",
    ]) {
      expect(isBlockedAddress(ip), ip).toBe(true);
    }
  });

  it("allows public addresses", () => {
    for (const ip of ["8.8.8.8", "1.1.1.1", "142.250.80.46", "2606:4700:4700::1111", "2001:4860:4860::8888", "::ffff:8.8.8.8"]) {
      expect(isBlockedAddress(ip), ip).toBe(false);
    }
  });
});

describe("refusal", () => {
  it("only looks up plain http and https on normal ports", () => {
    expect(refusal(new URL("https://hotspotparking.com/"))).toBeNull();
    expect(refusal(new URL("http://hotspotparking.com:80/"))).toBeNull();
    expect(refusal(new URL("ftp://example.com/"))).toMatch(/only http and https/);
    expect(refusal(new URL("https://example.com:8443/"))).toMatch(/unusual port/);
    expect(refusal(new URL("https://user:pass@example.com/"))).toMatch(/user name or password/);
    expect(refusal(new URL("http://127.0.0.1/"))).toMatch(/private or local/);
    expect(refusal(new URL("http://0x7f000001/"))).toMatch(/private or local/); // 127.0.0.1 in disguise
    expect(refusal(new URL("http://[::1]/"))).toMatch(/private or local/);
    expect(refusal(new URL("http://[::ffff:10.0.0.1]/"))).toMatch(/private or local/);
    expect(refusal(new URL("http://localhost/"))).toMatch(/private or local/);
    expect(refusal(new URL("http://app.localhost/"))).toMatch(/private or local/);
  });
});

describe("followRedirects (with a pretend network)", () => {
  /** A pretend network: address -> where it redirects to (or nothing). */
  function fakeNet(map: Record<string, string | null>): HeadFn & { calls: string[] } {
    const calls: string[] = [];
    const head: HeadFn = async (url) => {
      calls.push(url.href);
      if (!(url.href in map)) throw Object.assign(new Error("nope"), { code: "ENOTFOUND" });
      const location = map[url.href];
      return location ? { status: 302, location } : { status: 200, location: null };
    };
    return Object.assign(head, { calls });
  }

  it("follows redirects, including relative ones, to the end", async () => {
    const head = fakeNet({
      "https://bit.ly/abc": "https://hotspotparking.com/go",
      "https://hotspotparking.com/go": "/zone/1001",
      "https://hotspotparking.com/zone/1001": null,
    });
    const r = await followRedirects("https://bit.ly/abc", { head });
    expect(r).toEqual({
      chain: ["https://bit.ly/abc", "https://hotspotparking.com/go", "https://hotspotparking.com/zone/1001"],
      complete: true,
      note: null,
    });
  });

  it("stops after 3 hops", async () => {
    const head = fakeNet({
      "https://a.com/": "https://b.com/",
      "https://b.com/": "https://c.com/",
      "https://c.com/": "https://d.com/",
      "https://d.com/": "https://e.com/",
      "https://e.com/": null,
    });
    const r = await followRedirects("https://a.com/", { head });
    expect(r.complete).toBe(false);
    expect(r.chain).toHaveLength(4);
    expect(r.note).toBe("Stopped after 3 redirects.");
    expect(head.calls).toHaveLength(4); // never asked e.com
  });

  it("refuses a redirect into a private network, without asking it", async () => {
    const head = fakeNet({ "https://evil.example/": "http://192.168.0.1/admin" });
    const r = await followRedirects("https://evil.example/", { head });
    expect(r.complete).toBe(false);
    expect(r.note).toMatch(/private or local/);
    expect(head.calls).toEqual(["https://evil.example/"]);
  });

  it("refuses a redirect to something that isn't http or https", async () => {
    const head = fakeNet({ "https://evil.example/": "javascript:alert(1)" });
    const r = await followRedirects("https://evil.example/", { head });
    expect(r.note).toMatch(/only http and https/);
  });

  it("explains a website that doesn't exist", async () => {
    const r = await followRedirects("https://nowhere.example/", { head: fakeNet({}) });
    expect(r).toEqual({ chain: ["https://nowhere.example/"], complete: false, note: "That website name does not exist." });
  });
});

describe("nodeHead (real network code, local only)", () => {
  let server: http.Server;
  let port = 0;
  let hits = 0;

  beforeAll(async () => {
    server = http.createServer((_req, res) => {
      hits++;
      res.writeHead(302, { location: "http://example.com/" }).end();
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    port = (server.address() as AddressInfo).port;
  });
  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  it("will not connect to this computer by name", async () => {
    await expect(nodeHead(new URL(`http://localhost:${port}/`), 2000)).rejects.toMatchObject({ code: "EREFUSED_ADDRESS" });
    expect(hits).toBe(0);
  });

  it("will not follow a chain that starts on this computer", async () => {
    const r = await followRedirects(`http://127.0.0.1:${port}/`, { head: nodeHead, perHopMs: 2000 });
    expect(r.complete).toBe(false);
    expect(hits).toBe(0);
  });
});
