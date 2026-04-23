import { NextResponse } from "next/server";
import { z } from "zod";
import { getBackendIdToken } from "@/lib/ghg-auth";

const bodySchema = z.object({
  project_id: z.string().uuid(),
  document_ids: z.array(z.string().uuid()).min(1),
  reporting_year: z.number().int().min(2000).max(2100).optional(),
  company_id: z.string().min(1).optional(),
});

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 422 },
    );
  }
  const { project_id, document_ids, reporting_year, company_id } = parsed.data;

  const backendUrl = process.env.BACKEND_API_URL;
  const backendToken = process.env.BACKEND_API_TOKEN;
  if (!backendUrl || !backendToken) {
    return NextResponse.json(
      {
        error:
          "Backend is not configured. Set BACKEND_API_URL and BACKEND_API_TOKEN.",
      },
      { status: 500 },
    );
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-api-token": backendToken,
  };

  // Cloud Run --no-allow-unauthenticated requires a Google IAM bearer
  // too. If Google auth isn't available (local dev against an open
  // deployment, or ADC not set up), proceed with x-api-token only.
  const idToken = await getBackendIdToken();
  if (idToken) {
    headers["Authorization"] = `Bearer ${idToken}`;
  }

  const upstream = await fetch(
    `${backendUrl.replace(/\/$/, "")}/v1/projects/${project_id}/jobs`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ document_ids, reporting_year, company_id }),
      cache: "no-store",
    },
  );

  const text = await upstream.text();
  let payload: unknown = text;
  try {
    payload = JSON.parse(text);
  } catch {
    // upstream returned non-JSON; bubble the raw text up as error
  }

  return NextResponse.json(payload, { status: upstream.status });
}
