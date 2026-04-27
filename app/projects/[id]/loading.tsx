import { Shell, PageHeader } from "@/components/engram/Shell";

// Mirrors the V6 layout (drop zone left, table right, sticky rail) so the
// page doesn't reflow when the real content arrives.
export default function Loading() {
  return (
    <Shell>
      <PageHeader crumbs={["Projects", "…"]} />

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            flex: 1,
            display: "grid",
            gridTemplateColumns: "360px 1fr",
            gap: 16,
            padding: "16px 20px 0",
            minHeight: 0,
          }}
        >
          <div
            style={{
              width: 360,
              height: "100%",
              borderRadius: 12,
              border: "1.5px dashed var(--border-3)",
              background:
                "linear-gradient(180deg, rgba(222,115,86,0.04), rgba(222,115,86,0.01))",
            }}
          />
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
              gap: 12,
            }}
          >
            <div style={{ height: 28 }} />
            <div
              className="card"
              style={{ flex: 1, minHeight: 0 }}
              aria-hidden
            />
            <div style={{ height: 30 }} />
          </div>
        </div>
        <div
          style={{
            flex: "0 0 auto",
            height: 64,
            borderTop: "1px solid var(--border)",
            background: "rgba(0,0,0,0.2)",
          }}
        />
      </div>
    </Shell>
  );
}
