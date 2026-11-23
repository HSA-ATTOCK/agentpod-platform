"use client";

/** Last-resort error page if the whole app shell fails. It has to bring its own <html> and styles. */
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a0a",
          color: "#fafafa",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
          padding: 16,
        }}
      >
        <title>Something went wrong · Baba</title>
        <div>
          <h1 style={{ fontSize: 24, marginBottom: 8 }}>Something went wrong</h1>
          <p style={{ color: "#a1a1aa", marginBottom: 24 }}>Baba couldn&apos;t load. Please try again in a moment.</p>
          <button
            type="button"
            onClick={() => retry()}
            style={{ background: "#a3e635", color: "#0a0a0a", border: 0, borderRadius: 10, padding: "10px 18px", fontWeight: 600, cursor: "pointer" }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
