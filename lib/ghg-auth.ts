/**
 * Server-only helper for minting a Google-signed identity token so the
 * Next.js server can call the Cloud Run backend (deployed with
 * --no-allow-unauthenticated).
 *
 * Credentials are sourced in this order:
 *   1. GOOGLE_CREDENTIALS_JSON — full service-account JSON as a string
 *      (used on Vercel / other containerised envs with no filesystem)
 *   2. GOOGLE_APPLICATION_CREDENTIALS — path to a JSON key file
 *      (standard local-dev setup for ADC)
 *   3. Platform ADC — Cloud Run / GCE metadata server
 */

import { GoogleAuth } from "google-auth-library";

type TokenGetter = () => Promise<string>;

let cachedGetter: TokenGetter | null = null;

function loadGetter(): TokenGetter {
  if (cachedGetter) return cachedGetter;

  const target =
    process.env.BACKEND_API_URL ?? process.env.GHG_API_BASE_URL ?? "";
  if (!target) {
    throw new Error("BACKEND_API_URL is not set — cannot mint ID token");
  }

  const inlineJson = process.env.GOOGLE_CREDENTIALS_JSON;
  const credentials = inlineJson
    ? (JSON.parse(inlineJson) as Record<string, unknown>)
    : undefined;
  const auth = new GoogleAuth(credentials ? { credentials } : undefined);

  cachedGetter = async () => {
    const client = await auth.getIdTokenClient(target);
    const headers = await client.getRequestHeaders();
    let authz: string | null | undefined = null;
    if (headers instanceof Headers) {
      authz = headers.get("Authorization");
    } else {
      authz =
        headers["Authorization"] ??
        (headers as Record<string, string>)["authorization"];
    }
    if (!authz) {
      throw new Error("ID token client returned no Authorization header");
    }
    return authz.replace(/^Bearer /, "");
  };
  return cachedGetter;
}

export async function getBackendIdToken(): Promise<string | null> {
  if (process.env.GHG_SKIP_GOOGLE_AUTH === "1") return null;
  try {
    const getter = loadGetter();
    return await getter();
  } catch (err) {
    console.error("[ghg-auth] getBackendIdToken failed:", err);
    return null;
  }
}
