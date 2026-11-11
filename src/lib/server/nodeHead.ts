// Copyright (c) 2026 Grant Patel. All rights reserved. See LICENSE.

// One HEAD request on the laptop (Node). Checks the real network address at
// connect time, so a website name can't secretly point us at a private address.

import "server-only";
import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import type net from "node:net";
import { isBlockedAddress } from "./ipRanges";
import { USER_AGENT, type HeadFn } from "./safeHead";

class RefusedError extends Error {
  code = "EREFUSED_ADDRESS";
}

/** DNS lookup that refuses names pointing at private or local addresses. */
const safeLookup: net.LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { all: true, verbatim: true }, (err, addresses) => {
    if (err) return callback(err, "", 0);
    if (!addresses.length || addresses.some((a) => isBlockedAddress(a.address))) {
      return callback(new RefusedError(`${hostname} points to a private or local address`), "", 0);
    }
    if (options.all) {
      (callback as unknown as (e: null, list: dns.LookupAddress[]) => void)(null, addresses);
    } else {
      callback(null, addresses[0].address, addresses[0].family);
    }
  });
};

/** One HEAD request. No cookies, no body, closed after the headers arrive. */
export const nodeHead: HeadFn = (url, timeoutMs) =>
  new Promise((resolve, reject) => {
    const lib = url.protocol === "https:" ? https : http;
    const req = lib.request(
      url,
      {
        method: "HEAD",
        lookup: safeLookup,
        agent: false, // a fresh connection every time: nothing shared or kept
        headers: { "user-agent": USER_AGENT, accept: "*/*" },
      },
      (res) => {
        resolve({ status: res.statusCode ?? 0, location: typeof res.headers.location === "string" ? res.headers.location : null });
        res.resume();
        req.destroy();
      },
    );
    const timer = setTimeout(() => req.destroy(Object.assign(new Error("timed out"), { code: "ETIMEDOUT" })), timeoutMs);
    req.on("error", reject);
    req.on("close", () => clearTimeout(timer));
    req.end();
  });
