// lib/pii.ts — PII masking helpers + URL gate
//
// The graph build pipeline masks PII at write time (vehicle plates → "VFH-***",
// driver_name / driver_id / employee_name → null). These helpers handle the
// runtime side: a URL gate (`?pii=1`) that allows an authorized viewer to
// toggle un-masking, and small formatting helpers used inside detail tabs.

'use client';

import type { ReadonlyURLSearchParams } from 'next/navigation';

const PII_QUERY_KEY = 'pii';
const PII_ENABLED_VALUE = '1';

/** True iff URL has `?pii=1` — the gate that surfaces the unmask toggle. */
export function isPiiUnlocked(params: URLSearchParams | ReadonlyURLSearchParams | null): boolean {
  if (!params) return false;
  return params.get(PII_QUERY_KEY) === PII_ENABLED_VALUE;
}

/** Mask a vehicle plate to "first 3 chars + '-***'" (mirrors Python). */
export function maskPlate(plate: string | null | undefined): string | null {
  if (plate == null) return null;
  const s = String(plate);
  if (s.length === 0) return s;
  if (s.length <= 3) return `${s}-***`;
  return `${s.slice(0, 3)}-***`;
}

/** Mask a person name — used when the build script left names intact but
 * the UI is rendering in a masked context (rare; build masks by default). */
export function maskName(name: string | null | undefined): string {
  if (!name) return '—';
  const s = String(name).trim();
  if (s.length === 0) return '—';
  return `${s.charAt(0)}**`;
}

/** Mask a national ID / employee ID — keep first 2 + last 1, redact middle. */
export function maskId(id: string | null | undefined): string | null {
  if (!id) return null;
  const s = String(id);
  if (s.length <= 3) return `${s.charAt(0)}**`;
  return `${s.slice(0, 2)}***${s.slice(-1)}`;
}
