# Meter Check

**Is this parking code real? Check before you pay.**

Built for HackTrent 2026. Live at **https://metercheck.ca** (open it on a phone).

## The problem

Scammers stick fake QR codes on parking machines and signs. You scan one, it opens a page that looks like the real parking app, and you type in your card details. Several Ontario towns have warned drivers about fake parking codes and texts. A scam page and the real one look almost the same, so these scams are hard to spot, especially for older drivers.

## What Meter Check does

1. **Scan the parking code** with the phone camera. Meter Check reads the code but **never opens it**.
2. **It checks where the code really goes.** For each of **125 Ontario cities, towns and parks** we list the companies that really take parking payments there (26 companies, such as HotSpot, HONK, PayByPhone, Green P and Passport) and the web addresses they own. Only a code that goes to one of those addresses can be called safe.
3. **One plain answer**, in big words, read out loud:

   | Answer | Colour | When |
   |---|---|---|
   | **Safe to pay.** | Green | The code goes to the real parking company for this town, and every check passed. |
   | **Sketchy link. Don't pay.** / **Fake link** | Red | The address isn't on this town's list, looks like a copy of a real company's name, is flagged as dangerous, or the town never puts codes on its machines. |
   | **Wrong town? Don't pay yet.** | Grey | A real company's code, but not one this town uses. The code is in the wrong place, or the phone's location is wrong. |
   | **Not sure. Pay another way.** | Yellow | Anything we can't confirm, such as a town's own website or a place we don't check yet. |

4. **A safe way forward from every answer:**
   - **Go to the real site:** the address comes from our own list, never from the scanned code.
   - **Pay without scanning:** opens the town's official parking app. You type the zone number from the sign there.
   - **Call for help:** someone you trust (saved in Settings), the town's own by-law or parking office, the Canadian Anti-Fraud Centre, or your bank.
5. **Report it.** A fake code goes on a shared map (`/map`), so people nearby are warned. The map can export the fake sites as a CSV file for towns, banks and the Canadian Anti-Fraud Centre.

It is designed for seniors:
- big text and strong contrast
- one big button on the home screen
- the answer read out loud
- no account and no sign-up
- it finds your town by GPS, or you pick it by hand

## Try it

1. On a laptop, open **https://metercheck.ca/demo**. It shows our demo codes and what Meter Check should say for each one: a real sign, a look-alike, a sticker, a code from another town, an unknown website and a town's own page.
2. On a phone, open **https://metercheck.ca**, tap **Check a parking code**, and point the camera at a code on the laptop screen.
3. Indoors, GPS may put you somewhere else. Tap the place at the top of the home screen and pick **Downtown Peterborough** (each demo code also says which place to pick).

## How a code is checked

The phone reads the code and sends it, with the location, to `POST /api/check`. The server then runs these steps.

1. **Place** (`src/lib/checks/place.ts`): which town you are in. Near a town border, a real code from the town next door gets the grey answer, never green.
2. **Link** (`src/lib/checks/lookalike.ts`, `src/lib/server/`) checks:
   - whether the address belongs to a company this town really uses
   - how close it is to a real company's name (a look-alike)
   - how old the website is (RDAP)
   - Google Safe Browsing, when a key is set
   - redirects, followed with `HEAD` requests only (at most 3, 3 seconds each)
3. **Answer** (`src/lib/checks/verdict.ts`): one pure function that turns the facts into the answer, with tests.

The town and company lists are in `src/data/registry.json` and `src/data/providers.json`. They were gathered from each town's and company's own web pages in November 2026. Only facts marked `confirmed` or `likely` are used. Shared payment services (such as Paymentus or Jotform) count only at a town's exact address.

## Safety and privacy

- **Scanned codes are never opened.** Not by the phone, and not as a link on the page. Fake addresses are always shown with `[.]` (for example `fake-parking[.]com`), so they can't be tapped.
- **The server can only reach the public internet.** Private and local network addresses are refused (`global_fetch_strictly_public`). It only sends `HEAD` requests, with short time limits.
- **Reports are checked again on the server** before they are saved, so nobody can put a real company on the map. The location is rounded to about 10 m.
- **No accounts and no tracking.** Settings (your place, the person to call) stay on the phone.
- **No keys in the browser.** Server keys are Cloudflare secrets, never in the code.
- **The owner page** (`/owner`, a map of every report, for passing them on to the authorities) is protected:
  - a password stored as a server secret
  - a signed, HttpOnly cookie
  - a limit of 5 wrong tries per 15 minutes

## Built with

Next.js 16, React 19, TypeScript, Cloudflare Workers (OpenNext), Cloudflare D1, Leaflet with OpenStreetMap, jsQR, Vitest (257 tests).

## Run it yourself

You need Node.js 20 or newer.

```bash
npm install
cp .env.example .env.local   # demo mode is on by default
npm run dev                  # http://localhost:3000 (the camera works on localhost)
npm test                     # the checks, the town look-up and the report map
```

To put your own copy on Cloudflare:

```bash
npx wrangler login
npx wrangler d1 create meter-check-reports      # put the database ID it prints into wrangler.jsonc
npx wrangler d1 migrations apply meter-check-reports --remote
npm run deploy
```

## Project layout

| Path | What it is |
|---|---|
| `src/app/` | The screens: home, scan, answer, pay, help, map, settings, demo |
| `src/app/api/` | The server: check a code, save a report, owner sign-in |
| `src/lib/checks/` | The checking rules and their tests |
| `src/lib/server/` | Safe look-ups: redirects, website age, Safe Browsing, the report database |
| `src/data/` | The towns, the companies and their real web addresses |
| `migrations/` | The report database tables |

## Limits

- Meter Check checks where a code goes. It doesn't check the sign itself, and it never says it did.
- A website can't open another company's app directly unless that company sets it up, so "Pay without scanning" opens the app's store page, which has an Open button.
- Some towns aren't fully researched yet. A few addresses aren't published (for example Fort Erie's beach codes), so those codes get a careful answer rather than "safe".
