// Copyright (c) 2026 Grant Patel. All rights reserved. See LICENSE.

import type { Metadata } from "next";

// The owner area is private: keep it out of search engines.
export const metadata: Metadata = {
  title: "Owner · Meter Check",
  robots: { index: false, follow: false },
};

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
