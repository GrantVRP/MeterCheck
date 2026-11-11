// Copyright (c) 2026 Grant Patel. All rights reserved. See LICENSE.

// How Next.js is packaged for Cloudflare Workers (OpenNext).
// Pages are built ahead of time and never re-built later, so the read-only
// "static assets" cache is enough: no R2 bucket or KV store needed.
import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
});
