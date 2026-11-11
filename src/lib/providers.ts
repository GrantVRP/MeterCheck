// Copyright (c) 2026 Grant Patel. All rights reserved. See LICENSE.

// The parking companies we know (src/data/providers.json) and the web addresses
// each one really uses. Pure: used by the server and by the phone when offline.

import raw from "@/data/providers.json";
import { registrableDomain } from "@/lib/checks/address";

export interface Provider {
  id: string;
  name: string;
  /** The brand word a fake would borrow, e.g. "paybyphone". null if the name is too common to judge. */
  word: string | null;
  /** Where "Go to the real site" takes you. */
  website: string | null;
  /** Names the company owns outright: any address ending in one of these is theirs. */
  domains: string[];
  /** Exact addresses on shared services (e.g. a link service) that only this company uses. */
  hosts: string[];
  /** A government park service, real anywhere in Ontario (Ontario Parks, Parks Canada). */
  everywhere?: boolean;
  /** Found in research but not confirmed. Listed for review, never trusted. */
  unverified: unknown[];
  sources: string[];
}

const data = raw as unknown as { providers: Provider[]; safe_redirect_hosts: string[] };

export const PROVIDERS: Provider[] = data.providers.map((p) => ({
  ...p,
  domains: [...new Set(p.domains.map((d) => registrableDomain(d.toLowerCase())))],
  hosts: p.hosts.map((h) => h.toLowerCase()),
}));

/** App stores: fine to end up on after a real company's link, never fine as the code itself. */
export const SAFE_REDIRECT_HOSTS = new Set(data.safe_redirect_hosts.map((h) => h.toLowerCase()));

export function getProvider(idOrName: string | null | undefined): Provider | null {
  if (!idOrName) return null;
  const key = idOrName.toLowerCase();
  return PROVIDERS.find((p) => p.id === key || p.name.toLowerCase() === key) ?? null;
}

/** The company that owns this address, or null. Exact shared-service addresses first. */
export function providerOfHost(host: string): Provider | null {
  const h = host.toLowerCase().replace(/\.$/, "");
  return (
    PROVIDERS.find((p) => p.hosts.includes(h)) ?? PROVIDERS.find((p) => p.domains.includes(registrableDomain(h))) ?? null
  );
}

/** Every address a company uses, for a city's allowed list. */
export function providerAddresses(p: Provider): string[] {
  return [...p.domains, ...p.hosts];
}
