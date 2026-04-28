"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  type ReactNode,
} from "react";
import type { GHGGraphData } from "@/lib/types";

// Cache is keyed by (projectId, versionId) where versionId === null means
// "latest". The latest pointer is what the project-detail prefetch warms,
// and what the graph page falls back to when ?v= is absent. Specific
// version snapshots cache under their version uuid.
interface GraphCache {
  get(projectId: string, versionId: string | null): GHGGraphData | null;
  set(
    projectId: string,
    versionId: string | null,
    data: GHGGraphData,
  ): void;
}

function cacheKey(projectId: string, versionId: string | null): string {
  return `${projectId}:${versionId ?? "latest"}`;
}

const GraphCacheContext = createContext<GraphCache | null>(null);

export function GraphCacheProvider({ children }: { children: ReactNode }) {
  const mapRef = useRef<Map<string, GHGGraphData>>(new Map());

  const get = useCallback(
    (projectId: string, versionId: string | null) =>
      mapRef.current.get(cacheKey(projectId, versionId)) ?? null,
    [],
  );
  const set = useCallback(
    (projectId: string, versionId: string | null, data: GHGGraphData) => {
      mapRef.current.set(cacheKey(projectId, versionId), data);
    },
    [],
  );

  return (
    <GraphCacheContext.Provider value={{ get, set }}>
      {children}
    </GraphCacheContext.Provider>
  );
}

export function useGraphCache(): GraphCache {
  const ctx = useContext(GraphCacheContext);
  if (!ctx) {
    throw new Error("useGraphCache must be used inside <GraphCacheProvider>");
  }
  return ctx;
}
