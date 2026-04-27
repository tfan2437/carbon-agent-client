import type { ReactNode } from "react";
import "@fontsource-variable/inter";
import "@fontsource/geist-mono/400.css";
import "@fontsource/geist-mono/500.css";
import "@/components/engram/tokens.css";

export default function DemoLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
