// Copyright (c) 2026 Grant Patel. All rights reserved. See LICENSE.

// Re-mounts on every navigation, so each screen gets the short fade-in.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="screen">{children}</div>;
}
