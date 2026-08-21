"use client";

/**
 * R1c: the last-resort boundary — replaces Next's unbranded white screen when the root
 * layout itself throws. Must render its own <html>/<body>; styles are inline because
 * global CSS may not have survived whatever broke.
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#fbfcfe",
          color: "#16202c",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div style={{ textAlign: "center", padding: "24px", maxWidth: "26rem" }}>
          <p style={{ fontSize: "14px", letterSpacing: "0.14em", textTransform: "uppercase", color: "#5c6b80" }}>
            Vantera
          </p>
          <h1 style={{ fontSize: "22px", margin: "12px 0 8px" }}>Something broke on our side.</h1>
          <p style={{ fontSize: "14px", color: "#5c6b80", lineHeight: 1.6 }}>
            Your data is safe and your agents keep running. Try again — if it keeps happening,
            email support@vanterasystem.com.
          </p>
          <button
            onClick={() => reset()}
            style={{
              marginTop: "18px",
              padding: "10px 22px",
              borderRadius: "10px",
              border: "1px solid #16202c",
              background: "#16202c",
              color: "#fff",
              fontSize: "14px",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
