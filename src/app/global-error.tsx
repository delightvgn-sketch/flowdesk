"use client";

/** Last-resort boundary when the root layout itself fails. Must render its own <html>. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          display: "grid",
          placeItems: "center",
          minHeight: "100vh",
          margin: 0,
          background: "#fbfaf8",
          color: "#2a2622",
        }}
      >
        <div style={{ textAlign: "center", maxWidth: 420, padding: 24 }}>
          <h1 style={{ fontSize: 22, marginBottom: 8 }}>FlowDesk ran into a problem</h1>
          <p style={{ color: "#76706a", marginBottom: 20 }}>
            Please try again. If it keeps happening, come back in a few minutes.
          </p>
          <button
            onClick={reset}
            style={{ background: "#1f6f68", color: "white", border: 0, borderRadius: 8, padding: "10px 16px", cursor: "pointer" }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
