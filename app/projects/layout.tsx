import Link from "next/link";
import type { ReactNode } from "react";
import { GraphCacheProvider } from "@/components/projects/graph-cache-context";

export default function ProjectsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen text-foreground">
      <header className="border-b border-border/50">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <Link href="/projects" className="text-sm font-semibold tracking-tight">
            LingCarbon GHG
          </Link>
          <Link
            href="/demo"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Graph demo →
          </Link>
        </div>
      </header>
      <GraphCacheProvider>{children}</GraphCacheProvider>
    </div>
  );
}
