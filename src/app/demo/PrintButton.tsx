// Copyright (c) 2026 Grant Patel. All rights reserved. See LICENSE.

"use client";

export function PrintButton({ className }: { className?: string }) {
  return (
    <button type="button" className={className} onClick={() => window.print()}>
      Print
    </button>
  );
}
