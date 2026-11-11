// Copyright (c) 2026 GrantVRP. All rights reserved. See LICENSE.

"use client";

import { useFlow, useSettings } from "./store";
import { townFrom, type Town } from "./where";

/** The town the current screen is about. See townFrom. */
export function useTown(opts: { ignoreResult?: boolean } = {}): Town {
  const { result, spot, fix } = useFlow();
  const { useGps, placeId } = useSettings();
  return townFrom({ result, spot, fix, useGps, placeId, ignoreResult: opts.ignoreResult });
}
