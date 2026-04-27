import type { ReactNode } from "react";
import "@fontsource-variable/inter";
import "@fontsource/geist-mono/400.css";
import "@fontsource/geist-mono/500.css";
import "@/components/engram/tokens.css";
import { GraphCacheProvider } from "@/components/projects/graph-cache-context";

export default function ProjectsLayout({ children }: { children: ReactNode }) {
  return <GraphCacheProvider>{children}</GraphCacheProvider>;
}
