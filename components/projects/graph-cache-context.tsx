"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  type ReactNode,
} from "react";
import type { GHGGraphData } from "@/lib/types";

interface GraphCache {
  get(projectId: string): GHGGraphData | null;
  set(projectId: string, data: GHGGraphData): void;
}

const GraphCacheContext = createContext<GraphCache | null>(null);

export function GraphCacheProvider({ children }: { children: ReactNode }) {
  const mapRef = useRef<Map<string, GHGGraphData>>(new Map());

  const get = useCallback(
    (projectId: string) => mapRef.current.get(projectId) ?? null,
    [],
  );
  const set = useCallback((projectId: string, data: GHGGraphData) => {
    mapRef.current.set(projectId, data);
  }, []);

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
