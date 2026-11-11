// Copyright (c) 2026 GrantVRP. All rights reserved. See LICENSE.

// npm run phone
//
// Starts the dev server and prints an https link (and a QR code of it) to open
// on a phone. Phones only allow the camera and GPS on https pages.
//
//   Main way: a Cloudflare quick tunnel -> trusted https://*.trycloudflare.com link.
//   Backup:   `npm run phone -- --https` (or automatic if cloudflared is missing)
//             uses Next's self-signed https on the laptop's Wi-Fi address.

import { spawn, spawnSync } from "node:child_process";
import dgram from "node:dgram";
import { existsSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const qrcode = require("qrcode-terminal");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
const isWindows = process.platform === "win32";
const forceHttps = process.argv.includes("--https");

const children = [];

// ---------- helpers ----------

function banner(lines) {
  const width = Math.max(...lines.map((l) => l.length)) + 4;
  const bar = "=".repeat(width);
  console.log(`\n${bar}`);
  for (const l of lines) console.log(`  ${l}`);
  console.log(`${bar}\n`);
}

function showQr(url) {
  qrcode.generate(url, { small: true }, (qr) => console.log(qr));
}

// Finds cloudflared on PATH or in the usual install folders.
function findCloudflared() {
  if (process.env.CLOUDFLARED_PATH && existsSync(process.env.CLOUDFLARED_PATH)) {
    return process.env.CLOUDFLARED_PATH;
  }
  const probe = spawnSync("cloudflared", ["--version"], { stdio: "ignore" });
  if (probe.status === 0) return "cloudflared";

  const candidates = [];
  if (isWindows) {
    const local = process.env.LOCALAPPDATA ?? "";
    candidates.push(
      "C:\\Program Files (x86)\\cloudflared\\cloudflared.exe",
      "C:\\Program Files\\cloudflared\\cloudflared.exe",
      path.join(local, "Microsoft", "WinGet", "Links", "cloudflared.exe"),
    );
    // winget sometimes installs into a versioned package folder instead.
    const pkgDir = path.join(local, "Microsoft", "WinGet", "Packages");
    if (existsSync(pkgDir)) {
      for (const d of readdirSync(pkgDir)) {
        if (d.startsWith("Cloudflare.cloudflared")) candidates.push(path.join(pkgDir, d, "cloudflared.exe"));
      }
    }
  } else {
    candidates.push("/opt/homebrew/bin/cloudflared", "/usr/local/bin/cloudflared", "/usr/bin/cloudflared");
  }
  return candidates.find((c) => existsSync(c)) ?? null;
}

// The laptop's Wi-Fi address. First ask the OS which address it would use to
// reach the internet ("connecting" a UDP socket sends no packets). If that
// fails, guess from adapter names, skipping virtual ones (VirtualBox, VPNs...).
async function lanAddress() {
  const private_ = /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/;
  const routed = await new Promise((resolve) => {
    const sock = dgram.createSocket("udp4");
    sock.on("error", () => resolve(null));
    sock.connect(53, "1.1.1.1", () => {
      const { address } = sock.address();
      sock.close();
      resolve(address);
    });
  });
  if (routed && private_.test(routed)) return routed;

  const skip = /vethernet|virtualbox|vmware|wsl|docker|hyper-v|loopback|tailscale|zerotier|vpn/i;
  const all = Object.entries(os.networkInterfaces()).flatMap(([name, list]) =>
    (list ?? []).filter((i) => i.family === "IPv4" && !i.internal).map((i) => ({ name, address: i.address })),
  );
  const real = all.filter((i) => !skip.test(i.name) && !i.address.startsWith("192.168.56."));
  const pick =
    real.find((i) => /wi-?fi|wlan|wireless|^en0$/i.test(i.name) && private_.test(i.address)) ??
    real.find((i) => private_.test(i.address)) ??
    real[0] ??
    all[0];
  return pick?.address ?? null;
}

function killAll() {
  for (const child of children) {
    if (child.exitCode !== null || !child.pid) continue;
    if (isWindows) {
      // Next starts its own worker processes; kill the whole tree.
      spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    } else {
      child.kill("SIGTERM");
    }
  }
}

process.on("SIGINT", () => {
  killAll();
  process.exit(0);
});
process.on("SIGTERM", () => {
  killAll();
  process.exit(0);
});
process.on("exit", killAll);

// Starts `next dev` and resolves with its local URL once it's ready.
function startNext(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [nextBin, "dev", ...args], {
      cwd: root,
      env: { ...process.env, FORCE_COLOR: "1" },
      stdio: ["inherit", "pipe", "pipe"],
    });
    children.push(child);

    let localUrl = null;
    let resolved = false;
    const onData = (buf) => {
      const text = buf.toString();
      process.stdout.write(text);
      // Strip colour codes before matching.
      const plain = text.replace(/\x1b\[[0-9;]*m/g, "");
      const m = plain.match(/Local:\s+(https?:\/\/\S+)/);
      if (m) localUrl = m[1];
      if (!resolved && localUrl && /Ready in|ready started|✓ Ready/i.test(plain)) {
        resolved = true;
        resolve(localUrl);
      }
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.on("exit", (code) => {
      if (!resolved) reject(new Error(`next dev exited with code ${code}`));
      else process.exit(code ?? 0);
    });
  });
}

// Starts a Cloudflare quick tunnel and resolves with its https link.
function startTunnel(cloudflared, localUrl) {
  return new Promise((resolve, reject) => {
    const child = spawn(cloudflared, ["tunnel", "--no-autoupdate", "--url", localUrl], {
      cwd: root,
      stdio: ["ignore", "pipe", "pipe"],
    });
    children.push(child);

    let found = false;
    const recent = [];
    const onData = (buf) => {
      const text = buf.toString();
      recent.push(text);
      if (recent.length > 20) recent.shift();
      const m = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
      if (m && !found) {
        found = true;
        resolve(m[0]);
      }
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.on("exit", (code) => {
      if (!found) reject(new Error(`cloudflared exited (${code}).\n${recent.join("")}`));
      else console.log("\n[phone] The tunnel stopped. Run npm run phone again for a new link.");
    });
  });
}

// ---------- main ----------

async function runTunnel(cloudflared) {
  const localUrl = await startNext([]);
  console.log("\n[phone] Starting the Cloudflare tunnel...");
  const publicUrl = await startTunnel(cloudflared, localUrl);
  banner([
    "Open this on your phone:",
    publicUrl,
    "",
    "It can take 10-20 seconds before the link starts working.",
    "The link changes every time you run npm run phone.",
  ]);
  showQr(publicUrl);
}

async function runHttpsBackup() {
  const ip = await lanAddress();
  if (!ip) {
    console.error("[phone] No Wi-Fi address found. Is the laptop on Wi-Fi?");
    process.exit(1);
  }
  console.log(
    "\n[phone] Using the backup: self-signed https on your Wi-Fi.\n" +
      "        The first time, Windows or macOS asks to trust a local certificate. Click Yes.\n" +
      "        Windows may also ask to let Node.js through the firewall. Allow it on private networks.\n",
  );
  const localUrl = await startNext(["--experimental-https", "-H", ip]);
  const port = new URL(localUrl).port || "3000";
  const phoneUrl = `https://${ip}:${port}`;
  banner([
    "Open this on your phone (same Wi-Fi as the laptop):",
    phoneUrl,
    "",
    "Your phone will warn about the certificate:",
    "  Android Chrome: Advanced -> Proceed",
    "  iPhone Safari:  Show Details -> visit this website",
    "See README for how to remove the warning.",
  ]);
  showQr(phoneUrl);
}

const cloudflared = forceHttps ? null : findCloudflared();
if (!forceHttps && !cloudflared) {
  console.log(
    "\n[phone] cloudflared isn't installed, so using the Wi-Fi backup instead.\n" +
      "        For the main way, install it and run npm run phone again:\n" +
      "          Windows: winget install --id Cloudflare.cloudflared\n" +
      "          Mac:     brew install cloudflared",
  );
}

(cloudflared ? runTunnel(cloudflared) : runHttpsBackup()).catch((err) => {
  console.error(`\n[phone] ${err.message}`);
  killAll();
  process.exit(1);
});
