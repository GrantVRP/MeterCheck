// Copyright (c) 2026 Grant Patel. All rights reserved. See LICENSE.

import { describe, expect, it } from "vitest";
import { telFromInput, toCalls, toContacts } from "./contacts";
import { getCity } from "./registry";

describe("toCalls", () => {
  it("reads a toll-free number", () => {
    expect(toCalls("1-888-495-8501")).toEqual([{ label: "1-888-495-8501", tel: "+18884958501" }]);
  });

  it("dials an extension after a pause", () => {
    expect(toCalls("705-742-7777 ext. 2802")).toEqual([{ label: "705-742-7777 ext. 2802", tel: "+17057427777,2802" }]);
  });

  it("splits 311 and the outside-the-city number", () => {
    expect(toCalls("311 (905-615-4311 outside city limits)")).toEqual([
      { label: "311", tel: "311" },
      { label: "905-615-4311 (outside city limits)", tel: "+19056154311" },
    ]);
  });

  it("finds nothing in plain instructions", () => {
    expect(toCalls("Number on the back of your card")).toEqual([]);
  });
});

describe("toContacts", () => {
  it("puts in-person-only Peel Police after the callable ones in Mississauga", () => {
    const contacts = toContacts(getCity("mississauga-on")!.report_to);
    expect(contacts.map((c) => c.who)).toEqual([
      "City of Mississauga",
      "Your bank or card company",
      "Canadian Anti-Fraud Centre",
      "Peel Regional Police",
    ]);
    expect(contacts[1].note).toBe("Number on the back of your card");
    expect(contacts[3].calls).toEqual([]);
  });

  it("gives every Peterborough contact except the bank a number", () => {
    const contacts = toContacts(getCity("peterborough-on")!.report_to);
    expect(contacts.filter((c) => c.calls.length).map((c) => c.who)).toEqual([
      "City of Peterborough Parking Services",
      "HotSpot support",
      "Canadian Anti-Fraud Centre",
    ]);
  });
});

describe("telFromInput", () => {
  it("adds +1 to a 10-digit number", () => {
    expect(telFromInput("(705) 555-1234")).toBe("+17055551234");
  });
  it("rejects junk", () => {
    expect(telFromInput("hi")).toBeNull();
  });
});
