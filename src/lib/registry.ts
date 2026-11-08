// Typed access to the city registry (src/data/registry.json).
// The registry is the source of truth. Anything marked SAMPLE is a demo placeholder.

import raw from "@/data/registry.json";
import { getProvider, PROVIDERS, providerAddresses } from "@/lib/providers";

export type Confidence = "confirmed" | "likely" | "unverified";

export interface Operator {
  name: string;
  /** The provider's id in providers.json. Its web addresses are used unless allowed_qr_hosts is given. */
  provider?: string;
  /** e.g. "on-street", "municipal lots", "beach". */
  role?: string;
  /** pay: takes parking payments. tickets / permits: only a ticket or permit page (allowed, but not named as the parking service). */
  kind?: "pay" | "tickets" | "permits";
  confidence?: Confidence;
  company_site?: string;
  /** The town's own "pay here" web page, when the company has no public site (e.g. ajax.ca/parkandpay). */
  pay_site?: string;
  /** If given, only these addresses count for this city (e.g. [] for "no codes at all"). */
  allowed_qr_hosts?: string[];
  official_hosts?: string[];
  areas?: string[];
  zone_format?: string;
  app_ios?: string;
  app_android?: string;
  support_phone?: string;
  phone?: string;
}

export interface ReportContact {
  who: string;
  phone: string;
}

export interface DemoZone {
  zone: string;
  label: string;
  lat: number;
  lon: number;
  /** The exact address on this zone's real sign, or "TODO_CONFIRM" until someone decodes one. */
  expected_url?: string;
  expected_url_SAMPLE?: string;
}

/** A private or institutional car park (hospital, college, garage) and who runs its payments. */
export interface PrivateOperator {
  site: string;
  provider: string;
  confidence?: Confidence;
  source?: string;
}

export interface City {
  id: string;
  name: string;
  province: string;
  /** true: Meter Check checks codes here. false: data kept, but switched off. */
  live?: boolean;
  uses_qr_payment: boolean;
  /** true: the town doesn't charge for street parking, so its own signs have no payment codes. */
  free_parking?: boolean;
  /** false: the town's signs have no zone numbers (pay by plate, or online), so we never ask for one. */
  zone_numbers?: boolean;
  /** What to tell people about paying here, in place of the general "pay at the machine". */
  pay_note?: { headline: string; detail: string };
  official_page: string;
  /** Exact addresses decoded from this town's real signs. Used to name the town when its code turns up elsewhere. */
  known_codes?: string[];
  /** Other websites the town itself runs (e.g. a ticket page on its own name). Never a parking company's. */
  city_domains?: string[];
  /**
   * Rough area for finding the city from GPS. Not the official boundary.
   * Either an outline, or a circle around the centre.
   */
  area_APPROX?: {
    polygon?: [number, number][];
    center?: [number, number];
    radius_km?: number;
    /** Several circles for long or odd-shaped places: [lat, lon, radius in km]. */
    circles?: [number, number, number][];
  };
  official_methods: string[];
  city_statement?: string;
  operators: Operator[];
  private_operators?: PrivateOperator[];
  demo_zones_SAMPLE: DemoZone[];
  report_to: ReportContact[];
}

export const registry = raw as unknown as { version: string; cities: City[] };

/** Cities Meter Check checks right now ("live": true in the registry). */
export const LIVE_CITY_IDS: readonly string[] = registry.cities.filter((c) => c.live).map((c) => c.id);

/** "Peterborough", or "Peterborough and Mississauga" once there are more. */
export function liveCityNames(): string {
  const names = LIVE_CITY_IDS.map((id) => getCity(id)?.name).filter(Boolean) as string[];
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : (names[0] ?? "");
}

/** What to call a place outside every city we check. */
export function outsideLabel(): string {
  return LIVE_CITY_IDS.length <= 3 ? `Outside ${liveCityNames()}` : "Somewhere we don't check yet";
}

/** One line on where Meter Check works, for the place picker. */
export function coverageNote(): string {
  return LIVE_CITY_IDS.length <= 3
    ? `Meter Check checks parking codes in ${liveCityNames()} for now.`
    : `Meter Check checks parking codes in ${LIVE_CITY_IDS.length} Ontario cities and towns.`;
}

/** One sentence on where Meter Check works, for places it doesn't know yet. */
export function coverageSentence(): string {
  return LIVE_CITY_IDS.length <= 3
    ? `Meter Check only checks parking codes in ${liveCityNames()} for now.`
    : "Meter Check doesn't know the parking here yet.";
}

const trusted = (c: Confidence | undefined) => c !== "unverified";

/** Government park services (Ontario Parks, Parks Canada): real everywhere in Ontario. */
const EVERYWHERE = PROVIDERS.filter((p) => p.everywhere);

/** The web addresses one operator really uses in this city. */
function operatorHosts(o: Operator): string[] {
  if (o.allowed_qr_hosts) return o.allowed_qr_hosts;
  const p = getProvider(o.provider ?? o.name);
  return p ? providerAddresses(p) : [];
}

/** Every address a real parking code in this city may go to: the city's own providers and trusted private car parks. */
export function cityAddresses(city: City): string[] {
  const hosts = [
    ...city.operators.filter((o) => trusted(o.confidence)).flatMap(operatorHosts),
    ...(city.private_operators ?? [])
      .filter((o) => trusted(o.confidence))
      .flatMap((o) => {
        const p = getProvider(o.provider);
        return p ? providerAddresses(p) : [];
      }),
    ...EVERYWHERE.flatMap(providerAddresses),
  ];
  return [...new Set(hosts.map((h) => h.toLowerCase()))];
}

/** Takes parking payments (not only a ticket or permit page). */
export function isPayOperator(o: Operator): boolean {
  return o.kind ? o.kind === "pay" : !/ticket|permit/i.test(o.role ?? "");
}

/** The companies that run the city's own parking, e.g. ["HotSpot"]. Named in sentences. */
export function cityCompanies(city: City): string[] {
  return [
    ...new Set(
      city.operators
        // Ticket and permit pages are allowed, but not named as "the parking service".
        .filter((o) => trusted(o.confidence) && operatorHosts(o).length > 0 && isPayOperator(o))
        .map((o) => getProvider(o.provider ?? o.name)?.name ?? o.name),
    ),
  ];
}

/** Every company whose parking codes are real somewhere in this city: its own and trusted private car parks. */
export function cityPayCompanies(city: City): string[] {
  const priv = (city.private_operators ?? []).filter((o) => trusted(o.confidence)).map((o) => getProvider(o.provider)?.name);
  return [...new Set([...cityCompanies(city), ...priv].filter((n): n is string => Boolean(n)))];
}

/**
 * Does the town take parking payments through this company, even only in its app (e.g. PayByPhone in Ottawa)?
 * A company that only runs the town's ticket or permit page doesn't count.
 */
export function townUsesCompany(city: City | null, company: string): boolean {
  return Boolean(
    city?.operators.some(
      (o) => trusted(o.confidence) && isPayOperator(o) && (getProvider(o.provider ?? o.name)?.name ?? o.name) === company,
    ),
  );
}

/** Towns we check where this company's parking codes are real, e.g. "HotSpot" -> Peterborough, Barrie... */
export function townsUsing(company: string): City[] {
  return registry.cities.filter((c) => c.live && cityPayCompanies(c).includes(company));
}

export function getCity(id: string | null | undefined): City | null {
  return registry.cities.find((c) => c.id === id) ?? null;
}

export function findZone(zone: string | null | undefined): { city: City; zone: DemoZone } | null {
  if (!zone) return null;
  for (const city of registry.cities) {
    const z = city.demo_zones_SAMPLE.find((d) => d.zone === zone);
    if (z) return { city, zone: z };
  }
  return null;
}

/** A zone's expected address, or null while it is still marked TODO_CONFIRM. */
export function confirmedExpectedUrl(zone: DemoZone | null | undefined): string | null {
  const url = zone?.expected_url;
  if (!url || url.includes("TODO_CONFIRM")) return null;
  try {
    return new URL(url).protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}
