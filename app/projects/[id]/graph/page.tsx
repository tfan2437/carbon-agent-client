import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import type { GHGGraphData } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { GraphViewClient } from "@/components/projects/graph-view-client";

export const dynamic = "force-dynamic";

export default async function ProjectGraphPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: graphRow } = await supabase
    .from("graphs")
    .select("graph_json, job_id, built_at")
    .eq("project_id", id)
    .order("built_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!graphRow) {
    return (
      <main className="container mx-auto max-w-3xl px-6 py-16 space-y-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/projects/${id}`}>
            <ArrowLeft aria-hidden />
            Back to project
          </Link>
        </Button>
        <div className="rounded-lg border bg-card px-6 py-12 text-center space-y-2">
          <h1 className="text-xl font-semibold">No graph yet</h1>
          <p className="text-sm text-muted-foreground">
            Finish a successful processing job on this project first — the graph
            is written once the backend completes extraction.
          </p>
        </div>
      </main>
    );
  }

  // graph_json is stored as Supabase Json (our hand-written type); we know
  // the backend writes the GHGGraphData shape documented in docs/integration.md.
  const data = graphRow.graph_json as unknown as GHGGraphData;
  if (!data || typeof data !== "object") notFound();

  return <GraphViewClient data={data} />;
}
