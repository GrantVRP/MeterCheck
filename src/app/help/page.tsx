// Copyright (c) 2026 GrantVRP. All rights reserved. See LICENSE.

"use client";

import { PhoneIcon } from "@/components/Icons";
import { TopBar } from "@/components/TopBar";
import { telFromInput, toContacts } from "@/lib/contacts";
import { useFlow, useHydrated, useSettings } from "@/lib/store";
import { useTown } from "@/lib/useTown";
import { helpContacts } from "@/lib/where";
import styles from "./page.module.css";

export default function Help() {
  const hydrated = useHydrated();
  const settings = useSettings();
  const { result } = useFlow();
  // The town of the last check (or where you are now), never another town's numbers.
  const contacts = toContacts(helpContacts(useTown()));
  const trustedTel = telFromInput(settings.trustedPhone);
  const trustedName = settings.trustedName.trim();

  return (
    <main className="page">
      <TopBar href={result ? "/verdict" : "/"} />
      <h1>Call for help</h1>

      <p className={`panel panel-yellow ${styles.paid}`}>Already paid through it? Call your bank first.</p>

      <div className="btn-stack">
        {hydrated && trustedName && trustedTel && (
          <a href={`tel:${trustedTel}`} className={`btn btn-primary ${styles.call}`}>
            <PhoneIcon className={styles.icon} />
            <span className={styles.text}>
              <span className={styles.who}>{trustedName}</span>
              <span>Your trusted person</span>
            </span>
          </a>
        )}

        {contacts.map((c) =>
          c.calls.length ? (
            c.calls.map((call) => (
              <a key={c.who + call.tel} href={`tel:${call.tel}`} className={`btn btn-primary ${styles.call}`}>
                <PhoneIcon className={styles.icon} />
                <span className={styles.text}>
                  <span className={styles.who}>{c.who}</span>
                  <span>{call.label}</span>
                </span>
              </a>
            ))
          ) : (
            <div key={c.who} className={`panel ${styles.note}`}>
              <strong>{c.who}</strong>
              <span>{c.isBank ? "Call the number on the back of your card." : noteText(c.who, c.note)}</span>
            </div>
          ),
        )}
      </div>
    </main>
  );
}

function noteText(who: string, note: string | null): string {
  if (/police/i.test(who)) return "Takes fraud reports in person at a police station.";
  return note ?? "";
}
