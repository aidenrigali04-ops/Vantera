import { ImageResponse } from "next/og";

// Default social-share card for the whole site (LinkedIn, Slack, iMessage, X). Brand-styled:
// near-black stage, electric-cyan diamond mark (drawn with divs so it renders in Satori), the
// site title + value line. Rendered on request — no asset file to maintain.
export const alt = "#1 LinkedIn Automation Tool — Start driving real revenue from LinkedIn.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BG = "#0A0A0A";
const CYAN = "#0b57ab";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "flex-start",
          padding: "0 96px",
          background: BG,
          color: "#ffffff",
          backgroundImage: `radial-gradient(900px 520px at 80% 16%, rgba(11, 87, 171,0.20), transparent 60%)`,
        }}
      >
        {/* brand mark: cyan rounded diamond with a sharp cut-out matching the stage */}
        <div
          style={{
            position: "relative",
            width: 112,
            height: 112,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 44,
          }}
        >
          <div
            style={{
              position: "absolute",
              width: 112,
              height: 112,
              background: CYAN,
              borderRadius: 30,
              transform: "rotate(45deg)",
            }}
          />
          <div
            style={{ position: "absolute", width: 46, height: 46, background: BG, transform: "rotate(45deg)" }}
          />
        </div>

        <div style={{ display: "flex", fontSize: 76, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.04 }}>
          #1 LinkedIn Automation Tool
        </div>
        <div style={{ display: "flex", fontSize: 36, color: "#9aa4b2", marginTop: 26 }}>
          Start driving real revenue from LinkedIn.
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 26,
            color: CYAN,
            fontWeight: 600,
            marginTop: 52,
            letterSpacing: "0.08em",
          }}
        >
          VANTERA · vanterasystem.dev
        </div>
      </div>
    ),
    { ...size }
  );
}
