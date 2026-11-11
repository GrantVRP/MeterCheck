// Copyright (c) 2026 Grant Patel. All rights reserved. See LICENSE.

import type { Verdict } from "@/lib/types";
import { CheckIcon, HandIcon, QuestionIcon } from "./Icons";
import styles from "./SymbolCircle.module.css";

const ICONS = { stop: HandIcon, unsure: QuestionIcon, safe: CheckIcon, "wrong-town": QuestionIcon } as const;

/** The verdict symbol in a white circle, like a road sign. */
export function SymbolCircle({ verdict, small = false }: { verdict: Verdict; small?: boolean }) {
  const Icon = ICONS[verdict];
  return (
    <span className={`${styles.circle} ${styles[verdict]} ${small ? styles.small : ""}`} aria-hidden="true">
      <Icon className={styles.icon} />
    </span>
  );
}
