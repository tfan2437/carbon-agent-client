/**
 * Server-only helper for minting a Google-signed identity token so the
 * Next.js server can call the Cloud Run backend (deployed with
 * --no-allow-unauthenticated). See frontend-integration.md §2.
 *
 * `google-auth-library` is an optional peer dep — we load it lazily and
 * swallow import errors so `pnpm build` works even before it's
 * installed. If minting fails the caller can fall back to
 * x-api-token-only (tolerated while the backend still allows
 * unauthenticated invocations during Phase 2 dev).
 */

type TokenGetter = () => Promise<string>;

let cachedGetter: TokenGetter | null = null;

async function loadGetter(): Promise<TokenGetter> {
  if (cachedGetter) return cachedGetter;

  const target =
    process.env.BACKEND_API_URL ?? process.env.GHG_API_BASE_URL ?? "";
  if (!target) {
    throw new Error("BACKEND_API_URL is not set — cannot mint ID token");
  }

  const mod = (await (
    new Function("m", "return import(m)") as (m: string) => Promise<unknown>
  )("google-auth-library").catch(() => null)) as
    | {
        GoogleAuth: new (opts?: {
          credentials?: Record<string, unknown>;
        }) => {
          getIdTokenClient(
            url: string,
          ): Promise<{
            getRequestHeaders(): Promise<Headers | Record<string, string>>;
          }>;
        };
      }
    | null;

  if (!mod) {
    throw new Error(
      "google-auth-library is not installed — add it or set GHG_SKIP_GOOGLE_AUTH=1",
    );
  }

  // Prefer inline JSON (Vercel / containerised envs) over a file path
  // (local dev via GOOGLE_APPLICATION_CREDENTIALS). If neither is set,
  // google-auth-library falls back to platform ADC (GCE/Cloud Run metadata).
  const inlineJson = process.env.GOOGLE_CREDENTIALS_JSON;
  const credentials = inlineJson
    ? (JSON.parse(inlineJson) as Record<string, unknown>)
    : undefined;
  const auth = new mod.GoogleAuth(credentials ? { credentials } : undefined);
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
    const getter = await loadGetter();
    return await getter();
  } catch {
    return null;
  }
}
