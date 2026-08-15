import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

// Browser-tab favicon — the M monogram in a rounded gradient square.
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex",
          alignItems: "center", justifyContent: "center",
          background: "linear-gradient(140deg, #4A86C6 0%, #2F62A0 100%)",
          borderRadius: 15,
        }}
      >
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 19V6l8 8 8-8v13" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
