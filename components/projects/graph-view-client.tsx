"use client";

import dynamic from "next/dynamic";
import type { GHGGraphData } from "@/lib/types";

const GHGGraph = dynamic(() => import("@/components/ghg-graph"), {
  ssr: false,
  loading: () => (
    <div
      className="w-full h-screen flex items-center justify-center"
      style={{ backgroundColor: "#0B0E14" }}
    >
      <div className="text-gray-400 text-sm">Loading graph...</div>
    </div>
  ),
});

export interface GraphViewClientProps {
  data: GHGGraphData;
}

export function GraphViewClient({ data }: GraphViewClientProps) {
  return <GHGGraph initialData={data} />;
}
