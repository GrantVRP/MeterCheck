// Copyright (c) 2026 GrantVRP. All rights reserved. See LICENSE.

// Private, local and special network addresses we must never connect to.
// Plain TypeScript (no Node modules), so it runs on the laptop and on Cloudflare.

type Range = [bits: number[], prefix: number];

function v4(ip: string): number[] | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  const bytes = parts.map((p) => (/^\d{1,3}$/.test(p) ? Number(p) : NaN));
  return bytes.every((b) => b >= 0 && b <= 255) ? bytes : null;
}

/** IPv6 as 16 bytes. Handles "::" and a dotted IPv4 tail (::ffff:10.0.0.1). */
function v6(ip: string): number[] | null {
  let text = ip.replace(/^\[|\]$/g, "").replace(/%.*$/, "").toLowerCase();
  let tail: number[] = [];
  const dotted = text.match(/^(.*:)(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) {
    const four = v4(dotted[2]);
    if (!four) return null;
    tail = four;
    text = dotted[1] + "0:0"; // placeholder words, replaced below
  }
  const halves = text.split("::");
  if (halves.length > 2) return null;
  const words = (s: string) => (s ? s.split(":") : []);
  const head = words(halves[0]);
  const rest = halves.length === 2 ? words(halves[1]) : [];
  const fill = 8 - head.length - rest.length;
  if (halves.length === 1 ? head.length !== 8 : fill < 0) return null;
  const all = [...head, ...Array(halves.length === 2 ? fill : 0).fill("0"), ...rest];
  if (all.length !== 8 || !all.every((w) => /^[0-9a-f]{1,4}$/.test(w))) return null;
  const bytes = all.flatMap((w) => {
    const n = parseInt(w, 16);
    return [n >> 8, n & 255];
  });
  if (tail.length) bytes.splice(12, 4, ...tail);
  return bytes;
}

function inRange(bytes: number[], [base, prefix]: Range): boolean {
  for (let bit = 0; bit < prefix; bit++) {
    const i = bit >> 3;
    const mask = 0x80 >> (bit & 7);
    if ((bytes[i] & mask) !== (base[i] & mask)) return false;
  }
  return true;
}

const r4 = (ip: string, prefix: number): Range => [v4(ip)!, prefix];
const r6 = (ip: string, prefix: number): Range => [v6(ip)!, prefix];

const BLOCKED_V4: Range[] = [
  r4("0.0.0.0", 8), // "this network"
  r4("10.0.0.0", 8), // private
  r4("100.64.0.0", 10), // carrier-grade NAT
  r4("127.0.0.0", 8), // this computer
  r4("169.254.0.0", 16), // link-local, cloud metadata
  r4("172.16.0.0", 12), // private
  r4("192.0.0.0", 24),
  r4("192.0.2.0", 24), // documentation
  r4("192.88.99.0", 24),
  r4("192.168.0.0", 16), // private (home Wi-Fi)
  r4("198.18.0.0", 15), // benchmarking
  r4("198.51.100.0", 24), // documentation
  r4("203.0.113.0", 24), // documentation
  r4("224.0.0.0", 4), // multicast
  r4("240.0.0.0", 4), // reserved, broadcast
];

const BLOCKED_V6: Range[] = [
  r6("::", 128), // unspecified
  r6("::1", 128), // this computer
  r6("fc00::", 7), // private
  r6("fe80::", 10), // link-local
  r6("fec0::", 10), // old site-local
  r6("ff00::", 8), // multicast
  r6("2001:db8::", 32), // documentation
  r6("64:ff9b::", 96), // IPv4 hidden inside IPv6
  r6("64:ff9b:1::", 48),
  r6("2002::", 16), // 6to4 (IPv4 inside)
  r6("2001::", 32), // Teredo (IPv4 inside)
  r6("100::", 64), // discard
];

const MAPPED_V4 = r6("::ffff:0.0.0.0", 96);

export function isIpAddress(text: string): boolean {
  return v4(text) !== null || v6(text) !== null;
}

/** true for anything we must never connect to. IPv4 inside IPv6 (::ffff:10.0.0.1) is checked too. */
export function isBlockedAddress(ip: string): boolean {
  const four = v4(ip);
  if (four) return BLOCKED_V4.some((r) => inRange(four, r));
  const six = v6(ip);
  if (!six) return true; // not an address at all: refuse
  if (inRange(six, MAPPED_V4)) return BLOCKED_V4.some((r) => inRange(six.slice(12), r));
  return BLOCKED_V6.some((r) => inRange(six, r));
}
