// Copyright (c) 2026 Grant Patel. All rights reserved. See LICENSE.

// One HEAD request on Cloudflare. Cloudflare itself refuses to connect to private
// networks (the "global_fetch_strictly_public" setting in wrangler.jsonc), and
// refusal() in safeHead.ts has already turned away private addresses typed in the code.

import "server-only";
import { USER_AGENT, type HeadFn } from "./safeHead";

export const fetchHead: HeadFn = async (url, timeoutMs) => {
  const res = await fetch(url, {
    method: "HEAD",
    redirect: "manual", // we follow redirects ourselves, one checked step at a time
    credentials: "omit",
    headers: { "user-agent": USER_AGENT, accept: "*/*" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  // Don't keep the connection busy: we only wanted the headers.
  await res.body?.cancel().catch(() => {});
  return { status: res.status, location: res.headers.get("location") };
};
