'use client';

// Small context that lets detail tabs read the unmask state without
// passing it through every prop chain. The state lives in <AnalyticsPanel>
// because the toggle button sits in the panel header.

import { createContext, useContext } from 'react';

interface PiiCtx {
  /** True iff the URL carries `?pii=1` — the gate that allows un-masking at all. */
  unlocked: boolean;
  /** True iff the user has currently flipped the toggle on (only meaningful when unlocked). */
  unmasked: boolean;
}

export const PiiContext = createContext<PiiCtx>({ unlocked: false, unmasked: false });
export const usePii = () => useContext(PiiContext);
